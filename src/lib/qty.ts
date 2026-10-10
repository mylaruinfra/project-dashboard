/** Quantities are integer milli-units in code (numeric(14,3) in the database). */
import { groupIndian, parseScaledDecimal, scaledToDecimal } from "./indian-number";

export type Milli = number;

export function parseQty(input: string | number): Milli | null {
  return parseScaledDecimal(input, 3);
}

export function qtyFromDb(value: string | null | undefined): Milli {
  if (value === null || value === undefined) return 0;
  const q = parseScaledDecimal(value, 3);
  if (q === null) throw new Error(`Invalid quantity from database: ${value}`);
  return q;
}

export function qtyToDb(milli: Milli): string {
  if (!Number.isSafeInteger(milli)) throw new Error(`Quantity must be integer milli-units, got ${milli}`);
  return scaledToDecimal(milli, 3);
}

/** 12500 → "12.5", 1500000 → "1,500" */
export function formatQty(milli: Milli): string {
  const neg = milli < 0;
  const abs = Math.abs(milli);
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, "0").replace(/0+$/, "");
  return `${neg ? "−" : ""}${groupIndian(String(whole))}${frac ? `.${frac}` : ""}`;
}

export function qtyToInput(milli: Milli | null | undefined): string {
  if (milli === null || milli === undefined) return "";
  return scaledToDecimal(milli, 3).replace(/\.?0+$/, "");
}
