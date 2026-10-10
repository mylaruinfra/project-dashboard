import { aliasedTable, and, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { parseScaledDecimal, scaledToDecimal } from "@/lib/indian-number";
import { PHASES, TXN_TYPES, type TxnType } from "@/lib/domain";
import { paiseFromDb, paiseToDb } from "@/lib/money";
import { qtyFromDb, qtyToDb } from "@/lib/qty";
import { resolveTxn, type ResolvedTxn, type TxnDraftInput } from "@/lib/txn-rules";
import { zDate, zId, zMoney, zOptionalId, zPage, zQty, zReason, zText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { nextNumber } from "../counters";
import { type DbOrTx, getDb, type Tx } from "../db/client";
import { auditLogs, documents, floors, laborRates, materials, projects, purchaseOrders, slabs, transactions, users, vendors } from "../db/schema";
import { AppError, forbidden, notFound, rule } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan, assertProjectAccess, can, canSeeMoney } from "../permissions";
import { inTx } from "../tx";
import { pendingByProjectVendor } from "./kpis";
import { projectScopeFilter } from "./scope";

/* ---------- input ---------- */

const opt = <T extends z.ZodType>(s: T) =>
  z
    .union([s, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null ? undefined : (v as z.output<T>)));

const zDays = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const d = parseScaledDecimal(v, 2);
  if (d === null || d <= 0) {
    ctx.addIssue({ code: "custom", message: "Enter days worked, e.g. 1 or 0.5" });
    return z.NEVER;
  }
  return d;
});

export const txnInput = z.object({
  projectId: zId,
  type: z.enum(TXN_TYPES, { message: "Pick what happened" }),
  date: zDate,
  item: zText(200),
  spec: zText(200),
  materialId: zOptionalId,
  qty: opt(zQty),
  unit: zText(20),
  rate: opt(zMoney),
  amount: opt(zMoney),
  vendorId: zOptionalId,
  phase: opt(z.enum(PHASES)),
  slabId: zOptionalId,
  location: zText(100),
  laborType: zText(50),
  workers: opt(z.coerce.number().int("Whole number of workers").min(1, "At least 1 worker").max(1000)),
  days: opt(zDays),
  billNo: zText(50),
  paidNow: z.boolean().optional().default(false),
  paymentMode: zText(30),
  purchaseOrderId: zOptionalId,
  notes: zText(1000),
});
export type TxnInput = z.input<typeof txnInput>;

export const txnUpdateInput = txnInput.omit({ projectId: true, type: true });

const listQuery = z.object({
  page: zPage.optional().default(1),
  projectId: zOptionalId,
  type: opt(z.enum(TXN_TYPES)),
  phase: opt(z.enum(PHASES)),
  slabId: zOptionalId,
  vendorId: zOptionalId,
  from: opt(zDate),
  to: opt(zDate),
  status: z.enum(["ACTIVE", "VOID", "ALL"]).optional().catch("ACTIVE"),
  q: zText(100).catch(undefined),
});
export type TxnListQuery = z.input<typeof listQuery>;

/* ---------- shared write path ---------- */

async function loadContext(db: DbOrTx, projectId: string, d: TxnDraftInput) {
  const ctx: { materialName?: string; materialUnit?: string; vendorName?: string } = {};
  if (d.materialId) {
    const [m] = await db.select().from(materials).where(eq(materials.id, d.materialId)).limit(1);
    if (!m) throw new AppError("VALIDATION", "Pick the material", { materialId: "Pick the material" });
    if (m.status !== "ACTIVE") throw rule("This material is inactive.", { materialId: "This material is inactive" });
    ctx.materialName = m.name;
    ctx.materialUnit = m.unit;
  }
  if (d.vendorId) {
    const [v] = await db.select().from(vendors).where(eq(vendors.id, d.vendorId)).limit(1);
    if (!v) throw new AppError("VALIDATION", "Pick the vendor", { vendorId: "Pick the vendor" });
    if (v.status !== "ACTIVE") throw rule("This vendor is inactive.", { vendorId: "This vendor is inactive" });
    ctx.vendorName = v.name;
  }
  if (d.slabId) {
    const [s] = await db.select({ projectId: slabs.projectId }).from(slabs).where(eq(slabs.id, d.slabId)).limit(1);
    if (!s || s.projectId !== projectId) throw rule("Pick a slab from this project.", { slabId: "Pick a slab from this project" });
  }
  if (d.purchaseOrderId) {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, d.purchaseOrderId)).limit(1);
    if (!po || po.projectId !== projectId) throw rule("Pick a purchase order from this project.", { purchaseOrderId: "Pick a purchase order from this project" });
    if (po.status === "VOID") throw rule("This purchase order is void.", { purchaseOrderId: "This purchase order is void" });
  }
  return ctx;
}

async function laborRateFor(db: DbOrTx, laborType: string | undefined): Promise<number | undefined> {
  if (!laborType) return undefined;
  const [r] = await db.select().from(laborRates).where(eq(laborRates.laborType, laborType)).limit(1);
  return r && r.status === "ACTIVE" ? paiseFromDb(r.rate) : undefined;
}

function resolveOrThrow(d: TxnDraftInput, ctx: Parameters<typeof resolveTxn>[1]): ResolvedTxn {
  const r = resolveTxn(d, ctx);
  if (!r.ok) throw new AppError("VALIDATION", Object.keys(r.errors).length > 1 ? "Check the highlighted fields." : Object.values(r.errors)[0]!, r.errors);
  return r.value;
}

function toRow(v: ResolvedTxn) {
  return {
    type: v.type,
    date: v.date,
    item: v.item,
    spec: v.spec,
    materialId: v.materialId,
    qty: v.qty === null ? null : qtyToDb(v.qty),
    unit: v.unit,
    rate: v.rate === null ? null : paiseToDb(v.rate),
    amount: paiseToDb(v.amount),
    vendorId: v.vendorId,
    phase: v.phase,
    slabId: v.slabId,
    location: v.location,
    laborType: v.laborType,
    workers: v.workers,
    days: v.days === null ? null : scaledToDecimal(v.days, 2),
    billNo: v.billNo,
    billLine: v.billLine,
    paidNow: v.paidNow,
    paymentMode: v.paymentMode,
    purchaseOrderId: v.purchaseOrderId,
    notes: v.notes,
  };
}

/**
 * Inserts a transaction inside an existing db.transaction. Used by createTransaction and by the
 * AI-draft confirm step so both follow exactly the same rules.
 */
export async function insertTransaction(
  tx: Tx,
  actor: Actor,
  projectId: string,
  d: TxnDraftInput,
  meta: { source?: "MANUAL" | "AI"; aiDraftId?: string } = {},
) {
  const project = await assertProjectAccess(tx, actor, projectId, { write: true, lock: true });
  if (actor.role === "ENGINEER") {
    if (d.type !== "LABOR") throw forbidden("Engineers can only record labor attendance.");
    // Engineers never see or set money: the rate comes from the labor rate card.
    const rate = await laborRateFor(tx, d.laborType);
    if (!rate) throw rule(`No daily rate is set for "${d.laborType ?? "this labor type"}". Ask a manager to add it in Settings.`, { laborType: "No rate set for this labor type" });
    d = { ...d, rate };
  } else {
    assertCan(actor, "finance.write");
  }
  const ctx = await loadContext(tx, projectId, d);
  const v = resolveOrThrow(d, ctx);
  const number = await nextNumber(tx, "txn", "TXN");
  const [row] = await tx
    .insert(transactions)
    .values({
      ...toRow(v),
      number,
      projectId,
      clientId: v.type === "CLIENT_PAYMENT" ? project.clientId : null,
      source: meta.source ?? "MANUAL",
      aiDraftId: meta.aiDraftId ?? null,
      createdBy: actor.id,
    })
    .returning({ id: transactions.id, number: transactions.number });
  await audit(tx, actor, { action: "create", entity: "transaction", entityId: row!.id, projectId, data: { number, type: v.type, amount: v.amount, source: meta.source ?? "MANUAL" } });
  return { id: row!.id, number: row!.number, amount: v.amount };
}

function draftFromInput(data: z.output<typeof txnUpdateInput>, type: TxnType): TxnDraftInput {
  return {
    type,
    date: data.date,
    item: data.item,
    spec: data.spec,
    materialId: data.materialId,
    qty: data.qty,
    unit: data.unit,
    rate: data.rate,
    amount: data.amount,
    vendorId: data.vendorId,
    phase: data.phase,
    slabId: data.slabId,
    location: data.location,
    laborType: data.laborType,
    workers: data.workers,
    days: data.days,
    billNo: data.billNo,
    paidNow: data.paidNow,
    paymentMode: data.paymentMode,
    purchaseOrderId: data.purchaseOrderId,
    notes: data.notes,
  };
}

/* ---------- commands ---------- */

export async function createTransaction(actor: Actor, input: unknown) {
  const data = txnInput.parse(input);
  if (!can(actor, "finance.write") && !(actor.role === "ENGINEER" && data.type === "LABOR")) throw forbidden();
  return inTx((tx) => insertTransaction(tx, actor, data.projectId, draftFromInput(data, data.type)));
}

export async function updateTransaction(actor: Actor, id: string, input: unknown) {
  const data = txnUpdateInput.parse(input);
  const txnId = zId.parse(id);
  return inTx(async (tx) => {
    const [cur] = await tx.select().from(transactions).where(eq(transactions.id, txnId)).for("update").limit(1);
    if (!cur) throw notFound("Transaction");
    await assertProjectAccess(tx, actor, cur.projectId, { write: true });
    if (cur.status === "VOID") throw rule("A void transaction cannot be edited.");
    let d = draftFromInput(data, cur.type);
    if (actor.role === "ENGINEER") {
      if (cur.type !== "LABOR") throw forbidden();
      // keep the stored rate unless the labor type changed
      const rate = d.laborType === cur.laborType ? paiseFromDb(cur.rate) : await laborRateFor(tx, d.laborType);
      if (!rate) throw rule("No daily rate is set for this labor type.", { laborType: "No rate set for this labor type" });
      d = { ...d, rate };
    } else {
      assertCan(actor, "finance.write");
    }
    d.billLine = cur.billLine;
    const ctx = await loadContext(tx, cur.projectId, d);
    const v = resolveOrThrow(d, ctx);
    await tx
      .update(transactions)
      .set({ ...toRow(v), updatedAt: new Date() })
      .where(eq(transactions.id, txnId));
    await audit(tx, actor, {
      action: "update",
      entity: "transaction",
      entityId: txnId,
      projectId: cur.projectId,
      data: { before: { amount: paiseFromDb(cur.amount), date: cur.date, item: cur.item }, after: { amount: v.amount, date: v.date, item: v.item } },
    });
    return { id: txnId };
  });
}

export async function voidTransaction(actor: Actor, id: string, input: unknown) {
  const { reason } = z.object({ reason: zReason }).parse(input);
  assertCan(actor, "record.void");
  const txnId = zId.parse(id);
  return inTx(async (tx) => {
    const [cur] = await tx.select().from(transactions).where(eq(transactions.id, txnId)).for("update").limit(1);
    if (!cur) throw notFound("Transaction");
    await assertProjectAccess(tx, actor, cur.projectId, { write: true });
    if (cur.status === "VOID") throw rule("This transaction is already void.");
    await tx
      .update(transactions)
      .set({ status: "VOID", voidReason: reason, voidedBy: actor.id, voidedAt: new Date(), updatedAt: new Date() })
      .where(eq(transactions.id, txnId));
    await audit(tx, actor, { action: "void", entity: "transaction", entityId: txnId, projectId: cur.projectId, reason, data: { number: cur.number, amount: paiseFromDb(cur.amount) } });
    return { id: txnId };
  });
}

/* ---------- reads ---------- */

const creator = aliasedTable(users, "creator");
const voider = aliasedTable(users, "voider");

type MoneyCols = { amount: string; rate: string | null; qty: string | null; days: string | null };
type Presented<R extends MoneyCols> = Omit<R, keyof MoneyCols> & { amount: number | null; rate: number | null; qty: number | null; days: number | null };

function present<R extends MoneyCols>(actor: Actor, r: R): Presented<R> {
  const money = canSeeMoney(actor);
  return {
    ...r,
    amount: money ? paiseFromDb(r.amount) : null,
    rate: money && r.rate !== null ? paiseFromDb(r.rate) : null,
    qty: r.qty === null ? null : qtyFromDb(r.qty),
    days: r.days === null ? null : parseScaledDecimal(r.days, 2),
  };
}

const listCols = {
  id: transactions.id,
  number: transactions.number,
  projectId: transactions.projectId,
  projectName: projects.name,
  type: transactions.type,
  date: transactions.date,
  item: transactions.item,
  spec: transactions.spec,
  qty: transactions.qty,
  unit: transactions.unit,
  rate: transactions.rate,
  amount: transactions.amount,
  days: transactions.days,
  workers: transactions.workers,
  laborType: transactions.laborType,
  paidNow: transactions.paidNow,
  phase: transactions.phase,
  slabId: transactions.slabId,
  slabName: slabs.name,
  floorName: floors.name,
  vendorId: transactions.vendorId,
  vendorName: vendors.name,
  billNo: transactions.billNo,
  source: transactions.source,
  status: transactions.status,
};

export async function listTransactions(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = listQuery.parse(query);
  if (q.projectId) await assertProjectAccess(getDb(), actor, q.projectId);
  // Engineers only see labor attendance (without money).
  const engineer = actor.role === "ENGINEER";
  const { limit, offset, page } = pageWindow(q.page);
  const status = q.status ?? "ACTIVE";
  const where: SQL | undefined = and(
    await projectScopeFilter(actor, transactions.projectId),
    engineer ? eq(transactions.type, "LABOR") : undefined,
    q.projectId ? eq(transactions.projectId, q.projectId) : undefined,
    q.type ? eq(transactions.type, q.type) : undefined,
    q.phase ? eq(transactions.phase, q.phase) : undefined,
    q.slabId ? eq(transactions.slabId, q.slabId) : undefined,
    q.vendorId ? eq(transactions.vendorId, q.vendorId) : undefined,
    q.from ? gte(transactions.date, q.from) : undefined,
    q.to ? lte(transactions.date, q.to) : undefined,
    status === "ALL" ? undefined : eq(transactions.status, status),
    q.q ? or(ilike(transactions.item, `%${q.q}%`), ilike(transactions.number, `%${q.q}%`), ilike(transactions.billNo, `%${q.q}%`)) : undefined,
  );
  const db = getDb();
  const rows = await db
    .select(listCols)
    .from(transactions)
    .innerJoin(projects, eq(projects.id, transactions.projectId))
    .leftJoin(slabs, eq(slabs.id, transactions.slabId))
    .leftJoin(floors, eq(floors.id, slabs.floorId))
    .leftJoin(vendors, eq(vendors.id, transactions.vendorId))
    .where(where)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(transactions).where(where);
  return paged(rows.map((r) => present(actor, r)), total, page);
}

export type TxnListRow = Awaited<ReturnType<typeof listTransactions>>["rows"][number];

export async function getTransaction(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const db = getDb();
  const [r] = await db
    .select({
      ...listCols,
      materialId: transactions.materialId,
      purchaseOrderId: transactions.purchaseOrderId,
      poNumber: purchaseOrders.number,
      location: transactions.location,
      paymentMode: transactions.paymentMode,
      notes: transactions.notes,
      aiDraftId: transactions.aiDraftId,
      voidReason: transactions.voidReason,
      voidedAt: transactions.voidedAt,
      voidedByName: voider.name,
      createdAt: transactions.createdAt,
      createdByName: creator.name,
    })
    .from(transactions)
    .innerJoin(projects, eq(projects.id, transactions.projectId))
    .leftJoin(slabs, eq(slabs.id, transactions.slabId))
    .leftJoin(floors, eq(floors.id, slabs.floorId))
    .leftJoin(vendors, eq(vendors.id, transactions.vendorId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, transactions.purchaseOrderId))
    .leftJoin(creator, eq(creator.id, transactions.createdBy))
    .leftJoin(voider, eq(voider.id, transactions.voidedBy))
    .where(eq(transactions.id, zId.parse(id)))
    .limit(1);
  if (!r) throw notFound("Transaction");
  await assertProjectAccess(db, actor, r.projectId);
  if (actor.role === "ENGINEER" && r.type !== "LABOR") throw forbidden();
  const docs = await db
    .select({ id: documents.id, title: documents.title, kind: documents.kind, mimeType: documents.mimeType })
    .from(documents)
    .where(and(eq(documents.entityType, "transaction"), eq(documents.entityId, r.id), eq(documents.status, "ACTIVE")));
  const history = await auditTrail(db, "transaction", r.id);
  return { ...present(actor, r), documents: canSeeMoney(actor) ? docs : docs.filter((d) => d.kind !== "BILL"), history };
}

export type TxnDetail = Awaited<ReturnType<typeof getTransaction>>;

export async function auditTrail(db: DbOrTx, entity: string, entityId: string) {
  return db
    .select({ id: auditLogs.id, action: auditLogs.action, reason: auditLogs.reason, at: auditLogs.at, byName: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(and(eq(auditLogs.entity, entity), eq(auditLogs.entityId, entityId)))
    .orderBy(desc(auditLogs.at))
    .limit(20);
}

/** Pending payments per vendor / labor party, with names. Money only. */
export async function listPendingPayments(actor: Actor, query: unknown) {
  assertCan(actor, "finance.read");
  const q = z.object({ projectId: zOptionalId, page: zPage.optional().default(1) }).parse(query);
  const db = getDb();
  if (q.projectId) await assertProjectAccess(db, actor, q.projectId);
  const rows = await pendingByProjectVendor(db, q.projectId ? [q.projectId] : undefined);
  const vendorRows = await db.select({ id: vendors.id, name: vendors.name, type: vendors.type }).from(vendors);
  const projectRows = await db.select({ id: projects.id, name: projects.name }).from(projects);
  const all = rows
    .filter((r) => r.pending !== 0 || r.paid !== 0 || r.incurred !== 0)
    .map((r) => {
      const v = vendorRows.find((x) => x.id === r.vendorId);
      return {
        ...r,
        vendorName: v?.name ?? "",
        vendorType: v?.type ?? "OTHER",
        projectName: projectRows.find((p) => p.id === r.projectId)?.name ?? "",
      };
    })
    .sort((a, b) => b.pending - a.pending);
  const { limit, offset, page } = pageWindow(q.page);
  return paged(all.slice(offset, offset + limit), all.length, page);
}
