import { and, asc, count, eq, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";
import { zId, zListQuery, zReason, zRequiredText, zText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { getDb } from "../db/client";
import { materials } from "../db/schema";
import { notFound } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan } from "../permissions";
import { inTx } from "../tx";

export const materialInput = z.object({
  name: zRequiredText(100, "Material name"),
  unit: zRequiredText(20, "Unit"),
  category: zText(50),
});

const listQuery = zListQuery.extend({ status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().catch("ACTIVE") });

export async function listMaterials(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = listQuery.parse(query);
  const { limit, offset, page } = pageWindow(q.page);
  const status = q.status ?? "ACTIVE";
  const where: SQL | undefined = and(
    status === "ALL" ? undefined : eq(materials.status, status),
    q.q ? ilike(materials.name, `%${q.q}%`) : undefined,
  );
  const db = getDb();
  const rows = await db.select().from(materials).where(where).orderBy(asc(materials.name)).limit(limit).offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(materials).where(where);
  return paged(rows, total, page);
}

export async function materialOptions(actor: Actor) {
  assertCan(actor, "project.read");
  return getDb()
    .select({ id: materials.id, name: materials.name, unit: materials.unit })
    .from(materials)
    .where(eq(materials.status, "ACTIVE"))
    .orderBy(asc(materials.name));
}

export async function getMaterial(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const [m] = await getDb().select().from(materials).where(eq(materials.id, zId.parse(id))).limit(1);
  if (!m) throw notFound("Material");
  return m;
}

export async function createMaterial(actor: Actor, input: unknown) {
  const data = materialInput.parse(input);
  // Engineers may add a missing material while recording a delivery.
  assertCan(actor, actor.role === "ENGINEER" ? "field.write" : "master.write");
  return inTx(async (tx) => {
    const [m] = await tx.insert(materials).values(data).returning({ id: materials.id, name: materials.name, unit: materials.unit });
    await audit(tx, actor, { action: "create", entity: "material", entityId: m!.id, data });
    return m!;
  });
}

export async function updateMaterial(actor: Actor, id: string, input: unknown) {
  const data = materialInput.parse(input);
  assertCan(actor, "master.write");
  const materialId = zId.parse(id);
  return inTx(async (tx) => {
    const [m] = await tx
      .update(materials)
      .set({ ...data, category: data.category ?? null })
      .where(eq(materials.id, materialId))
      .returning({ id: materials.id });
    if (!m) throw notFound("Material");
    await audit(tx, actor, { action: "update", entity: "material", entityId: materialId, data });
    return m;
  });
}

export async function setMaterialStatus(actor: Actor, id: string, input: unknown) {
  const data = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]), reason: zReason }).parse(input);
  assertCan(actor, "record.void");
  const materialId = zId.parse(id);
  return inTx(async (tx) => {
    const [m] = await tx.update(materials).set({ status: data.status }).where(eq(materials.id, materialId)).returning({ id: materials.id });
    if (!m) throw notFound("Material");
    await audit(tx, actor, { action: data.status === "ACTIVE" ? "activate" : "deactivate", entity: "material", entityId: materialId, reason: data.reason });
    return m;
  });
}
