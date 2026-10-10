/** Dates are ISO yyyy-mm-dd strings in code and the DB; shown as DD MMM YYYY. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const m = ISO.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** "2026-10-05" → "05 Oct 2026". Also accepts Date (formatted in Asia/Kolkata). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const iso = typeof value === "string" ? value.slice(0, 10) : toIsoDateIST(value);
  const m = ISO.exec(iso);
  if (!m) return String(value);
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "05 Oct" for dense tables */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  const m = ISO.exec(value.slice(0, 10));
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]}` : value;
}

export function formatDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }).format(d);
  return `${formatDate(d)}, ${time}`;
}

export function toIsoDateIST(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA gives yyyy-mm-dd
}

export function todayIso(): string {
  return toIsoDateIST(new Date());
}

/**
 * Best-effort parse of dates as printed on Indian bills: 05/10/2026, 05-10-26, 5 Oct 2026, 2026-10-05.
 * Day comes first. Returns ISO or null.
 */
export function parseLooseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (isValidIsoDate(s)) return s;
  let m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const iso = `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    return isValidIsoDate(iso) ? iso : null;
  }
  m = /^(\d{1,2})[\s\-]+([A-Za-z]{3})[A-Za-z]*[\s\-,]+(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const idx = MONTHS.findIndex((x) => x.toLowerCase() === m![2]!.toLowerCase());
    if (idx < 0) return null;
    const y = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const iso = `${y}-${String(idx + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    return isValidIsoDate(iso) ? iso : null;
  }
  return null;
}
