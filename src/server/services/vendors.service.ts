import { and, asc, count, eq, ilike, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";
import { VENDOR_TYPES } from "@/lib/domain";
import { zGstin, zId, zListQuery, zPhone, zReason, zRequiredText, zText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { getDb } from "../db/client";
import { projects, vendors } from "../db/schema";
import { notFound } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan, canSeeMoney } from "../permissions";
import { inTx } from "../tx";
import { pendingByProjectVendor } from "./kpis";

export const vendorInput = z.object({
  name: zRequiredText(150, "Name"),
  type: z.enum(VENDOR_TYPES, { message: "Pick a type" }),
  contactPerson: zText(100),
  phone: zPhone,
  gstin: zGstin,
  address: zText(500),
});

const listQuery = zListQuery.extend({
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().catch("ACTIVE"),
  type: z.enum(VENDOR_TYPES).optional().catch(undefined),
});

export async function listVendors(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = listQuery.parse(query);
  const { limit, offset, page } = pageWindow(q.page);
  const status = q.status ?? "ACTIVE";
  const where: SQL | undefined = and(
    status === "ALL" ? undefined : eq(vendors.status, status),
    q.type ? eq(vendors.type, q.type) : undefined,
    q.q ? ilike(vendors.name, `%${q.q}%`) : undefined,
  );
  const db = getDb();
  const rows = await db.select().from(vendors).where(where).orderBy(asc(vendors.name)).limit(limit).offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(vendors).where(where);
  let pendingMap = new Map<string, number>();
  if (canSeeMoney(actor) && rows.length) {
    const pend = await pendingByProjectVendor(db);
    pendingMap = new Map();
    for (const p of pend) if (rows.some((r) => r.id === p.vendorId)) pendingMap.set(p.vendorId, (pendingMap.get(p.vendorId) ?? 0) + p.pending);
  }
  return paged(
    rows.map((r) => ({ ...r, pending: canSeeMoney(actor) ? (pendingMap.get(r.id) ?? 0) : null })),
    total,
    page,
  );
}

export async function vendorOptions(actor: Actor, types?: readonly (typeof VENDOR_TYPES)[number][]) {
  assertCan(actor, "project.read");
  return getDb()
    .select({ id: vendors.id, name: vendors.name, type: vendors.type, gstin: vendors.gstin })
    .from(vendors)
    .where(and(eq(vendors.status, "ACTIVE"), types?.length ? inArray(vendors.type, [...types]) : undefined))
    .orderBy(asc(vendors.name));
}

export async function getVendor(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const db = getDb();
  const [v] = await db.select().from(vendors).where(eq(vendors.id, zId.parse(id))).limit(1);
  if (!v) throw notFound("Vendor");
  let ledger: { projectId: string; projectName: string; incurred: number; paid: number; pending: number }[] | null = null;
  if (canSeeMoney(actor)) {
    const rows = await pendingByProjectVendor(db, undefined, v.id);
    const names = rows.length
      ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, rows.map((r) => r.projectId)))
      : [];
    ledger = rows.map((r) => ({
      projectId: r.projectId,
      projectName: names.find((n) => n.id === r.projectId)?.name ?? "",
      incurred: r.incurredAll,
      paid: r.paid,
      pending: r.pending,
    }));
  }
  return { ...v, ledger };
}

export async function createVendor(actor: Actor, input: unknown) {
  const data = vendorInput.parse(input);
  assertCan(actor, "master.write");
  return inTx(async (tx) => {
    const [v] = await tx.insert(vendors).values(data).returning({ id: vendors.id, name: vendors.name });
    await audit(tx, actor, { action: "create", entity: "vendor", entityId: v!.id, data });
    return v!;
  });
}

export async function updateVendor(actor: Actor, id: string, input: unknown) {
  const data = vendorInput.parse(input);
  assertCan(actor, "master.write");
  const vendorId = zId.parse(id);
  return inTx(async (tx) => {
    const [v] = await tx
      .update(vendors)
      .set({ ...data, contactPerson: data.contactPerson ?? null, phone: data.phone ?? null, gstin: data.gstin ?? null, address: data.address ?? null, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId))
      .returning({ id: vendors.id });
    if (!v) throw notFound("Vendor");
    await audit(tx, actor, { action: "update", entity: "vendor", entityId: vendorId, data });
    return v;
  });
}

export async function setVendorStatus(actor: Actor, id: string, input: unknown) {
  const data = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]), reason: zReason }).parse(input);
  assertCan(actor, "record.void");
  const vendorId = zId.parse(id);
  return inTx(async (tx) => {
    const [v] = await tx
      .update(vendors)
      .set({ status: data.status, statusReason: data.reason, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId))
      .returning({ id: vendors.id });
    if (!v) throw notFound("Vendor");
    await audit(tx, actor, { action: data.status === "ACTIVE" ? "activate" : "deactivate", entity: "vendor", entityId: vendorId, reason: data.reason });
    return v;
  });
}

