/**
 * Turns a RawExtraction into typed draft values (paise, milli-units, ISO dates) and runs the
 * checks a reviewer needs: qty × rate = amount, line total vs subtotal, subtotal + tax = total,
 * GSTIN format and checksum, and a sane date. Pure: unit-tested without any AI call.
 */
import { parseLooseDate } from "@/lib/dates";
import { isValidGstin } from "@/lib/gstin";
import { parseScaledDecimal } from "@/lib/indian-number";
import { formatINR, mulQtyRate, sumPaise } from "@/lib/money";
import type { RawExtraction } from "./types";

export interface NormalizedLine {
  description: string;
  qty: number | null; // milli
  unit: string | null;
  rate: number | null; // paise
  amount: number | null; // paise
}

export interface Normalized {
  documentType: RawExtraction["documentType"];
  vendorName: string | null;
  vendorGstin: string | null;
  documentNumber: string | null;
  date: string | null; // ISO
  dateAsPrinted: string | null;
  vehicleNo: string | null;
  lines: NormalizedLine[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
}

export type CheckStatus = "pass" | "warn" | "fail";
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

/** ₹1 tolerance for rounding on printed bills. */
export const TOLERANCE_PAISE = 100;

const clean = (s: string | null | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

function num(s: string | null | undefined, scale: number): number | null {
  const t = clean(s);
  if (!t) return null;
  const v = parseScaledDecimal(t.replace(/^rs\.?/i, "").replace(/\/-$/, ""), scale);
  if (v !== null) return v;
  // A printed value with more decimals than we keep (e.g. "12.3456"): round, don't drop it.
  const m = /^(\d+)\.(\d+)$/.exec(t.replace(/[,\s₹]/g, ""));
  if (!m) return null;
  const extra = parseScaledDecimal(`${m[1]}.${m[2]!.slice(0, scale)}`, scale);
  return extra === null ? null : extra + (Number(m[2]![scale] ?? "0") >= 5 ? 1 : 0);
}

export function normalizeExtraction(raw: RawExtraction): Normalized {
  return {
    documentType: raw.documentType,
    vendorName: clean(raw.vendorName),
    vendorGstin: clean(raw.vendorGstin)?.replace(/\s/g, "").toUpperCase() ?? null,
    documentNumber: clean(raw.documentNumber),
    date: parseLooseDate(raw.date),
    dateAsPrinted: clean(raw.date),
    vehicleNo: clean(raw.vehicleNo)?.toUpperCase() ?? null,
    lines: raw.lines
      .filter((l) => clean(l.description))
      .map((l) => ({
        description: clean(l.description)!,
        qty: num(l.quantity, 3),
        unit: clean(l.unit),
        rate: num(l.rate, 2),
        amount: num(l.amount, 2),
      })),
    subtotal: num(raw.subtotal, 2),
    tax: num(raw.taxTotal, 2),
    total: num(raw.total, 2),
  };
}

const close = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE_PAISE;

export function runChecks(n: Normalized, opts: { today: string; kind: "TRANSACTION" | "DELIVERY" }): Check[] {
  const checks: Check[] = [];

  n.lines.forEach((l, i) => {
    const label = `Line ${i + 1}: qty × rate = amount`;
    if (l.qty === null || l.rate === null || l.amount === null) {
      if (opts.kind === "TRANSACTION") checks.push({ id: `line-${i}`, label, status: "warn", detail: "Quantity, rate or amount is missing. Fill it in before confirming." });
      return;
    }
    const expect = mulQtyRate(l.qty, l.rate);
    checks.push(
      close(expect, l.amount)
        ? { id: `line-${i}`, label, status: "pass", detail: `${formatINR(expect)} matches.` }
        : { id: `line-${i}`, label, status: "fail", detail: `Expected ${formatINR(expect)}, bill says ${formatINR(l.amount)}.` },
    );
  });

  const amounts = n.lines.map((l) => l.amount);
  if (amounts.length && amounts.every((a) => a !== null)) {
    const linesTotal = sumPaise(amounts as number[]);
    const target = n.subtotal ?? (n.tax === null ? n.total : null);
    if (target !== null) {
      checks.push(
        close(linesTotal, target)
          ? { id: "lines-total", label: "Lines add up to the subtotal", status: "pass", detail: `${formatINR(linesTotal)} matches.` }
          : { id: "lines-total", label: "Lines add up to the subtotal", status: "fail", detail: `Lines add up to ${formatINR(linesTotal)}, bill says ${formatINR(target)}.` },
      );
    }
  }

  if (n.subtotal !== null && n.total !== null) {
    const expect = n.subtotal + (n.tax ?? 0);
    checks.push(
      close(expect, n.total)
        ? { id: "grand-total", label: "Subtotal + tax = total", status: "pass", detail: `${formatINR(n.total)} matches.` }
        : { id: "grand-total", label: "Subtotal + tax = total", status: "fail", detail: `Expected ${formatINR(expect)}, bill says ${formatINR(n.total)}.` },
    );
  } else if (opts.kind === "TRANSACTION" && n.total === null) {
    checks.push({ id: "grand-total", label: "Bill total", status: "warn", detail: "No total found on the bill." });
  }

  if (!n.vendorGstin) {
    checks.push({ id: "gstin", label: "Vendor GSTIN", status: "warn", detail: "No GSTIN found. Fine for small suppliers; check before claiming input credit." });
  } else if (isValidGstin(n.vendorGstin)) {
    checks.push({ id: "gstin", label: "Vendor GSTIN", status: "pass", detail: `${n.vendorGstin} is a valid GSTIN.` });
  } else {
    checks.push({ id: "gstin", label: "Vendor GSTIN", status: "fail", detail: `${n.vendorGstin} is not a valid GSTIN (format or check digit).` });
  }

  if (!n.date) {
    checks.push({ id: "date", label: "Date", status: n.dateAsPrinted ? "fail" : "warn", detail: n.dateAsPrinted ? `Could not read "${n.dateAsPrinted}" as a date.` : "No date found." });
  } else if (n.date > opts.today) {
    checks.push({ id: "date", label: "Date", status: "fail", detail: "The date is in the future." });
  } else {
    const yearAgo = `${Number(opts.today.slice(0, 4)) - 1}${opts.today.slice(4)}`;
    checks.push(
      n.date < yearAgo
        ? { id: "date", label: "Date", status: "warn", detail: "The date is more than a year old." }
        : { id: "date", label: "Date", status: "pass", detail: "Looks right." },
    );
  }

  if (opts.kind === "DELIVERY" && n.documentType === "bill") {
    checks.push({ id: "doc-type", label: "Document type", status: "warn", detail: "This looks like a bill, not a delivery challan." });
  }
  if (opts.kind === "TRANSACTION" && n.documentType === "challan") {
    checks.push({ id: "doc-type", label: "Document type", status: "warn", detail: "This looks like a delivery challan, not a bill." });
  }
  if (!n.lines.length) checks.push({ id: "lines", label: "Item lines", status: "warn", detail: "No item lines found. Add them by hand." });

  return checks;
}
