/** Shared zod primitives. Every service parses input with these so rules stay in one place. */
import { z } from "zod";
import { parseFeet } from "./area";
import { isValidIsoDate } from "./dates";
import { isValidGstin } from "./gstin";
import { parseRupees } from "./money";
import { parseQty } from "./qty";

/** Plain-words defaults for anything a schema does not word itself. */
z.config({
  customError: (iss) => {
    if (iss.code === "invalid_type") return iss.input === undefined || iss.input === null ? "This field is required" : "Enter a valid value";
    if (iss.code === "invalid_value") return "Pick one of the options";
    if (iss.code === "too_small" && iss.origin === "array") return "Add at least one";
    return undefined;
  },
});

export const zId = z.uuid({ message: "Pick a valid item" });

const numberLike = z.union([z.string(), z.number()]);

/** Rupees as typed ("1,06,000.50" or 106000.5) → integer paise ≥ 0. */
export const zMoney = numberLike.transform((v, ctx) => {
  const p = parseRupees(v);
  if (p === null || p < 0) {
    ctx.addIssue({ code: "custom", message: "Enter an amount in rupees, up to 2 decimals" });
    return z.NEVER;
  }
  return p;
});

/** Strictly positive money. */
export const zMoneyPositive = zMoney.refine((p) => p > 0, "Amount must be more than 0");

/** Quantity as typed → integer milli-units > 0. */
export const zQty = numberLike.transform((v, ctx) => {
  const q = parseQty(v);
  if (q === null || q <= 0) {
    ctx.addIssue({ code: "custom", message: "Enter a quantity more than 0, up to 3 decimals" });
    return z.NEVER;
  }
  return q;
});

/** Feet as typed → integer centi-ft > 0. */
export const zFeet = numberLike.transform((v, ctx) => {
  const f = parseFeet(v);
  if (f === null || f <= 0) {
    ctx.addIssue({ code: "custom", message: "Enter a length in feet more than 0" });
    return z.NEVER;
  }
  return f;
});

/** Area in SFT as typed → centi-SFT ≥ 0. */
export const zArea = numberLike.transform((v, ctx) => {
  const a = parseFeet(v);
  if (a === null || a < 0) {
    ctx.addIssue({ code: "custom", message: "Enter an area in SFT" });
    return z.NEVER;
  }
  return a;
});

export const zDate = z.string().refine(isValidIsoDate, "Pick a valid date");

/** Trimmed text; empty string becomes undefined. */
export const zText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const zRequiredText = (max = 200, label = "This field") =>
  z.string().trim().min(1, `${label} is required`).max(max, `Keep it under ${max} characters`);

export const zReason = z.string().trim().min(3, "Say why, in a few words").max(500);

export const zGstin = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine((v) => v === undefined || isValidGstin(v), "This GSTIN does not look right");

export const zPhone = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine((v) => v === undefined || /^[+\d][\d\s-]{6,16}$/.test(v), "Enter a valid phone number");

export const zOptionalId = z
  .union([zId, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : undefined));

export const zPage = z.coerce.number().int().min(1).catch(1);

export const PAGE_SIZE = 20;

export const zListQuery = z.object({
  page: zPage.optional().default(1),
  q: z.string().trim().max(100).optional().catch(undefined),
});
