/**
 * Pure rules for building a transaction from form input. Shared by the transactions service,
 * the AI-draft confirm step and unit tests. No database access here.
 */
import { COST_TXN_TYPES, TXN_FIELDS, type Phase, type TxnField, type TxnType } from "./domain";
import { mulQtyRate } from "./money";

export interface TxnDraftInput {
  type: TxnType;
  date: string;
  item?: string;
  spec?: string;
  materialId?: string;
  qty?: number; // milli
  unit?: string;
  rate?: number; // paise
  amount?: number; // paise (used when not auto-calculated)
  vendorId?: string;
  phase?: Phase;
  slabId?: string;
  location?: string;
  laborType?: string;
  workers?: number;
  days?: number; // centi-days (1.5 days = 150)
  billNo?: string;
  billLine?: number;
  paidNow?: boolean;
  paymentMode?: string;
  purchaseOrderId?: string;
  notes?: string;
}

export interface TxnContext {
  materialName?: string;
  materialUnit?: string;
  vendorName?: string;
}

export interface ResolvedTxn {
  type: TxnType;
  date: string;
  item: string;
  spec: string | null;
  materialId: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null;
  amount: number;
  vendorId: string | null;
  phase: Phase | null;
  slabId: string | null;
  location: string | null;
  laborType: string | null;
  workers: number | null;
  days: number | null;
  billNo: string | null;
  billLine: number;
  paidNow: boolean;
  paymentMode: string | null;
  purchaseOrderId: string | null;
  notes: string | null;
}

export type FieldErrors = Record<string, string>;

/** workers × days (centi) × rate (paise) → paise */
export function laborAmount(workers: number, daysCenti: number, ratePaise: number): number {
  const p = BigInt(workers) * BigInt(daysCenti) * BigInt(ratePaise);
  return Number((p + 50n) / 100n);
}

export function isCostType(t: TxnType): boolean {
  return (COST_TXN_TYPES as readonly string[]).includes(t);
}

/**
 * Keeps only the fields the type uses, computes the amount and checks required fields.
 * Returns field errors instead of throwing so the UI can highlight them.
 */
export function resolveTxn(d: TxnDraftInput, ctx: TxnContext = {}): { ok: true; value: ResolvedTxn } | { ok: false; errors: FieldErrors } {
  const fields = new Set<TxnField>(TXN_FIELDS[d.type]);
  const has = (f: TxnField) => fields.has(f);
  const errors: FieldErrors = {};
  const need = (cond: unknown, key: string, msg: string) => {
    if (!cond) errors[key] = msg;
  };

  let item = has("item") ? d.item?.trim() : undefined;
  let qty = has("qty") ? d.qty : undefined;
  let unit = has("unit") ? d.unit?.trim() : undefined;
  const rate = has("rate") ? d.rate : undefined;
  let amount = d.amount;
  let workers: number | undefined;
  let days: number | undefined;
  let laborType: string | undefined;

  switch (d.type) {
    case "LABOR": {
      laborType = d.laborType?.trim();
      workers = d.workers;
      days = d.days;
      need(laborType, "laborType", "Pick the labor type");
      need(workers && Number.isInteger(workers) && workers > 0, "workers", "Enter the number of workers");
      need(days && days > 0 && days <= 3100, "days", "Enter days worked (up to 31)");
      need(rate && rate > 0, "rate", "Enter the daily rate");
      if (laborType && workers && days && rate) {
        amount = laborAmount(workers, days, rate);
        item = `${laborType} × ${workers}`;
        qty = workers * days * 10; // man-days in milli
        unit = "man-days";
      }
      break;
    }
    case "MATERIAL":
      need(d.materialId, "materialId", "Pick the material");
      need(qty && qty > 0, "qty", "Enter the quantity");
      need(rate && rate > 0, "rate", "Enter the rate");
      need(d.vendorId, "vendorId", "Pick the vendor");
      item = ctx.materialName ?? item ?? "Material";
      unit = ctx.materialUnit ?? unit;
      if (qty && rate) amount = mulQtyRate(qty, rate);
      break;
    case "MACHINERY":
    case "LOGISTICS":
      need(item, "item", d.type === "MACHINERY" ? "Say which machine" : "Say what was moved");
      need(qty && qty > 0, "qty", "Enter the quantity");
      need(unit, "unit", "Pick the unit");
      need(rate && rate > 0, "rate", "Enter the rate");
      if (qty && rate) amount = mulQtyRate(qty, rate);
      break;
    case "SITE_EXPENSE":
    case "OTHER":
      need(item, "item", "Say what it was for");
      need(amount && amount > 0, "amount", "Enter the amount");
      break;
    case "CLIENT_PAYMENT":
      need(amount && amount > 0, "amount", "Enter the amount received");
      item = "Client payment";
      break;
    case "CONTRACTOR_PAYMENT":
      need(d.vendorId, "vendorId", "Pick who was paid");
      need(amount && amount > 0, "amount", "Enter the amount paid");
      item = `Payment${ctx.vendorName ? ` to ${ctx.vendorName}` : ""}`;
      break;
  }

  if (amount !== undefined && (!Number.isSafeInteger(amount) || amount <= 0)) errors.amount = "Amount must be more than 0";
  if (Object.keys(errors).length) return { ok: false, errors };

  const vendorId = has("vendor") ? (d.vendorId ?? null) : null;
  // Costs without a vendor are treated as paid on the spot (cash); site expenses are always paid.
  const paidNow = isCostType(d.type) ? d.type === "SITE_EXPENSE" || !vendorId || (has("paidNow") && Boolean(d.paidNow)) : false;

  return {
    ok: true,
    value: {
      type: d.type,
      date: d.date,
      item: item!,
      spec: has("spec") ? (d.spec?.trim() || null) : null,
      materialId: has("material") ? (d.materialId ?? null) : null,
      qty: qty ?? null,
      unit: unit || null,
      rate: rate ?? null,
      amount: amount!,
      vendorId,
      phase: has("phase") ? (d.phase ?? null) : null,
      slabId: has("slab") ? (d.slabId ?? null) : null,
      location: has("slab") ? (d.location?.trim() || null) : null,
      laborType: laborType ?? null,
      workers: workers ?? null,
      days: days ?? null,
      billNo: has("billNo") ? (d.billNo?.trim() || null) : null,
      billLine: d.billLine ?? 1,
      paidNow,
      paymentMode: has("paymentMode") ? (d.paymentMode?.trim() || null) : null,
      purchaseOrderId: has("purchaseOrder") ? (d.purchaseOrderId ?? null) : null,
      notes: d.notes?.trim() || null,
    },
  };
}
