import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE: 422,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** The only error type services throw on purpose. The route wrapper turns it into a JSON envelope. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fields = fields;
  }
}

export const forbidden = (msg = "You do not have access to do this.") => new AppError("FORBIDDEN", msg);
export const notFound = (what = "Record") => new AppError("NOT_FOUND", `${what} not found.`);
export const rule = (msg: string, fields?: Record<string, string>) => new AppError("BUSINESS_RULE", msg, fields);
export const conflict = (msg: string, fields?: Record<string, string>) => new AppError("CONFLICT", msg, fields);

export interface ErrorEnvelope {
  ok: false;
  error: { code: ErrorCode; message: string; fields?: Record<string, string> };
}

export function zodToAppError(err: ZodError): AppError {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  const first = Object.values(fields)[0] ?? "Check the highlighted fields.";
  return new AppError("VALIDATION", Object.keys(fields).length > 1 ? "Check the highlighted fields." : first, fields);
}

interface PgLikeError {
  code?: string;
  constraint?: string;
  cause?: unknown;
}

function pgError(err: unknown): PgLikeError | null {
  let cur: unknown = err;
  for (let i = 0; i < 4 && cur && typeof cur === "object"; i++) {
    const e = cur as PgLikeError;
    if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) return e;
    cur = e.cause;
  }
  return null;
}

const CONSTRAINT_MESSAGES: Record<string, [string, string?]> = {
  transactions_vendor_bill_uq: ["This bill number is already recorded for this vendor.", "billNo"],
  material_receipts_challan_uq: ["This challan is already recorded for this vendor.", "challanNo"],
  purchase_orders_number_uq: ["This purchase order number is already in use.", "number"],
  users_email_uq: ["A user with this email already exists.", "email"],
  materials_name_unit_uq: ["This material already exists with the same unit.", "name"],
  projects_code_uq: ["This project code is already in use.", "code"],
  project_stock_non_negative_ck: ["Stock cannot go below zero."],
};

/** Maps anything thrown to an AppError. Unknown errors become INTERNAL (details are logged, not sent). */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return zodToAppError(err);
  const pg = pgError(err);
  if (pg) {
    const known = pg.constraint ? CONSTRAINT_MESSAGES[pg.constraint] : undefined;
    if (pg.code === "23505") {
      return conflict(known?.[0] ?? "This record already exists.", known?.[1] ? { [known[1]]: known[0] } : undefined);
    }
    if (pg.code === "23514") return rule(known?.[0] ?? "This change breaks a data rule.");
    if (pg.code === "23503") return rule("This refers to a record that does not exist.");
    if (pg.code === "22P02") return new AppError("VALIDATION", "Some values are in the wrong format.");
  }
  return new AppError("INTERNAL", "Something went wrong. Please try again.");
}
