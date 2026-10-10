/**
 * Money helpers. In code, money is always an integer number of paise. The database stores
 * numeric(14,2) rupees as strings; convert only at the edges with fromDb / toDb.
 */
import { groupIndian, parseScaledDecimal, scaledToDecimal } from "./indian-number";

export type Paise = number;

const LAKH_PAISE = 100_000 * 100;
const CRORE_PAISE = 10_000_000 * 100;

/** "1,06,000.50" or 106000.5 → 10600050. Null when invalid or more than 2 decimals. */
export function parseRupees(input: string | number): Paise | null {
  return parseScaledDecimal(input, 2);
}

export function paiseFromDb(value: string | null | undefined): Paise {
  if (value === null || value === undefined) return 0;
  const p = parseScaledDecimal(value, 2);
  if (p === null) throw new Error(`Invalid money value from database: ${value}`);
  return p;
}

export function paiseToDb(paise: Paise): string {
  assertPaise(paise);
  return scaledToDecimal(paise, 2);
}

export function assertPaise(paise: Paise): void {
  if (!Number.isSafeInteger(paise)) throw new Error(`Money must be integer paise, got ${paise}`);
}

/** qty (milli-units) × rate (paise per unit) → paise, rounded half away from zero. */
export function mulQtyRate(qtyMilli: number, ratePaise: Paise): Paise {
  const product = BigInt(qtyMilli) * BigInt(ratePaise);
  const q = product / 1000n;
  const r = product % 1000n;
  const abs = r < 0n ? -r : r;
  const rounded = abs * 2n >= 1000n ? q + (product < 0n ? -1n : 1n) : q;
  return Number(rounded);
}

export function sumPaise(values: readonly Paise[]): Paise {
  return values.reduce((a, b) => a + b, 0);
}

/** Full Indian format: ₹1,06,00,000 (paise shown only when not zero: ₹350.50). */
export function formatINR(paise: Paise): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  const body = `₹${groupIndian(String(rupees))}${p ? `.${String(p).padStart(2, "0")}` : ""}`;
  return neg ? `−${body}` : body;
}

/** Card format: below 1 lakh ₹84,500; lakhs ₹14.80 L; crores ₹1.06 Cr. */
export function formatINRCompact(paise: Paise): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  let body: string;
  if (abs < LAKH_PAISE) {
    body = `₹${groupIndian(String(Math.round(abs / 100)))}`;
  } else {
    const lakhHundredths = Math.round(abs / (LAKH_PAISE / 100));
    if (lakhHundredths < 100 * 100) {
      body = `₹${scaledToDecimal(lakhHundredths, 2)} L`;
    } else {
      const croreHundredths = Math.round(abs / (CRORE_PAISE / 100));
      body = `₹${groupIndian(String(Math.floor(croreHundredths / 100)))}.${String(croreHundredths % 100).padStart(2, "0")} Cr`;
    }
  }
  return neg ? `−${body}` : body;
}

/** Plain rupee string for form inputs: 10600050 → "106000.50", 500 → "5". */
export function paiseToInput(paise: Paise | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return paise % 100 === 0 ? String(paise / 100) : scaledToDecimal(paise, 2);
}
