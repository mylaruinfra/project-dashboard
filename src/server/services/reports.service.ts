/** Read-only reports. Money reports need finance.read; none of them forecast. */
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { areaFromDb } from "@/lib/area";
import { PHASES, TXN_TYPES, type Phase, type TxnType } from "@/lib/domain";
import { costPerSft } from "@/lib/estimate";
import { paiseFromDb } from "@/lib/money";
import { qtyFromDb } from "@/lib/qty";
import { zDate, zOptionalId } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { getDb } from "../db/client";
import { clients, phaseBudgets, projects, slabs, transactions, vendors } from "../db/schema";
import { assertCan, assertProjectAccess } from "../permissions";
import { kpisForProjects, pendingByProjectVendor } from "./kpis";
import { stockLines } from "./stock.service";

const filter = z.object({ projectId: zOptionalId.catch(undefined), from: zDate.optional().catch(undefined), to: zDate.optional().catch(undefined) });

async function projectIdsFor(actor: Actor, projectId?: string) {
  const db = getDb();
  if (projectId) {
    await assertProjectAccess(db, actor, projectId);
    return [projectId];
  }
  const rows = await db.select({ id: projects.id }).from(projects).where(ne(projects.status, "ARCHIVED"));
  return rows.map((r) => r.id);
}

const COST_TYPES: TxnType[] = ["LABOR", "MATERIAL", "MACHINERY", "LOGISTICS", "SITE_EXPENSE", "OTHER"];

/** Actual cost by type and by phase, with phase budgets. */
export async function costAnalysis(actor: Actor, query: unknown) {
  assertCan(actor, "finance.read");
  const q = filter.parse(query);
  const ids = await projectIdsFor(actor, q.projectId);
  const db = getDb();
  if (!ids.length) return { byType: [], byPhase: [], total: 0 };
  const where = and(
    inArray(transactions.projectId, ids),
    eq(transactions.status, "ACTIVE"),
    inArray(transactions.type, COST_TYPES),
    q.from ? sql`${transactions.date} >= ${q.from}` : undefined,
    q.to ? sql`${transactions.date} <= ${q.to}` : undefined,
  );
  const byTypeRows = await db.select({ type: transactions.type, amount: sql<string>`sum(${transactions.amount})` }).from(transactions).where(where).groupBy(transactions.type);
  const byPhaseRows = await db.select({ phase: transactions.phase, amount: sql<string>`sum(${transactions.amount})` }).from(transactions).where(where).groupBy(transactions.phase);
  const budgetRows = await db.select({ phase: phaseBudgets.phase, amount: sql<string>`sum(${phaseBudgets.amount})` }).from(phaseBudgets).where(inArray(phaseBudgets.projectId, ids)).groupBy(phaseBudgets.phase);
  const byType = TXN_TYPES.filter((t) => COST_TYPES.includes(t)).map((t) => ({ type: t, amount: paiseFromDb(byTypeRows.find((r) => r.type === t)?.amount ?? "0") }));
  const total = byType.reduce((a, b) => a + b.amount, 0);
  const byPhase: { phase: Phase | null; amount: number; budget: number | null }[] = [
    ...PHASES.map((p) => ({
      phase: p as Phase | null,
      amount: paiseFromDb(byPhaseRows.find((r) => r.phase === p)?.amount ?? "0"),
      budget: budgetRows.find((b) => b.phase === p) ? paiseFromDb(budgetRows.find((b) => b.phase === p)!.amount) : null,
    })),
    { phase: null, amount: paiseFromDb(byPhaseRows.find((r) => r.phase === null)?.amount ?? "0"), budget: null },
  ];
  return { byType, byPhase, total };
}

/** Cost per SFT across projects: estimated vs actual. */
export async function projectComparison(actor: Actor) {
  assertCan(actor, "finance.read");
  const db = getDb();
  const rows = await db
    .select({ id: projects.id, name: projects.name, code: projects.code, status: projects.status, type: projects.type })
    .from(projects)
    .where(ne(projects.status, "ARCHIVED"));
  const ids = rows.map((r) => r.id);
  const kpis = await kpisForProjects(db, ids);
  const areas = ids.length
    ? await db.select({ projectId: slabs.projectId, area: sql<string>`sum(${slabs.area})` }).from(slabs).where(inArray(slabs.projectId, ids)).groupBy(slabs.projectId)
    : [];
  return rows.map((r) => {
    const k = kpis.get(r.id)!;
    const area = areaFromDb(areas.find((a) => a.projectId === r.id)?.area ?? "0");
    return {
      ...r,
      area,
      estimatedCost: k.estimatedCost,
      actualCost: k.actualCost,
      estimatedPerSft: costPerSft(k.estimatedCost, area),
      actualPerSft: costPerSft(k.actualCost, area),
      spentPct: k.estimatedCost > 0 ? Math.round((k.actualCost * 100) / k.estimatedCost) : null,
    };
  });
}

export async function materialReport(actor: Actor, query: unknown) {
  assertCan(actor, "finance.read");
  const q = filter.parse(query);
  const ids = await projectIdsFor(actor, q.projectId);
  return stockLines(getDb(), ids, true);
}

/** Labor: attendance cost by labor type, and per party attendance vs payments. */
export async function laborReport(actor: Actor, query: unknown) {
  assertCan(actor, "finance.read");
  const q = filter.parse(query);
  const ids = await projectIdsFor(actor, q.projectId);
  const db = getDb();
  if (!ids.length) return { byType: [], byParty: [] };
  const base = and(inArray(transactions.projectId, ids), eq(transactions.status, "ACTIVE"));
  const byType = await db
    .select({
      laborType: transactions.laborType,
      manDays: sql<string>`coalesce(sum(${transactions.qty}),0)`,
      amount: sql<string>`coalesce(sum(${transactions.amount}),0)`,
    })
    .from(transactions)
    .where(and(base, eq(transactions.type, "LABOR")))
    .groupBy(transactions.laborType);
  const byPartyRows = await db
    .select({
      vendorId: transactions.vendorId,
      name: vendors.name,
      attendance: sql<string>`coalesce(sum(case when ${transactions.type} = 'LABOR' then ${transactions.amount} else 0 end),0)`,
      paid: sql<string>`coalesce(sum(case when ${transactions.type} = 'CONTRACTOR_PAYMENT' then ${transactions.amount} else 0 end),0)`,
    })
    .from(transactions)
    .innerJoin(vendors, eq(vendors.id, transactions.vendorId))
    .where(and(base, inArray(transactions.type, ["LABOR", "CONTRACTOR_PAYMENT"])))
    .groupBy(transactions.vendorId, vendors.name);
  return {
    byType: byType.map((r) => ({ laborType: r.laborType ?? "—", manDays: qtyFromDb(r.manDays), amount: paiseFromDb(r.amount) })),
    byParty: byPartyRows
      .map((r) => ({ vendorId: r.vendorId!, name: r.name, attendance: paiseFromDb(r.attendance), paid: paiseFromDb(r.paid) }))
      .filter((r) => r.attendance > 0)
      .map((r) => ({ ...r, pending: r.attendance - r.paid })),
  };
}

/** Per project: contract value, received, balance, cost, pending payments. */
export async function financialReport(actor: Actor) {
  assertCan(actor, "finance.read");
  const db = getDb();
  const rows = await db
    .select({ id: projects.id, name: projects.name, code: projects.code, clientName: clients.name })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(ne(projects.status, "ARCHIVED"));
  const kpis = await kpisForProjects(db, rows.map((r) => r.id));
  const pending = await pendingByProjectVendor(db, rows.map((r) => r.id));
  const advances = new Map<string, number>();
  for (const p of pending) if (p.pending < 0) advances.set(p.projectId, (advances.get(p.projectId) ?? 0) - p.pending);
  return rows.map((r) => ({ ...r, ...kpis.get(r.id)!, advances: advances.get(r.id) ?? 0 }));
}
