/** Groups a non-negative integer string the Indian way: 10600000 → "1,06,00,000". */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return `${groups.join(",")},${last3}`;
}

/**
 * Parses a decimal string like "1,06,000.5" into an integer scaled by 10^scale, without floats.
 * Returns null when the text is not a plain non-negative decimal or has too many decimals.
 */
export function parseScaledDecimal(input: string | number, scale: number): number | null {
  const text = (typeof input === "number" ? String(input) : input).trim().replace(/[,\s₹]/g, "");
  if (text === "") return null;
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) {
    // numbers like 1e-7 from JS stringification
    if (typeof input === "number" && Number.isFinite(input)) return Math.round(input * 10 ** scale);
    return null;
  }
  const [, sign, intPart = "0", frac = ""] = m;
  if (frac.length > scale) return null;
  const scaled = Number(intPart) * 10 ** scale + Number(frac.padEnd(scale, "0") || "0");
  if (!Number.isSafeInteger(scaled)) return null;
  return sign ? -scaled : scaled;
}

/** Formats an integer scaled by 10^scale back to a fixed decimal string: (123450, 2) → "1234.50". */
export function scaledToDecimal(value: number, scale: number): string {
  const neg = value < 0;
  const abs = Math.abs(Math.trunc(value));
  const base = 10 ** scale;
  const intPart = Math.floor(abs / base);
  const frac = String(abs % base).padStart(scale, "0");
  return `${neg ? "-" : ""}${intPart}${scale > 0 ? `.${frac}` : ""}`;
}
