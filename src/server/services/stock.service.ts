/**
 * Materials flow per project: purchased (MATERIAL transactions) → received (deliveries) →
 * used → remaining. project_stock is locked FOR UPDATE on every change so stock can never go
 * negative, and a CHECK constraint backs that up in the database.
 */
import { type AnyColumn, aliasedTable, and, asc, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { PHASES } from "@/lib/domain";
import { formatQty, qtyFromDb, qtyToDb } from "@/lib/qty";
import { mulQtyRate, paiseFromDb, paiseToDb, sumPaise } from "@/lib/money";
import { zDate, zId, zMoneyPositive, zOptionalId, zPage, zQty, zReason, zText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { nextNumber } from "../counters";
import { type DbOrTx, getDb, type Tx } from "../db/client";
import {
  activities,
  materialReceipts,
  materials,
  materialUsages,
  projects,
  projectStock,
  purchaseOrderLines,
  purchaseOrders,
  slabs,
  transactions,
  users,
  vendors,
} from "../db/schema";
import { AppError, notFound, rule } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan, assertProjectAccess, canSeeMoney } from "../permissions";
import { inTx } from "../tx";
import { projectScopeFilter } from "./scope";
import { auditTrail } from "./transactions.service";

/* ---------- stock row lock ---------- */

async function lockStock(tx: Tx, projectId: string, materialId: string) {
  await tx.insert(projectStock).values({ projectId, materialId }).onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(projectStock)
    .where(and(eq(projectStock.projectId, projectId), eq(projectStock.materialId, materialId)))
    .for("update");
  return { received: qtyFromDb(row!.received), used: qtyFromDb(row!.used) };
}

async function writeStock(tx: Tx, projectId: string, materialId: string, received: number, used: number) {
  if (used < 0 || received < used) throw rule("Stock cannot go below zero.");
  await tx
    .update(projectStock)
    .set({ received: qtyToDb(received), used: qtyToDb(used) })
    .where(and(eq(projectStock.projectId, projectId), eq(projectStock.materialId, materialId)));
}

async function activeMaterial(db: DbOrTx, materialId: string) {
  const [m] = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
  if (!m) throw new AppError("VALIDATION", "Pick the material", { materialId: "Pick the material" });
  if (m.status !== "ACTIVE") throw rule("This material is inactive.", { materialId: "This material is inactive" });
  return m;
}

/* ---------- deliveries (received) ---------- */

export const receiptInput = z.object({
  projectId: zId,
  materialId: zId,
  vendorId: zOptionalId,
  purchaseOrderId: zOptionalId,
  date: zDate,
  qty: zQty,
  challanNo: zText(50),
  vehicleNo: zText(30),
  notes: zText(500),
});
export const receiptUpdateInput = receiptInput.omit({ projectId: true, materialId: true });

export type ReceiptDraft = z.output<typeof receiptInput> & { challanLine?: number };

/** Shared by the delivery form and the AI-draft confirm step. */
export async function insertReceipt(tx: Tx, actor: Actor, d: ReceiptDraft, meta: { source?: "MANUAL" | "AI"; aiDraftId?: string } = {}) {
  assertCan(actor, "field.write");
  await assertProjectAccess(tx, actor, d.projectId, { write: true });
  const m = await activeMaterial(tx, d.materialId);
  if (d.vendorId) {
    const [v] = await tx.select({ status: vendors.status }).from(vendors).where(eq(vendors.id, d.vendorId)).limit(1);
    if (!v) throw new AppError("VALIDATION", "Pick the vendor", { vendorId: "Pick the vendor" });
    if (v.status !== "ACTIVE") throw rule("This vendor is inactive.", { vendorId: "This vendor is inactive" });
  }
  if (d.purchaseOrderId) {
    const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, d.purchaseOrderId)).limit(1);
    if (!po || po.projectId !== d.projectId) throw rule("Pick a purchase order from this project.", { purchaseOrderId: "Pick a purchase order from this project" });
    if (po.status !== "OPEN") throw rule("This purchase order is not open.", { purchaseOrderId: "This purchase order is not open" });
  }
  const stock = await lockStock(tx, d.projectId, d.materialId);
  const [row] = await tx
    .insert(materialReceipts)
    .values({
      projectId: d.projectId,
      materialId: d.materialId,
      vendorId: d.vendorId ?? null,
      purchaseOrderId: d.purchaseOrderId ?? null,
      date: d.date,
      qty: qtyToDb(d.qty),
      challanNo: d.challanNo ?? null,
      challanLine: d.challanLine ?? 1,
      vehicleNo: d.vehicleNo ?? null,
      notes: d.notes ?? null,
      source: meta.source ?? "MANUAL",
      aiDraftId: meta.aiDraftId ?? null,
      createdBy: actor.id,
    })
    .returning({ id: materialReceipts.id });
  await writeStock(tx, d.projectId, d.materialId, stock.received + d.qty, stock.used);
  await audit(tx, actor, { action: "create", entity: "receipt", entityId: row!.id, projectId: d.projectId, data: { material: m.name, qty: d.qty, source: meta.source ?? "MANUAL" } });
  return { id: row!.id };
}

export async function createReceipt(actor: Actor, input: unknown) {
  const data = receiptInput.parse(input);
  assertCan(actor, "field.write");
  return inTx((tx) => insertReceipt(tx, actor, data));
}

export async function updateReceipt(actor: Actor, id: string, input: unknown) {
  const data = receiptUpdateInput.parse(input);
  assertCan(actor, "field.write");
  const rid = zId.parse(id);
  return inTx(async (tx) => {
    const [cur] = await tx.select().from(materialReceipts).where(eq(materialReceipts.id, rid)).for("update").limit(1);
    if (!cur) throw notFound("Delivery");
    await assertProjectAccess(tx, actor, cur.projectId, { write: true });
    if (cur.status === "VOID") throw rule("A void delivery cannot be edited.");
    const stock = await lockStock(tx, cur.projectId, cur.materialId);
    const newReceived = stock.received - qtyFromDb(cur.qty) + data.qty;
    if (newReceived < stock.used) {
      throw rule(`Cannot lower this delivery: ${formatQty(stock.used)} is already used on site.`, { qty: "More than this is already used" });
    }
    await tx
      .update(materialReceipts)
      .set({
        vendorId: data.vendorId ?? null,
        purchaseOrderId: data.purchaseOrderId ?? null,
        date: data.date,
        qty: qtyToDb(data.qty),
        challanNo: data.challanNo ?? null,
        vehicleNo: data.vehicleNo ?? null,
        notes: data.notes ?? null,
      })
      .where(eq(materialReceipts.id, rid));
    await writeStock(tx, cur.projectId, cur.materialId, newReceived, stock.used);
    await audit(tx, actor, { action: "update", entity: "receipt", entityId: rid, projectId: cur.projectId, data: { from: qtyFromDb(cur.qty), to: data.qty } });
    return { id: rid };
  });
}

export async function voidReceipt(actor: Actor, id: string, input: unknown) {
  const { reason } = z.object({ reason: zReason }).parse(input);
  assertCan(actor, "record.void");
  const rid = zId.parse(id);
  return inTx(async (tx) => {
    const [cur] = await tx.select().from(materialReceipts).where(eq(materialReceipts.id, rid)).for("update").limit(1);
    if (!cur) throw notFound("Delivery");
    await assertProjectAccess(tx, actor, cur.projectId, { write: true });
    if (cur.status === "VOID") throw rule("This delivery is already void.");
    const stock = await lockStock(tx, cur.projectId, cur.materialId);
    const newReceived = stock.received - qtyFromDb(cur.qty);
    if (newReceived < stock.used) {
      throw rule(`Cannot void: only ${formatQty(stock.received - stock.used)} is left in stock. Void the usage entries first.`);
    }
    await tx.update(materialReceipts).set({ status: "VOID", voidReason: reason, voidedBy: actor.id, voidedAt: new Date() }).where(eq(materialReceipts.id, rid));
    await writeStock(tx, cur.projectId, cur.materialId, newReceived, stock.used);
    await audit(tx, actor, { action: "void", entity: "receipt", entityId: rid, projectId: cur.projectId, reason, data: { qty: qtyFromDb(cur.qty) } });
    return { id: rid };
  });
}

/* ---------- usage ---------- */

export const usageInput = z.object({
  projectId: zId,
  materialId: zId,
  date: zDate,
  qty: zQty,
  phase: z.union([z.enum(PHASES), z.literal("")]).optional().transform((v) => v || undefined),
  slabId: zOptionalId,
  activityId: zOptionalId,
  notes: zText(500),
});
export const usageUpdateInput = usageInput.omit({ projectId: true, materialId: true });

async function checkUsageRefs(tx: DbOrTx, projectId: string, slabId?: string, activityId?: string) {
  if (slabId) {
    const [s] = await tx.select({ p: slabs.projectId }).from(slabs).where(eq(slabs.id, slabId)).limit(1);
    if (!s || s.p !== projectId) throw rule("Pick a slab from this project.", { slabId: "Pick a slab from this project" });
  }
  if (activityId) {
    const [a] = await tx.select({ p: activities.projectId }).from(activities).where(eq(activities.id, activityId)).limit(1);
    if (!a || a.p !== projectId) throw rule("Pick an activity from this project.", { activityId: "Pick an activity from this project" });
  }
}

export async function createUsage(actor: Actor, input: unknown) {
  const d = usageInput.parse(input);
  assertCan(actor, "field.write");
  return inTx(async (tx) => {
    await assertProjectAccess(tx, actor, d.projectId, { write: true });
    const m = await activeMaterial(tx, d.materialId);
    await checkUsageRefs(tx, d.projectId, d.slabId, d.activityId);
    const stock = await lockStock(tx, d.projectId, d.materialId);
    const left = stock.received - stock.used;
    if (d.qty > left) {
      throw rule(`Only ${formatQty(left)} ${m.unit} of ${m.name} is in stock.`, { qty: `Only ${formatQty(left)} ${m.unit} left` });
    }
    const [row] = await tx
      .insert(materialUsages)
      .values({
        projectId: d.projectId,
        materialId: d.materialId,
        date: d.date,
        qty: qtyToDb(d.qty),
        phase: d.phase ?? null,
        slabId: d.slabId ?? null,
        activityId: d.activityId ?? null,
        notes: d.notes ?? null,
        createdBy: actor.id,
      })
      .returning({ id: materialUsages.id });
    await writeStock(tx, d.projectId, d.materialId, stock.received, stock.used + d.qty);
    await audit(tx, actor, { action: "create", entity: "usage", entityId: row!.id, projectId: d.projectId, data: { material: m.name, qty: d.qty } });
    return { id: row!.id };
  });
}

export async function updateUsage(actor: Actor, id: string, input: unknown) {
  const d = usageUpdateInput.parse(input);
  assertCan(actor, "field.write");
  const uid = zId.parse(id);
  return inTx(async (tx) => {
    const [cur] = await tx.select().from(materialUsages).where(eq(materialUsages.id, uid)).for("update").limit(1);
    if (!cur) throw notFound("Usage entry");
    await assertProjectAccess(tx, actor, cur.projectId, { write: true });
    if (cur.status === "VOID") throw rule("A void entry cannot be edited.");
    await checkUsageRefs(tx, cur.projectId, d.slabId, d.activityId);
    const stock = await lockStock(tx, cur.projectId, cur.materialId);
    const newUsed = stock.used - qtyFromDb(cur.qty) + d.qty;
    if (newUsed > stock.received) {
      const left = stock.received - stock.used + qtyFromDb(cur.qty);
      throw rule(`Only ${formatQty(left)} is available for this entry.`, { qty: `At most ${formatQty(left)}` });
    }
    await tx
      .update(materialUsages)
      .set({ date: d.date, qty: qtyToDb(d.qty), phase: d.phase ?? null, slabId: d.slabId ?? null, activityId: d.activityId ?? null, notes: d.notes ?? null })
      .where(eq(materialUsages.id, uid));
    await writeStock(tx, cur.projectId, cur.materialId, stock.received, newUsed);
    await audit(tx, actor, { action: "update", entity: "usage", entityId: uid, projectId: cur.projectId, data: { from: qtyFromDb(cur.qty), to: d.qty } });
    return { id: uid };
  });
}

export async function voidUsage(actor: Actor, id: string, input: unknown) {
  const { reason } = z.object({ reason: zReason }).parse(input);
  assertCan(actor, "record.void");
  const uid = zId.parse(id);
  return inTx(async (tx) => {
    const [cur] = await tx.select().from(materialUsages).where(eq(materialUsages.id, uid)).for("update").limit(1);
    if (!cur) throw notFound("Usage entry");
    await assertProjectAccess(tx, actor, cur.projectId, { write: true });
    if (cur.status === "VOID") throw rule("This entry is already void.");
    const stock = await lockStock(tx, cur.projectId, cur.materialId);
    await tx.update(materialUsages).set({ status: "VOID", voidReason: reason, voidedBy: actor.id, voidedAt: new Date() }).where(eq(materialUsages.id, uid));
    await writeStock(tx, cur.projectId, cur.materialId, stock.received, stock.used - qtyFromDb(cur.qty));
    await audit(tx, actor, { action: "void", entity: "usage", entityId: uid, projectId: cur.projectId, reason });
    return { id: uid };
  });
}

/* ---------- reads: stock summary, deliveries, usage ---------- */

export interface StockLine {
  materialId: string;
  name: string;
  unit: string;
  ordered: number;
  purchased: number;
  received: number;
  used: number;
  remaining: number;
  pendingDelivery: number;
  purchasedValue: number | null;
}

export async function projectStockSummary(actor: Actor, projectId: string): Promise<StockLine[]> {
  assertCan(actor, "project.read");
  const db = getDb();
  const pid = zId.parse(projectId);
  await assertProjectAccess(db, actor, pid);
  return stockLines(db, [pid], canSeeMoney(actor));
}

export async function stockLines(db: DbOrTx, projectIds: string[] | null, withMoney: boolean): Promise<StockLine[]> {
  const projFilter = (col: AnyColumn) => (projectIds ? (projectIds.length ? inArray(col, projectIds) : sql`false`) : undefined);
  const purchased = await db
    .select({ materialId: transactions.materialId, qty: sql<string>`coalesce(sum(${transactions.qty}),0)`, value: sql<string>`coalesce(sum(${transactions.amount}),0)` })
    .from(transactions)
    .where(and(projFilter(transactions.projectId), eq(transactions.type, "MATERIAL"), eq(transactions.status, "ACTIVE")))
    .groupBy(transactions.materialId);
  const ordered = await db
    .select({ materialId: purchaseOrderLines.materialId, qty: sql<string>`coalesce(sum(${purchaseOrderLines.qty}),0)` })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
    .where(and(projFilter(purchaseOrders.projectId), ne(purchaseOrders.status, "VOID")))
    .groupBy(purchaseOrderLines.materialId);
  const stock = await db
    .select({ materialId: projectStock.materialId, received: sql<string>`sum(${projectStock.received})`, used: sql<string>`sum(${projectStock.used})` })
    .from(projectStock)
    .where(projFilter(projectStock.projectId))
    .groupBy(projectStock.materialId);
  const ids = new Set<string>([...purchased.map((p) => p.materialId!), ...ordered.map((o) => o.materialId), ...stock.map((s) => s.materialId)].filter(Boolean));
  if (!ids.size) return [];
  const mats = await db.select().from(materials).where(inArray(materials.id, [...ids])).orderBy(asc(materials.name));
  return mats.map((m) => {
    const p = purchased.find((x) => x.materialId === m.id);
    const o = ordered.find((x) => x.materialId === m.id);
    const s = stock.find((x) => x.materialId === m.id);
    const received = qtyFromDb(s?.received ?? "0");
    const used = qtyFromDb(s?.used ?? "0");
    const purchasedQty = qtyFromDb(p?.qty ?? "0");
    return {
      materialId: m.id,
      name: m.name,
      unit: m.unit,
      ordered: qtyFromDb(o?.qty ?? "0"),
      purchased: purchasedQty,
      received,
      used,
      remaining: received - used,
      pendingDelivery: Math.max(0, purchasedQty - received),
      purchasedValue: withMoney ? paiseFromDb(p?.value ?? "0") : null,
    };
  });
}

export interface ProjectStockLine extends StockLine {
  projectId: string;
  projectName: string;
}

/**
 * Stock for every project the actor can see: one row per project × material.
 * Quantities are never added across projects.
 */
export async function stockByProject(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = z.object({ page: zPage.optional().default(1) }).parse(query);
  const db = getDb();
  const withMoney = canSeeMoney(actor);
  const { limit, offset, page } = pageWindow(q.page);
  const scope = (col: AnyColumn) => projectScopeFilter(actor, col);

  const purchased = await db
    .select({ projectId: transactions.projectId, materialId: transactions.materialId, qty: sql<string>`coalesce(sum(${transactions.qty}),0)`, value: sql<string>`coalesce(sum(${transactions.amount}),0)` })
    .from(transactions)
    .where(and(await scope(transactions.projectId), eq(transactions.type, "MATERIAL"), eq(transactions.status, "ACTIVE")))
    .groupBy(transactions.projectId, transactions.materialId);
  const ordered = await db
    .select({ projectId: purchaseOrders.projectId, materialId: purchaseOrderLines.materialId, qty: sql<string>`coalesce(sum(${purchaseOrderLines.qty}),0)` })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
    .where(and(await scope(purchaseOrders.projectId), ne(purchaseOrders.status, "VOID")))
    .groupBy(purchaseOrders.projectId, purchaseOrderLines.materialId);
  const stock = await db
    .select({ projectId: projectStock.projectId, materialId: projectStock.materialId, received: projectStock.received, used: projectStock.used })
    .from(projectStock)
    .where(await scope(projectStock.projectId));

  const keyOf = (p: string, m: string) => `${p}:${m}`;
  const keys = new Map<string, { projectId: string; materialId: string }>();
  for (const r of [...purchased, ...ordered, ...stock]) {
    if (r.materialId) keys.set(keyOf(r.projectId, r.materialId), { projectId: r.projectId, materialId: r.materialId });
  }
  if (!keys.size) return paged<ProjectStockLine>([], 0, page);
  const pIds = [...new Set([...keys.values()].map((k) => k.projectId))];
  const mIds = [...new Set([...keys.values()].map((k) => k.materialId))];
  const [projs, mats] = await Promise.all([
    db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, pIds)),
    db.select().from(materials).where(inArray(materials.id, mIds)),
  ]);
  const projName = new Map(projs.map((p) => [p.id, p.name]));
  const matById = new Map(mats.map((m) => [m.id, m]));
  const by = <T extends { projectId: string; materialId: string | null }>(rows: T[]) => new Map(rows.map((r) => [keyOf(r.projectId, r.materialId!), r]));
  const pMap = by(purchased);
  const oMap = by(ordered);
  const sMap = by(stock);

  const all: ProjectStockLine[] = [...keys.values()].map(({ projectId, materialId }) => {
    const m = matById.get(materialId)!;
    const k = keyOf(projectId, materialId);
    const p = pMap.get(k);
    const received = qtyFromDb(sMap.get(k)?.received ?? "0");
    const used = qtyFromDb(sMap.get(k)?.used ?? "0");
    const purchasedQty = qtyFromDb(p?.qty ?? "0");
    return {
      projectId,
      projectName: projName.get(projectId) ?? "",
      materialId,
      name: m.name,
      unit: m.unit,
      ordered: qtyFromDb(oMap.get(k)?.qty ?? "0"),
      purchased: purchasedQty,
      received,
      used,
      remaining: received - used,
      pendingDelivery: Math.max(0, purchasedQty - received),
      purchasedValue: withMoney ? paiseFromDb(p?.value ?? "0") : null,
    };
  });
  all.sort((a, b) => a.projectName.localeCompare(b.projectName) || a.name.localeCompare(b.name));
  return paged(all.slice(offset, offset + limit), all.length, page);
}

const recCreator = aliasedTable(users, "rec_creator");

function receiptQuery(db: DbOrTx) {
  return db
    .select({
      id: materialReceipts.id,
      date: materialReceipts.date,
      qty: materialReceipts.qty,
      challanNo: materialReceipts.challanNo,
      vehicleNo: materialReceipts.vehicleNo,
      notes: materialReceipts.notes,
      status: materialReceipts.status,
      voidReason: materialReceipts.voidReason,
      source: materialReceipts.source,
      projectId: materialReceipts.projectId,
      projectName: projects.name,
      materialId: materialReceipts.materialId,
      materialName: materials.name,
      unit: materials.unit,
      vendorId: materialReceipts.vendorId,
      vendorName: vendors.name,
      purchaseOrderId: materialReceipts.purchaseOrderId,
      poNumber: purchaseOrders.number,
      createdByName: recCreator.name,
    })
    .from(materialReceipts)
    .innerJoin(projects, eq(projects.id, materialReceipts.projectId))
    .innerJoin(materials, eq(materials.id, materialReceipts.materialId))
    .leftJoin(vendors, eq(vendors.id, materialReceipts.vendorId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, materialReceipts.purchaseOrderId))
    .leftJoin(recCreator, eq(recCreator.id, materialReceipts.createdBy))
    .$dynamic();
}

const flowQuery = z.object({
  page: zPage.optional().default(1),
  projectId: zOptionalId,
  materialId: zOptionalId,
  status: z.enum(["ACTIVE", "VOID", "ALL"]).optional().catch("ACTIVE"),
});

export async function listReceipts(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = flowQuery.parse(query);
  const db = getDb();
  if (q.projectId) await assertProjectAccess(db, actor, q.projectId);
  const { limit, offset, page } = pageWindow(q.page);
  const where: SQL | undefined = and(
    await projectScopeFilter(actor, materialReceipts.projectId),
    q.projectId ? eq(materialReceipts.projectId, q.projectId) : undefined,
    q.materialId ? eq(materialReceipts.materialId, q.materialId) : undefined,
    q.status === "ALL" ? undefined : eq(materialReceipts.status, q.status ?? "ACTIVE"),
  );
  const rows = await receiptQuery(db)
    .where(where)
    .orderBy(desc(materialReceipts.date), desc(materialReceipts.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(materialReceipts).where(where);
  return paged(rows.map((r) => ({ ...r, qty: qtyFromDb(r.qty) })), total, page);
}

export async function getReceipt(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const db = getDb();
  const [row] = await receiptQuery(db).where(eq(materialReceipts.id, zId.parse(id))).limit(1);
  if (!row) throw notFound("Delivery");
  await assertProjectAccess(db, actor, row.projectId);
  const history = await auditTrail(db, "receipt", row.id);
  return { ...row, qty: qtyFromDb(row.qty), history };
}

export async function listUsages(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = flowQuery.parse(query);
  const db = getDb();
  if (q.projectId) await assertProjectAccess(db, actor, q.projectId);
  const { limit, offset, page } = pageWindow(q.page);
  const where: SQL | undefined = and(
    await projectScopeFilter(actor, materialUsages.projectId),
    q.projectId ? eq(materialUsages.projectId, q.projectId) : undefined,
    q.materialId ? eq(materialUsages.materialId, q.materialId) : undefined,
    q.status === "ALL" ? undefined : eq(materialUsages.status, q.status ?? "ACTIVE"),
  );
  const rows = await db
    .select({
      id: materialUsages.id,
      date: materialUsages.date,
      qty: materialUsages.qty,
      phase: materialUsages.phase,
      notes: materialUsages.notes,
      status: materialUsages.status,
      voidReason: materialUsages.voidReason,
      projectId: materialUsages.projectId,
      projectName: projects.name,
      materialId: materialUsages.materialId,
      materialName: materials.name,
      unit: materials.unit,
      slabId: materialUsages.slabId,
      slabName: slabs.name,
      activityId: materialUsages.activityId,
      activityName: activities.name,
    })
    .from(materialUsages)
    .innerJoin(projects, eq(projects.id, materialUsages.projectId))
    .innerJoin(materials, eq(materials.id, materialUsages.materialId))
    .leftJoin(slabs, eq(slabs.id, materialUsages.slabId))
    .leftJoin(activities, eq(activities.id, materialUsages.activityId))
    .where(where)
    .orderBy(desc(materialUsages.date), desc(materialUsages.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(materialUsages).where(where);
  return paged(rows.map((r) => ({ ...r, qty: qtyFromDb(r.qty) })), total, page);
}

/* ---------- purchase orders (optional) ---------- */

const poLineInput = z.object({ materialId: zId, qty: zQty, rate: zMoneyPositive });
export const poInput = z.object({
  projectId: zId,
  vendorId: zId,
  number: zText(30),
  date: zDate,
  notes: zText(500),
  lines: z.array(poLineInput).min(1, "Add at least one line").max(50),
});
export const poUpdateInput = poInput.omit({ projectId: true });

async function writePoLines(tx: Tx, poId: string, lines: z.output<typeof poLineInput>[]) {
  for (const l of lines) await activeMaterial(tx, l.materialId);
  await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, poId));
  await tx.insert(purchaseOrderLines).values(
    lines.map((l) => ({ purchaseOrderId: poId, materialId: l.materialId, qty: qtyToDb(l.qty), rate: paiseToDb(l.rate), amount: paiseToDb(mulQtyRate(l.qty, l.rate)) })),
  );
  return sumPaise(lines.map((l) => mulQtyRate(l.qty, l.rate)));
}

export async function createPurchaseOrder(actor: Actor, input: unknown) {
  const d = poInput.parse(input);
  assertCan(actor, "finance.write");
  return inTx(async (tx) => {
    await assertProjectAccess(tx, actor, d.projectId, { write: true });
    const number = d.number ?? (await nextNumber(tx, "po", "PO", 5));
    const [po] = await tx
      .insert(purchaseOrders)
      .values({ number, projectId: d.projectId, vendorId: d.vendorId, date: d.date, notes: d.notes ?? null, createdBy: actor.id })
      .returning({ id: purchaseOrders.id });
    const total = await writePoLines(tx, po!.id, d.lines);
    await audit(tx, actor, { action: "create", entity: "purchase_order", entityId: po!.id, projectId: d.projectId, data: { number, total } });
    return { id: po!.id, number };
  });
}

export async function updatePurchaseOrder(actor: Actor, id: string, input: unknown) {
  const d = poUpdateInput.parse(input);
  assertCan(actor, "finance.write");
  const poId = zId.parse(id);
  return inTx(async (tx) => {
    const [cur] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).for("update").limit(1);
    if (!cur) throw notFound("Purchase order");
    await assertProjectAccess(tx, actor, cur.projectId, { write: true });
    if (cur.status !== "OPEN") throw rule("Only open purchase orders can be edited.");
    await tx.update(purchaseOrders).set({ vendorId: d.vendorId, number: d.number ?? cur.number, date: d.date, notes: d.notes ?? null }).where(eq(purchaseOrders.id, poId));
    const total = await writePoLines(tx, poId, d.lines);
    await audit(tx, actor, { action: "update", entity: "purchase_order", entityId: poId, projectId: cur.projectId, data: { total } });
    return { id: poId };
  });
}

export async function setPurchaseOrderStatus(actor: Actor, id: string, input: unknown) {
  const d = z.object({ status: z.enum(["OPEN", "CLOSED", "VOID"]), reason: zReason }).parse(input);
  assertCan(actor, d.status === "VOID" ? "record.void" : "finance.write");
  const poId = zId.parse(id);
  return inTx(async (tx) => {
    const [cur] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).for("update").limit(1);
    if (!cur) throw notFound("Purchase order");
    await assertProjectAccess(tx, actor, cur.projectId, { write: true });
    if (cur.status === "VOID") throw rule("A void purchase order cannot change.");
    if (cur.status === d.status) throw rule("The purchase order already has this status.");
    await tx.update(purchaseOrders).set({ status: d.status, statusReason: d.reason, statusBy: actor.id, statusAt: new Date() }).where(eq(purchaseOrders.id, poId));
    await audit(tx, actor, { action: d.status === "VOID" ? "void" : "status", entity: "purchase_order", entityId: poId, projectId: cur.projectId, reason: d.reason, data: { to: d.status } });
    return { id: poId };
  });
}

export async function listPurchaseOrders(actor: Actor, query: unknown) {
  assertCan(actor, "finance.read");
  const q = z.object({ page: zPage.optional().default(1), projectId: zOptionalId, status: z.enum(["OPEN", "CLOSED", "VOID", "ALL"]).optional().catch("ALL") }).parse(query);
  const db = getDb();
  const { limit, offset, page } = pageWindow(q.page);
  const where = and(q.projectId ? eq(purchaseOrders.projectId, q.projectId) : undefined, q.status && q.status !== "ALL" ? eq(purchaseOrders.status, q.status) : undefined);
  const rows = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      date: purchaseOrders.date,
      status: purchaseOrders.status,
      projectId: purchaseOrders.projectId,
      projectName: projects.name,
      vendorName: vendors.name,
      total: sql<string>`(select coalesce(sum(${purchaseOrderLines.amount}),0) from ${purchaseOrderLines} where ${purchaseOrderLines.purchaseOrderId} = ${purchaseOrders.id})`,
    })
    .from(purchaseOrders)
    .innerJoin(projects, eq(projects.id, purchaseOrders.projectId))
    .innerJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
    .where(where)
    .orderBy(desc(purchaseOrders.date), desc(purchaseOrders.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(purchaseOrders).where(where);
  return paged(rows.map((r) => ({ ...r, total: paiseFromDb(r.total) })), total, page);
}

export async function purchaseOrderOptions(actor: Actor, projectId: string) {
  assertCan(actor, "project.read");
  const db = getDb();
  await assertProjectAccess(db, actor, zId.parse(projectId));
  return db
    .select({ id: purchaseOrders.id, number: purchaseOrders.number, vendorId: purchaseOrders.vendorId })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.projectId, projectId), eq(purchaseOrders.status, "OPEN")))
    .orderBy(desc(purchaseOrders.date));
}

export async function getPurchaseOrder(actor: Actor, id: string) {
  assertCan(actor, "finance.read");
  const db = getDb();
  const [po] = await db
    .select({ po: purchaseOrders, projectName: projects.name, vendorName: vendors.name })
    .from(purchaseOrders)
    .innerJoin(projects, eq(projects.id, purchaseOrders.projectId))
    .innerJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
    .where(eq(purchaseOrders.id, zId.parse(id)))
    .limit(1);
  if (!po) throw notFound("Purchase order");
  await assertProjectAccess(db, actor, po.po.projectId);
  const lines = await db
    .select({ id: purchaseOrderLines.id, materialId: purchaseOrderLines.materialId, name: materials.name, unit: materials.unit, qty: purchaseOrderLines.qty, rate: purchaseOrderLines.rate, amount: purchaseOrderLines.amount })
    .from(purchaseOrderLines)
    .innerJoin(materials, eq(materials.id, purchaseOrderLines.materialId))
    .where(eq(purchaseOrderLines.purchaseOrderId, po.po.id));
  const received = await db
    .select({ materialId: materialReceipts.materialId, qty: sql<string>`coalesce(sum(${materialReceipts.qty}),0)` })
    .from(materialReceipts)
    .where(and(eq(materialReceipts.purchaseOrderId, po.po.id), eq(materialReceipts.status, "ACTIVE")))
    .groupBy(materialReceipts.materialId);
  const history = await auditTrail(db, "purchase_order", po.po.id);
  return {
    ...po.po,
    projectName: po.projectName,
    vendorName: po.vendorName,
    lines: lines.map((l) => ({
      ...l,
      qty: qtyFromDb(l.qty),
      rate: paiseFromDb(l.rate),
      amount: paiseFromDb(l.amount),
      received: qtyFromDb(received.find((r) => r.materialId === l.materialId)?.qty ?? "0"),
    })),
    total: sumPaise(lines.map((l) => paiseFromDb(l.amount))),
    history,
  };
}

export async function getUsage(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const db = getDb();
  const [row] = await db
    .select({
      id: materialUsages.id,
      date: materialUsages.date,
      qty: materialUsages.qty,
      phase: materialUsages.phase,
      notes: materialUsages.notes,
      status: materialUsages.status,
      voidReason: materialUsages.voidReason,
      projectId: materialUsages.projectId,
      projectName: projects.name,
      materialId: materialUsages.materialId,
      materialName: materials.name,
      unit: materials.unit,
      slabId: materialUsages.slabId,
      slabName: slabs.name,
      activityId: materialUsages.activityId,
      activityName: activities.name,
      createdByName: users.name,
    })
    .from(materialUsages)
    .innerJoin(projects, eq(projects.id, materialUsages.projectId))
    .innerJoin(materials, eq(materials.id, materialUsages.materialId))
    .leftJoin(slabs, eq(slabs.id, materialUsages.slabId))
    .leftJoin(activities, eq(activities.id, materialUsages.activityId))
    .leftJoin(users, eq(users.id, materialUsages.createdBy))
    .where(eq(materialUsages.id, zId.parse(id)))
    .limit(1);
  if (!row) throw notFound("Usage entry");
  await assertProjectAccess(db, actor, row.projectId);
  const history = await auditTrail(db, "usage", row.id);
  return { ...row, qty: qtyFromDb(row.qty), history };
}
