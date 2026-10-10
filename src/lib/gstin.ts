/** GSTIN: 15 chars — 2-digit state, 10-char PAN, entity number, 'Z', checksum (mod 36). */
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function gstinChecksumChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]!);
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36]!;
}

export function isValidGstin(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toUpperCase();
  if (!GSTIN_RE.test(v)) return false;
  const state = Number(v.slice(0, 2));
  if (state < 1 || state > 38) return false;
  return gstinChecksumChar(v.slice(0, 14)) === v[14];
}
