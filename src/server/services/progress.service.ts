import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { PHASES, type Phase } from "@/lib/domain";
import { todayIso } from "@/lib/dates";
import { zDate, zId, zOptionalId, zPage, zReason, zRequiredText, zText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { type DbOrTx, getDb } from "../db/client";
import { activities, progressUpdates, projects, slabs, users } from "../db/schema";
import { notFound, rule } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan, assertProjectAccess } from "../permissions";
import { inTx } from "../tx";
import { projectScopeFilter } from "./scope";

export interface PhaseProgress {
  EXCAVATION: number;
  CIVIL: number;
  INTERIOR: number;
  /** Plain average of the three phases. */
  overall: number;
}

/** Phase progress = average progress of its (non-archived) activities; 0 when it has none. */
export async function phaseProgressFor(db: DbOrTx, projectIds: string[]): Promise<Map<string, PhaseProgress>> {
  const out = new Map<string, PhaseProgress>();
  for (const id of projectIds) out.set(id, { EXCAVATION: 0, CIVIL: 0, INTERIOR: 0, overall: 0 });
  if (!projectIds.length) return out;
  const rows = await db
    .select({ projectId: activities.projectId, phase: activities.phase, progress: activities.progress })
    .from(activities)
    .where(and(inArray(activities.projectId, projectIds), ne(activities.status, "ARCHIVED")));
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const k = `${r.projectId}:${r.phase}`;
    const a = acc.get(k) ?? { sum: 0, n: 0 };
    a.sum += r.progress;
    a.n += 1;
    acc.set(k, a);
  }
  for (const id of projectIds) {
    const pp = out.get(id)!;
    for (const ph of PHASES) {
      const a = acc.get(`${id}:${ph}`);
      pp[ph] = a ? Math.round(a.sum / a.n) : 0;
    }
    pp.overall = Math.round((pp.EXCAVATION + pp.CIVIL + pp.INTERIOR) / 3);
  }
  return out;
}

export interface NextActivity {
  name: string;
  date: string | null;
}

/** Next activity per project: the first in-progress one, else the first not started. */
export async function nextActivityFor(db: DbOrTx, projectIds: string[]): Promise<Map<string, NextActivity | null>> {
  const out = new Map<string, NextActivity | null>(projectIds.map((id) => [id, null]));
  if (!projectIds.length) return out;
  const rows = await db
    .select({ projectId: activities.projectId, name: activities.name, status: activities.status, plannedEnd: activities.plannedEnd, plannedStart: activities.plannedStart })
    .from(activities)
    .where(and(inArray(activities.projectId, projectIds), ne(activities.status, "ARCHIVED")));
  for (const id of projectIds) {
    const own = rows.filter((a) => a.projectId === id);
    const next = own.find((a) => a.status === "IN_PROGRESS") ?? own.find((a) => a.status === "NOT_STARTED");
    out.set(id, next ? { name: next.name, date: next.plannedEnd ?? next.plannedStart } : null);
  }
  return out;
}

/** One row per visible project: phase progress and the next activity. Never summed across projects. */
export async function listProjectProgress(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = z.object({ page: zPage.optional().default(1) }).parse(query);
  const db = getDb();
  const { limit, offset, page } = pageWindow(q.page);
  const where = and(await projectScopeFilter(actor, projects.id), ne(projects.status, "ARCHIVED"));
  const rows = await db.select({ id: projects.id, name: projects.name }).from(projects).where(where).orderBy(asc(projects.name)).limit(limit).offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(projects).where(where);
  const ids = rows.map((r) => r.id);
  const [progress, next] = await Promise.all([phaseProgressFor(db, ids), nextActivityFor(db, ids)]);
  return paged(
    rows.map((r) => ({ ...r, progress: progress.get(r.id)!, next: next.get(r.id) ?? null })),
    total,
    page,
  );
}

function statusFor(progress: number) {
  return progress >= 100 ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : "NOT_STARTED";
}

export const activityInput = z
  .object({
    phase: z.enum(PHASES),
    name: zRequiredText(150, "Activity name"),
    slabId: zOptionalId,
    plannedStart: z.union([zDate, z.literal("")]).optional().transform((v) => v || undefined),
    plannedEnd: z.union([zDate, z.literal("")]).optional().transform((v) => v || undefined),
  })
  .refine((v) => !v.plannedStart || !v.plannedEnd || v.plannedEnd >= v.plannedStart, {
    path: ["plannedEnd"],
    message: "End must be on or after start",
  });

export const progressInput = z.object({
  progress: z.coerce.number().int().min(0, "0 to 100").max(100, "0 to 100"),
  date: zDate.default(() => todayIso()),
  note: zText(500),
});

async function assertSlab(db: DbOrTx, projectId: string, slabId: string | undefined) {
  if (!slabId) return;
  const [s] = await db.select({ projectId: slabs.projectId }).from(slabs).where(eq(slabs.id, slabId)).limit(1);
  if (!s || s.projectId !== projectId) throw rule("Pick a slab from this project.", { slabId: "Pick a slab from this project" });
}

async function loadActivity(db: DbOrTx, actor: Actor, id: string, write: boolean) {
  const [a] = await db.select().from(activities).where(eq(activities.id, zId.parse(id))).limit(1);
  if (!a) throw notFound("Activity");
  await assertProjectAccess(db, actor, a.projectId, { write });
  return a;
}

export async function listActivities(actor: Actor, projectId: string, opts: { includeArchived?: boolean } = {}) {
  assertCan(actor, "project.read");
  const db = getDb();
  await assertProjectAccess(db, actor, zId.parse(projectId));
  const rows = await db
    .select({
      id: activities.id,
      phase: activities.phase,
      name: activities.name,
      slabId: activities.slabId,
      slabName: slabs.name,
      plannedStart: activities.plannedStart,
      plannedEnd: activities.plannedEnd,
      progress: activities.progress,
      status: activities.status,
      statusReason: activities.statusReason,
      updatedAt: activities.updatedAt,
    })
    .from(activities)
    .leftJoin(slabs, eq(slabs.id, activities.slabId))
    .where(and(eq(activities.projectId, projectId), opts.includeArchived ? undefined : ne(activities.status, "ARCHIVED")))
    .orderBy(asc(activities.phase), asc(activities.createdAt));
  const grouped = Object.fromEntries(PHASES.map((p) => [p, rows.filter((r) => r.phase === p)])) as Record<Phase, typeof rows>;
  const progress = (await phaseProgressFor(db, [projectId])).get(projectId)!;
  return { phases: grouped, progress };
}

/** Across projects: recent progress updates (Work & Progress module). */
export async function listProgressUpdates(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = z.object({ page: zPage.optional().default(1), projectId: zOptionalId }).parse(query);
  const { limit, offset, page } = pageWindow(q.page);
  const db = getDb();
  const where = and(await projectScopeFilter(actor, progressUpdates.projectId), q.projectId ? eq(progressUpdates.projectId, q.projectId) : undefined);
  const rows = await db
    .select({
      id: progressUpdates.id,
      date: progressUpdates.date,
      progress: progressUpdates.progress,
      note: progressUpdates.note,
      activityId: activities.id,
      activityName: activities.name,
      phase: activities.phase,
      projectId: projects.id,
      projectName: projects.name,
      byName: users.name,
    })
    .from(progressUpdates)
    .innerJoin(activities, eq(activities.id, progressUpdates.activityId))
    .innerJoin(projects, eq(projects.id, progressUpdates.projectId))
    .innerJoin(users, eq(users.id, progressUpdates.createdBy))
    .where(where)
    .orderBy(desc(progressUpdates.date), desc(progressUpdates.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(progressUpdates).where(where);
  return paged(rows, total, page);
}

export async function getActivity(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const db = getDb();
  const a = await loadActivity(db, actor, id, false);
  const history = await db
    .select({ id: progressUpdates.id, date: progressUpdates.date, progress: progressUpdates.progress, note: progressUpdates.note, byName: users.name })
    .from(progressUpdates)
    .innerJoin(users, eq(users.id, progressUpdates.createdBy))
    .where(eq(progressUpdates.activityId, a.id))
    .orderBy(desc(progressUpdates.createdAt))
    .limit(50);
  return { ...a, history };
}

export async function createActivity(actor: Actor, projectId: string, input: unknown) {
  const data = activityInput.parse(input);
  assertCan(actor, "field.write");
  const pid = zId.parse(projectId);
  return inTx(async (tx) => {
    await assertProjectAccess(tx, actor, pid, { write: true });
    await assertSlab(tx, pid, data.slabId);
    const [a] = await tx
      .insert(activities)
      .values({ projectId: pid, phase: data.phase, name: data.name, slabId: data.slabId ?? null, plannedStart: data.plannedStart ?? null, plannedEnd: data.plannedEnd ?? null })
      .returning({ id: activities.id });
    await audit(tx, actor, { action: "create", entity: "activity", entityId: a!.id, projectId: pid, data });
    return { id: a!.id };
  });
}

export async function updateActivity(actor: Actor, id: string, input: unknown) {
  const data = activityInput.parse(input);
  assertCan(actor, "field.write");
  return inTx(async (tx) => {
    const a = await loadActivity(tx, actor, id, true);
    if (a.status === "ARCHIVED") throw rule("Restore this activity before editing it.");
    await assertSlab(tx, a.projectId, data.slabId);
    await tx
      .update(activities)
      .set({ phase: data.phase, name: data.name, slabId: data.slabId ?? null, plannedStart: data.plannedStart ?? null, plannedEnd: data.plannedEnd ?? null, updatedAt: new Date() })
      .where(eq(activities.id, a.id));
    await audit(tx, actor, { action: "update", entity: "activity", entityId: a.id, projectId: a.projectId, data });
    return { id: a.id };
  });
}

export async function recordProgress(actor: Actor, id: string, input: unknown) {
  const data = progressInput.parse(input);
  assertCan(actor, "field.write");
  return inTx(async (tx) => {
    const a = await loadActivity(tx, actor, id, true);
    if (a.status === "ARCHIVED") throw rule("This activity is archived.");
    await tx.update(activities).set({ progress: data.progress, status: statusFor(data.progress), updatedAt: new Date() }).where(eq(activities.id, a.id));
    const [u] = await tx
      .insert(progressUpdates)
      .values({ activityId: a.id, projectId: a.projectId, date: data.date, progress: data.progress, note: data.note ?? null, createdBy: actor.id })
      .returning({ id: progressUpdates.id });
    await audit(tx, actor, { action: "progress", entity: "activity", entityId: a.id, projectId: a.projectId, data: { from: a.progress, to: data.progress } });
    return { id: u!.id };
  });
}

export async function setActivityArchived(actor: Actor, id: string, input: unknown) {
  const data = z.object({ archived: z.boolean(), reason: zReason }).parse(input);
  assertCan(actor, "record.void");
  return inTx(async (tx) => {
    const a = await loadActivity(tx, actor, id, true);
    const status = data.archived ? "ARCHIVED" : statusFor(a.progress);
    await tx.update(activities).set({ status, statusReason: data.reason, updatedAt: new Date() }).where(eq(activities.id, a.id));
    await audit(tx, actor, { action: data.archived ? "archive" : "restore", entity: "activity", entityId: a.id, projectId: a.projectId, reason: data.reason });
    return { id: a.id };
  });
}
