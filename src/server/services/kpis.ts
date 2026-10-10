/**
 * Cost and payment aggregates. All sums ignore VOID rows.
 *
 *   actual cost      = expense transactions + labor attendance (+ machinery, which is an expense type)
 *   client received  = CLIENT_PAYMENT
 *   pending payments = per vendor: unpaid costs (paid_now = false) − CONTRACTOR_PAYMENT, counted when > 0
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { COST_TXN_TYPES, EXPENSE_TXN_TYPES } from "@/lib/domain";
import { projectKpis, type ProjectKpis } from "@/lib/estimate";
import { paiseFromDb } from "@/lib/money";
import type { Actor } from "../auth/actor";
import { type DbOrTx, getDb } from "../db/client";
import { projects, transactions } from "../db/schema";
import { canSeeMoney } from "../permissions";

const sumWhere = (cond: ReturnType<typeof sql>) => sql<string>`coalesce(sum(case when ${cond} then ${transactions.amount} else 0 end), 0)`;
const inList = (types: readonly string[]) => sql`${transactions.type} in (${sql.join(types.map((t) => sql`${t}`), sql`, `)})`;

export interface CostTotals {
  expenseCost: number;
  laborCost: number;
  machineryCost: number;
  clientReceived: number;
  contractorPaid: number;
  pendingPayments: number;
}

const ZERO: CostTotals = { expenseCost: 0, laborCost: 0, machineryCost: 0, clientReceived: 0, contractorPaid: 0, pendingPayments: 0 };

export async function costTotalsByProject(db: DbOrTx, projectIds: string[]): Promise<Map<string, CostTotals>> {
  const out = new Map<string, CostTotals>();
  if (projectIds.length === 0) return out;
  const rows = await db
    .select({
      projectId: transactions.projectId,
      expense: sumWhere(inList(EXPENSE_TXN_TYPES)),
      labor: sumWhere(sql`${transactions.type} = 'LABOR'`),
      machinery: sumWhere(sql`${transactions.type} = 'MACHINERY'`),
      client: sumWhere(sql`${transactions.type} = 'CLIENT_PAYMENT'`),
      paid: sumWhere(sql`${transactions.type} = 'CONTRACTOR_PAYMENT'`),
    })
    .from(transactions)
    .where(and(inArray(transactions.projectId, projectIds), eq(transactions.status, "ACTIVE")))
    .groupBy(transactions.projectId);
  for (const id of projectIds) out.set(id, { ...ZERO });
  for (const r of rows) {
    out.set(r.projectId, {
      expenseCost: paiseFromDb(r.expense),
      laborCost: paiseFromDb(r.labor),
      machineryCost: paiseFromDb(r.machinery),
      clientReceived: paiseFromDb(r.client),
      contractorPaid: paiseFromDb(r.paid),
      pendingPayments: 0,
    });
  }
  const pending = await pendingByProjectVendor(db, projectIds);
  for (const p of pending) {
    const t = out.get(p.projectId);
    if (t && p.pending > 0) t.pendingPayments += p.pending;
  }
  return out;
}

/** Per project + vendor: incurred (unpaid) − paid. Negative means an advance. */
export async function pendingByProjectVendor(db: DbOrTx, projectIds?: string[], vendorId?: string) {
  const rows = await db
    .select({
      projectId: transactions.projectId,
      vendorId: transactions.vendorId,
      incurred: sumWhere(sql`${inList(COST_TXN_TYPES)} and ${transactions.paidNow} = false`),
      incurredAll: sumWhere(inList(COST_TXN_TYPES)),
      paid: sumWhere(sql`${transactions.type} = 'CONTRACTOR_PAYMENT'`),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "ACTIVE"),
        isNotNull(transactions.vendorId),
        projectIds ? inArray(transactions.projectId, projectIds) : undefined,
        vendorId ? eq(transactions.vendorId, vendorId) : undefined,
      ),
    )
    .groupBy(transactions.projectId, transactions.vendorId);
  return rows.map((r) => {
    const incurred = paiseFromDb(r.incurred);
    const paid = paiseFromDb(r.paid);
    return {
      projectId: r.projectId,
      vendorId: r.vendorId!,
      incurred,
      incurredAll: paiseFromDb(r.incurredAll),
      paid,
      pending: incurred - paid,
    };
  });
}

export async function kpisForProjects(db: DbOrTx, projectIds: string[]): Promise<Map<string, ProjectKpis & { laborCost: number; machineryCost: number }>> {
  const out = new Map<string, ProjectKpis & { laborCost: number; machineryCost: number }>();
  if (projectIds.length === 0) return out;
  const [totals, projRows] = await Promise.all([
    costTotalsByProject(db, projectIds),
    db
      .select({ id: projects.id, estimatedCost: projects.estimatedCost, contractValue: projects.contractValue })
      .from(projects)
      .where(inArray(projects.id, projectIds)),
  ]);
  for (const p of projRows) {
    const t = totals.get(p.id) ?? ZERO;
    out.set(p.id, {
      ...projectKpis({
        estimatedCost: paiseFromDb(p.estimatedCost),
        contractValue: p.contractValue === null ? null : paiseFromDb(p.contractValue),
        expenseCost: t.expenseCost,
        laborCost: t.laborCost,
        clientReceived: t.clientReceived,
        pendingPayments: t.pendingPayments,
      }),
      laborCost: t.laborCost,
      machineryCost: t.machineryCost,
    });
  }
  return out;
}

/** KPIs for one project, or null when the actor may not see money. */
export async function projectKpisFor(actor: Actor, projectId: string) {
  if (!canSeeMoney(actor)) return null;
  const m = await kpisForProjects(getDb(), [projectId]);
  return m.get(projectId) ?? null;
}
