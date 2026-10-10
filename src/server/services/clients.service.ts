import { asc, count, eq, ilike, and, type SQL } from "drizzle-orm";
import { z } from "zod";
import { zGstin, zId, zListQuery, zPhone, zReason, zRequiredText, zText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { getDb } from "../db/client";
import { clients, projects } from "../db/schema";
import { notFound } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan } from "../permissions";
import { inTx } from "../tx";
import { projectKpisFor } from "./kpis";

export const clientInput = z.object({
  name: zRequiredText(150, "Client name"),
  contactPerson: zText(100),
  phone: zPhone,
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .refine((v) => v === undefined || z.email().safeParse(v).success, "Enter a valid email"),
  gstin: zGstin,
  address: zText(500),
});

const listQuery = zListQuery.extend({ status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().catch("ACTIVE") });

export async function listClients(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = listQuery.parse(query);
  const { limit, offset, page } = pageWindow(q.page);
  const status = q.status ?? "ACTIVE";
  const where: SQL | undefined = and(
    status === "ALL" ? undefined : eq(clients.status, status),
    q.q ? ilike(clients.name, `%${q.q}%`) : undefined,
  );
  const db = getDb();
  const rows = await db.select().from(clients).where(where).orderBy(asc(clients.name)).limit(limit).offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(clients).where(where);
  return paged(rows, total, page);
}

export async function clientOptions(actor: Actor) {
  assertCan(actor, "project.read");
  return getDb()
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.status, "ACTIVE"))
    .orderBy(asc(clients.name));
}

export async function getClient(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const db = getDb();
  const [c] = await db.select().from(clients).where(eq(clients.id, zId.parse(id))).limit(1);
  if (!c) throw notFound("Client");
  const projs = await db
    .select({ id: projects.id, name: projects.name, code: projects.code, status: projects.status })
    .from(projects)
    .where(eq(projects.clientId, c.id))
    .orderBy(asc(projects.name));
  const withMoney = await Promise.all(
    projs.map(async (p) => ({ ...p, kpis: await projectKpisFor(actor, p.id) })),
  );
  return { ...c, projects: withMoney };
}

export async function createClient(actor: Actor, input: unknown) {
  const data = clientInput.parse(input);
  assertCan(actor, "master.write");
  return inTx(async (tx) => {
    const [c] = await tx.insert(clients).values(data).returning({ id: clients.id, name: clients.name });
    await audit(tx, actor, { action: "create", entity: "client", entityId: c!.id, data });
    return c!;
  });
}

export async function updateClient(actor: Actor, id: string, input: unknown) {
  const data = clientInput.parse(input);
  assertCan(actor, "master.write");
  const clientId = zId.parse(id);
  return inTx(async (tx) => {
    const [c] = await tx
      .update(clients)
      .set({ ...data, contactPerson: data.contactPerson ?? null, phone: data.phone ?? null, email: data.email ?? null, gstin: data.gstin ?? null, address: data.address ?? null, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning({ id: clients.id });
    if (!c) throw notFound("Client");
    await audit(tx, actor, { action: "update", entity: "client", entityId: clientId, data });
    return c;
  });
}

export async function setClientStatus(actor: Actor, id: string, input: unknown) {
  const data = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]), reason: zReason }).parse(input);
  assertCan(actor, "record.void");
  const clientId = zId.parse(id);
  return inTx(async (tx) => {
    const [c] = await tx
      .update(clients)
      .set({ status: data.status, statusReason: data.reason, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning({ id: clients.id });
    if (!c) throw notFound("Client");
    await audit(tx, actor, { action: data.status === "ACTIVE" ? "activate" : "deactivate", entity: "client", entityId: clientId, reason: data.reason });
    return c;
  });
}
