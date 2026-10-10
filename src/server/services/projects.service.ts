import { and, asc, count, desc, eq, ilike, inArray, ne, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { plotArea, rectArea, areaFromDb, areaToDb, feetToDb } from "@/lib/area";
import { PHASES, PROJECT_STATUSES } from "@/lib/domain";
import { estimatedCost, totalSlabArea } from "@/lib/estimate";
import { paiseFromDb, paiseToDb } from "@/lib/money";
import { zId, zListQuery, zReason } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { nextNumber } from "../counters";
import { type DbOrTx, getDb, type Tx } from "../db/client";
import {
  activities,
  clients,
  floors,
  materialUsages,
  phaseBudgets,
  projectMembers,
  projects,
  slabs,
  transactions,
  users,
} from "../db/schema";
import { AppError, rule } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan, assertProjectAccess, canSeeMoney, moneyFor } from "../permissions";
import { inTx } from "../tx";
import { kpisForProjects } from "./kpis";
import { phaseProgressFor } from "./progress.service";
import { projectScopeFilter } from "./scope";

export { basicsInput, buildingInput, createProjectInput, estimateInput, siteInput } from "@/lib/schemas/project";
import { basicsInput, buildingInput, createProjectInput, estimateInput, siteInput } from "@/lib/schemas/project";

/* ---------- helpers ---------- */

function computedPlotArea(site: z.infer<typeof siteInput>): number {
  return site.plotShape === "IRREGULAR" ? (site.plotArea ?? 0) : (plotArea(site.plotShape, site.plotSides) ?? 0);
}

function siteColumns(site: z.infer<typeof siteInput>) {
  return {
    latitude: site.latitude ?? null,
    longitude: site.longitude ?? null,
    address: site.address ?? null,
    plotShape: site.plotShape,
    plotSides: site.plotShape === "IRREGULAR" ? {} : Object.fromEntries(Object.entries(site.plotSides).map(([k, v]) => [k, v / 100])),
    plotArea: areaToDb(computedPlotArea(site)),
    facing: site.facing ?? null,
    nearestRoad: site.nearestRoad ?? null,
  };
}

async function assertClientActive(tx: DbOrTx, clientId: string) {
  const [c] = await tx.select({ status: clients.status }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!c) throw new AppError("VALIDATION", "Pick a client", { clientId: "Pick a client" });
  if (c.status !== "ACTIVE") throw rule("This client is inactive.", { clientId: "This client is inactive" });
}

async function writeBudgets(tx: Tx, projectId: string, budgets: z.infer<typeof estimateInput>["phaseBudgets"]) {
  await tx.delete(phaseBudgets).where(eq(phaseBudgets.projectId, projectId));
  const rows = PHASES.flatMap((phase) => {
    const v = budgets[phase];
    return typeof v === "number" && v > 0 ? [{ projectId, phase, amount: paiseToDb(v) }] : [];
  });
  if (rows.length) await tx.insert(phaseBudgets).values(rows);
}

/** Inserts/updates floors and slabs; removes ones not in the input only if nothing refers to them. */
async function syncBuilding(tx: Tx, projectId: string, building: z.infer<typeof buildingInput>) {
  const existingFloors = await tx.select().from(floors).where(eq(floors.projectId, projectId));
  const existingSlabs = await tx.select().from(slabs).where(eq(slabs.projectId, projectId));
  const keepSlabIds = new Set(building.floors.flatMap((f) => f.slabs.map((s) => s.id).filter(Boolean) as string[]));
  const keepFloorIds = new Set(building.floors.map((f) => f.id).filter(Boolean) as string[]);

  for (const id of keepSlabIds) if (!existingSlabs.some((s) => s.id === id)) throw rule("A slab in this form does not belong to this project.");
  for (const id of keepFloorIds) if (!existingFloors.some((f) => f.id === id)) throw rule("A floor in this form does not belong to this project.");

  const removeSlabs = existingSlabs.filter((s) => !keepSlabIds.has(s.id));
  if (removeSlabs.length) {
    const ids = removeSlabs.map((s) => s.id);
    const [t] = await tx.select({ n: count() }).from(transactions).where(inArray(transactions.slabId, ids));
    const [u] = await tx.select({ n: count() }).from(materialUsages).where(inArray(materialUsages.slabId, ids));
    const [a] = await tx.select({ n: count() }).from(activities).where(inArray(activities.slabId, ids));
    if ((t?.n ?? 0) + (u?.n ?? 0) + (a?.n ?? 0) > 0) {
      throw rule(`Slab ${removeSlabs.map((s) => s.name).join(", ")} has records against it and cannot be removed.`);
    }
    await tx.delete(slabs).where(inArray(slabs.id, ids));
  }

  let totalArea = 0;
  for (const [fi, f] of building.floors.entries()) {
    let floorId = f.id;
    if (floorId) {
      await tx.update(floors).set({ level: f.level, name: f.name, isTerrace: f.isTerrace, sortOrder: fi }).where(eq(floors.id, floorId));
    } else {
      const [row] = await tx
        .insert(floors)
        .values({ projectId, level: f.level, name: f.name, isTerrace: f.isTerrace, sortOrder: fi })
        .returning({ id: floors.id });
      floorId = row!.id;
    }
    for (const [si, s] of f.slabs.entries()) {
      const a = rectArea(s.length, s.width);
      totalArea += a;
      const values = { name: s.name, lengthFt: feetToDb(s.length), widthFt: feetToDb(s.width), area: areaToDb(a), sortOrder: si, floorId };
      if (s.id) await tx.update(slabs).set(values).where(eq(slabs.id, s.id));
      else await tx.insert(slabs).values({ ...values, projectId });
    }
  }

  const removeFloors = existingFloors.filter((f) => !keepFloorIds.has(f.id));
  if (removeFloors.length) await tx.delete(floors).where(inArray(floors.id, removeFloors.map((f) => f.id)));
  return totalArea;
}

async function slabAreaTotal(db: DbOrTx, projectId: string) {
  const rows = await db.select({ area: slabs.area }).from(slabs).where(eq(slabs.projectId, projectId));
  return totalSlabArea(rows.map((r) => areaFromDb(r.area)));
}

/* ---------- create (wizard) ---------- */

export async function createProject(actor: Actor, input: unknown) {
  const data = createProjectInput.parse(input);
  assertCan(actor, "project.write");
  return inTx(async (tx) => {
    await assertClientActive(tx, data.basics.clientId);
    const code = await nextNumber(tx, "project", "MYL", 4);
    const [p] = await tx
      .insert(projects)
      .values({
        code,
        name: data.basics.name,
        clientId: data.basics.clientId,
        type: data.basics.type,
        status: "ONGOING",
        startDate: data.basics.startDate,
        expectedCompletion: data.basics.expectedCompletion,
        description: data.basics.description ?? null,
        ...siteColumns(data.site),
        floorsBelow: data.building.floorsBelow,
        floorsAbove: data.building.floorsAbove,
        hasTerrace: data.building.hasTerrace,
        costPerSft: paiseToDb(data.estimate.costPerSft),
        contractValue: data.estimate.contractValue === null ? null : paiseToDb(data.estimate.contractValue),
        createdBy: actor.id,
      })
      .returning({ id: projects.id });
    const projectId = p!.id;
    const area = await syncBuilding(tx, projectId, data.building);
    const est = estimatedCost(area, data.estimate.costPerSft);
    await tx.update(projects).set({ estimatedCost: paiseToDb(est) }).where(eq(projects.id, projectId));
    await writeBudgets(tx, projectId, data.estimate.phaseBudgets);
    await audit(tx, actor, { action: "create", entity: "project", entityId: projectId, projectId, data: { code, name: data.basics.name, estimatedCost: est } });
    return { id: projectId, code, estimatedCost: est, totalArea: area };
  });
}

/* ---------- section edits ---------- */

export async function updateBasics(actor: Actor, id: string, input: unknown) {
  const data = basicsInput.parse(input);
  assertCan(actor, "project.write");
  const projectId = zId.parse(id);
  return inTx(async (tx) => {
    const before = await assertProjectAccess(tx, actor, projectId, { write: true, lock: true });
    if (before.clientId !== data.clientId) await assertClientActive(tx, data.clientId);
    await tx
      .update(projects)
      .set({ ...data, description: data.description ?? null, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    await audit(tx, actor, { action: "update_basics", entity: "project", entityId: projectId, projectId, data });
    return { id: projectId };
  });
}

export async function updateSite(actor: Actor, id: string, input: unknown) {
  const data = siteInput.parse(input);
  const projectId = zId.parse(id);
  // Engineers may set the GPS location of their sites; everything else needs project.write.
  const gpsOnly = actor.role === "ENGINEER";
  assertCan(actor, gpsOnly ? "field.write" : "project.write");
  return inTx(async (tx) => {
    await assertProjectAccess(tx, actor, projectId, { write: true, lock: true });
    const cols = siteColumns(data);
    await tx
      .update(projects)
      .set(gpsOnly ? { latitude: cols.latitude, longitude: cols.longitude, updatedAt: new Date() } : { ...cols, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    await audit(tx, actor, { action: gpsOnly ? "update_gps" : "update_site", entity: "project", entityId: projectId, projectId, data: gpsOnly ? { latitude: cols.latitude, longitude: cols.longitude } : cols });
    return { id: projectId };
  });
}

export async function updateBuilding(actor: Actor, id: string, input: unknown) {
  const data = buildingInput.parse(input);
  assertCan(actor, "project.write");
  const projectId = zId.parse(id);
  return inTx(async (tx) => {
    const p = await assertProjectAccess(tx, actor, projectId, { write: true, lock: true });
    const area = await syncBuilding(tx, projectId, data);
    const est = estimatedCost(area, paiseFromDb(p.costPerSft));
    await tx
      .update(projects)
      .set({ floorsBelow: data.floorsBelow, floorsAbove: data.floorsAbove, hasTerrace: data.hasTerrace, estimatedCost: paiseToDb(est), updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    await audit(tx, actor, { action: "update_building", entity: "project", entityId: projectId, projectId, data: { totalArea: area, estimatedCost: est } });
    return { id: projectId, totalArea: area, estimatedCost: est };
  });
}

export async function updateEstimate(actor: Actor, id: string, input: unknown) {
  const data = estimateInput.parse(input);
  assertCan(actor, "project.write");
  const projectId = zId.parse(id);
  return inTx(async (tx) => {
    await assertProjectAccess(tx, actor, projectId, { write: true, lock: true });
    const area = await slabAreaTotal(tx, projectId);
    const est = estimatedCost(area, data.costPerSft);
    await tx
      .update(projects)
      .set({
        costPerSft: paiseToDb(data.costPerSft),
        estimatedCost: paiseToDb(est),
        contractValue: data.contractValue === null ? null : paiseToDb(data.contractValue),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
    await writeBudgets(tx, projectId, data.phaseBudgets);
    await audit(tx, actor, { action: "update_estimate", entity: "project", entityId: projectId, projectId, data: { costPerSft: data.costPerSft, estimatedCost: est, contractValue: data.contractValue } });
    return { id: projectId, estimatedCost: est };
  });
}

export async function setProjectStatus(actor: Actor, id: string, input: unknown) {
  const data = z.object({ status: z.enum(PROJECT_STATUSES), reason: zReason }).parse(input);
  assertCan(actor, data.status === "ARCHIVED" ? "record.void" : "project.write");
  const projectId = zId.parse(id);
  return inTx(async (tx) => {
    const p = await assertProjectAccess(tx, actor, projectId, { lock: true });
    if (p.status === data.status) throw rule("The project already has this status.");
    await tx.update(projects).set({ status: data.status, statusReason: data.reason, updatedAt: new Date() }).where(eq(projects.id, projectId));
    await audit(tx, actor, { action: "status", entity: "project", entityId: projectId, projectId, reason: data.reason, data: { from: p.status, to: data.status } });
    return { id: projectId };
  });
}

/* ---------- team ---------- */

export async function addMember(actor: Actor, id: string, input: unknown) {
  const data = z.object({ userId: zId }).parse(input);
  assertCan(actor, "project.write");
  const projectId = zId.parse(id);
  return inTx(async (tx) => {
    await assertProjectAccess(tx, actor, projectId, { write: true });
    const [u] = await tx.select().from(users).where(eq(users.id, data.userId)).limit(1);
    if (!u || u.status !== "ACTIVE") throw rule("Pick an active user.");
    if (u.role !== "ENGINEER") throw rule("Only engineers need to be assigned. Other roles already see every project.");
    await tx.insert(projectMembers).values({ projectId, userId: u.id }).onConflictDoNothing();
    await audit(tx, actor, { action: "assign", entity: "project_member", entityId: u.id, projectId });
    return { projectId, userId: u.id };
  });
}

export async function removeMember(actor: Actor, id: string, userId: string) {
  assertCan(actor, "project.write");
  const projectId = zId.parse(id);
  const uid = zId.parse(userId);
  return inTx(async (tx) => {
    await assertProjectAccess(tx, actor, projectId, { write: true });
    await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, uid)));
    await audit(tx, actor, { action: "unassign", entity: "project_member", entityId: uid, projectId });
    return { projectId, userId: uid };
  });
}

/* ---------- reads ---------- */

const listQuery = zListQuery.extend({
  status: z.enum([...PROJECT_STATUSES, "ACTIVE_ALL", "ALL"]).optional().catch("ACTIVE_ALL"),
});

export async function listProjects(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = listQuery.parse(query);
  const { limit, offset, page } = pageWindow(q.page);
  const status = q.status ?? "ACTIVE_ALL";
  const where: SQL | undefined = and(
    await projectScopeFilter(actor, projects.id),
    status === "ALL" ? undefined : status === "ACTIVE_ALL" ? ne(projects.status, "ARCHIVED") : eq(projects.status, status),
    q.q ? or(ilike(projects.name, `%${q.q}%`), ilike(projects.code, `%${q.q}%`)) : undefined,
  );
  const db = getDb();
  const rows = await db
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      startDate: projects.startDate,
      expectedCompletion: projects.expectedCompletion,
      address: projects.address,
      latitude: projects.latitude,
      clientName: clients.name,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(where)
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(projects).where(where);
  const ids = rows.map((r) => r.id);
  const [kpis, progress] = await Promise.all([canSeeMoney(actor) ? kpisForProjects(db, ids) : Promise.resolve(null), phaseProgressFor(db, ids)]);
  return paged(
    rows.map((r) => ({
      ...r,
      gpsMissing: r.latitude === null,
      progress: progress.get(r.id)?.overall ?? 0,
      kpis: kpis?.get(r.id) ?? null,
    })),
    total,
    page,
  );
}

/** Small list for pickers, scoped to what the actor can reach. */
export async function projectOptions(actor: Actor) {
  assertCan(actor, "project.read");
  return getDb()
    .select({ id: projects.id, name: projects.name, code: projects.code })
    .from(projects)
    .where(and(await projectScopeFilter(actor, projects.id), ne(projects.status, "ARCHIVED")))
    .orderBy(asc(projects.name));
}

export async function getProject(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const projectId = zId.parse(id);
  const db = getDb();
  const p = await assertProjectAccess(db, actor, projectId);
  const [client] = await db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.id, p.clientId));
  const floorRows = await db.select().from(floors).where(eq(floors.projectId, projectId)).orderBy(asc(floors.sortOrder));
  const slabRows = await db.select().from(slabs).where(eq(slabs.projectId, projectId)).orderBy(asc(slabs.sortOrder));
  const budgets = await db.select().from(phaseBudgets).where(eq(phaseBudgets.projectId, projectId));
  const team = await db
    .select({ id: users.id, name: users.name, role: users.role, phone: users.phone })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId));
  const kpis = canSeeMoney(actor) ? (await kpisForProjects(db, [projectId])).get(projectId) ?? null : null;
  const progress = (await phaseProgressFor(db, [projectId])).get(projectId)!;

  const floorList = floorRows.map((f) => {
    const fs = slabRows
      .filter((s) => s.floorId === f.id)
      .map((s) => ({ id: s.id, name: s.name, length: Math.round(Number(s.lengthFt) * 100), width: Math.round(Number(s.widthFt) * 100), area: areaFromDb(s.area) }));
    return { id: f.id, level: f.level, name: f.name, isTerrace: f.isTerrace, slabs: fs, area: totalSlabArea(fs.map((s) => s.area)) };
  });

  return {
    id: p.id,
    code: p.code,
    name: p.name,
    status: p.status,
    statusReason: p.statusReason,
    type: p.type,
    client: client!,
    startDate: p.startDate,
    expectedCompletion: p.expectedCompletion,
    description: p.description,
    latitude: p.latitude,
    longitude: p.longitude,
    gpsMissing: p.latitude === null,
    address: p.address,
    plotShape: p.plotShape,
    plotSides: p.plotSides,
    plotArea: areaFromDb(p.plotArea),
    facing: p.facing,
    nearestRoad: p.nearestRoad,
    floorsBelow: p.floorsBelow,
    floorsAbove: p.floorsAbove,
    hasTerrace: p.hasTerrace,
    floors: floorList,
    totalSlabArea: totalSlabArea(floorList.map((f) => f.area)),
    costPerSft: moneyFor(actor, paiseFromDb(p.costPerSft)),
    estimatedCost: moneyFor(actor, paiseFromDb(p.estimatedCost)),
    contractValue: p.contractValue === null ? null : moneyFor(actor, paiseFromDb(p.contractValue)),
    phaseBudgets: canSeeMoney(actor) ? Object.fromEntries(budgets.map((b) => [b.phase, paiseFromDb(b.amount)])) : null,
    team,
    kpis,
    progress,
  };
}

export type ProjectDetail = Awaited<ReturnType<typeof getProject>>;

/** Slabs of a project for pickers ("Ground floor · Slab 1"). */
export async function slabOptions(actor: Actor, projectId: string) {
  const db = getDb();
  await assertProjectAccess(db, actor, zId.parse(projectId));
  const rows = await db
    .select({ id: slabs.id, name: slabs.name, floor: floors.name })
    .from(slabs)
    .innerJoin(floors, eq(floors.id, slabs.floorId))
    .where(eq(slabs.projectId, projectId))
    .orderBy(asc(floors.sortOrder), asc(slabs.sortOrder));
  return rows.map((r) => ({ id: r.id, label: `${r.floor} · ${r.name}` }));
}

