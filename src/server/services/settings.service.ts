import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { paiseFromDb, paiseToDb } from "@/lib/money";
import { zMoneyPositive, zReason, zRequiredText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { getDb } from "../db/client";
import { appSettings, laborRates } from "../db/schema";
import { notFound } from "../errors";
import { assertCan, canSeeMoney } from "../permissions";
import { inTx } from "../tx";

export const DEFAULT_COMPANY = "Mylaru Infra";

/** Labor types with their daily rate. Engineers get the list without rates. */
export async function listLaborRates(actor: Actor, opts: { includeInactive?: boolean } = {}) {
  assertCan(actor, "project.read");
  const rows = await getDb().select().from(laborRates).orderBy(asc(laborRates.laborType));
  return rows
    .filter((r) => opts.includeInactive || r.status === "ACTIVE")
    .map((r) => ({ laborType: r.laborType, status: r.status, rate: canSeeMoney(actor) ? paiseFromDb(r.rate) : null }));
}

export const laborRateInput = z.object({ laborType: zRequiredText(50, "Labor type"), rate: zMoneyPositive });

export async function upsertLaborRate(actor: Actor, input: unknown) {
  const data = laborRateInput.parse(input);
  assertCan(actor, "settings.manage");
  return inTx(async (tx) => {
    await tx
      .insert(laborRates)
      .values({ laborType: data.laborType, rate: paiseToDb(data.rate) })
      .onConflictDoUpdate({ target: laborRates.laborType, set: { rate: paiseToDb(data.rate), status: "ACTIVE" } });
    await audit(tx, actor, { action: "upsert", entity: "labor_rate", entityId: data.laborType, data: { rate: data.rate } });
    return { laborType: data.laborType };
  });
}

export async function setLaborRateStatus(actor: Actor, laborType: string, input: unknown) {
  const data = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]), reason: zReason }).parse(input);
  assertCan(actor, "settings.manage");
  return inTx(async (tx) => {
    const [r] = await tx.update(laborRates).set({ status: data.status }).where(eq(laborRates.laborType, laborType)).returning();
    if (!r) throw notFound("Labor type");
    await audit(tx, actor, { action: data.status === "ACTIVE" ? "activate" : "deactivate", entity: "labor_rate", entityId: laborType, reason: data.reason });
    return { laborType };
  });
}

export async function getCompanyName(): Promise<string> {
  const [r] = await getDb().select().from(appSettings).where(eq(appSettings.key, "company_name")).limit(1);
  return r?.value ?? DEFAULT_COMPANY;
}

export async function setCompanyName(actor: Actor, input: unknown) {
  const data = z.object({ companyName: zRequiredText(100, "Company name") }).parse(input);
  assertCan(actor, "settings.manage");
  return inTx(async (tx) => {
    await tx
      .insert(appSettings)
      .values({ key: "company_name", value: data.companyName })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: data.companyName } });
    await audit(tx, actor, { action: "update", entity: "setting", entityId: "company_name", data });
    return data;
  });
}
