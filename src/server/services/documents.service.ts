import { and, count, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { DOC_KINDS, type DocKind, UPLOAD_MAX_BYTES, UPLOAD_MIME } from "@/lib/domain";
import { zId, zOptionalId, zPage, zReason, zRequiredText, zText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { type DbOrTx, getDb } from "../db/client";
import {
  activities,
  clients,
  documents,
  materialReceipts,
  materialUsages,
  projects,
  purchaseOrders,
  transactions,
  users,
  vendors,
} from "../db/schema";
import { AppError, forbidden, notFound, rule } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan, assertProjectAccess, can, isProjectScoped } from "../permissions";
import { EXT_FOR_MIME, getStorage, sniffMime } from "../storage/files";
import { inTx } from "../tx";
import { visibleProjectIds } from "./scope";
import { auditTrail } from "./transactions.service";

/** Kinds that can reveal money; hidden from people without finance access. */
const MONEY_KINDS: readonly DocKind[] = ["BILL", "AGREEMENT"];

export const ENTITY_TYPES = ["project", "transaction", "receipt", "usage", "purchase_order", "activity", "vendor", "client"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_LABEL: Record<EntityType, string> = {
  project: "Project",
  transaction: "Transaction",
  receipt: "Delivery",
  usage: "Material use",
  purchase_order: "Purchase order",
  activity: "Activity",
  vendor: "Vendor",
  client: "Client",
};

export const uploadMeta = z.object({
  projectId: zOptionalId,
  entityType: z.union([z.enum(ENTITY_TYPES), z.literal("")]).optional().transform((v) => v || undefined),
  entityId: zOptionalId,
  kind: z.enum(DOC_KINDS),
  title: zText(150),
  caption: zText(500),
});

export interface UploadFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

function assertKindAllowed(actor: Actor, kind: DocKind) {
  if (MONEY_KINDS.includes(kind)) assertCan(actor, "finance.write");
  else assertCan(actor, "field.write");
}

export function validateFile(file: UploadFile): string {
  if (file.bytes.byteLength === 0) throw new AppError("VALIDATION", "The file is empty.", { file: "The file is empty" });
  if (file.bytes.byteLength > UPLOAD_MAX_BYTES) throw new AppError("VALIDATION", "Files must be 10 MB or smaller.", { file: "Files must be 10 MB or smaller" });
  const sniffed = sniffMime(file.bytes);
  if (!sniffed || !(UPLOAD_MIME as readonly string[]).includes(sniffed)) {
    throw new AppError("VALIDATION", "Upload a JPG, PNG, WebP image or a PDF.", { file: "Upload a JPG, PNG, WebP or PDF" });
  }
  return sniffed;
}

/** Resolves which project an attached record belongs to (and that it exists). */
async function entityProject(db: DbOrTx, type: EntityType, id: string): Promise<string | null> {
  const one = async (q: Promise<{ p: string }[]>) => {
    const [r] = await q;
    if (!r) throw rule("The record to attach to was not found.");
    return r.p;
  };
  switch (type) {
    case "project":
      return one(db.select({ p: projects.id }).from(projects).where(eq(projects.id, id)));
    case "transaction":
      return one(db.select({ p: transactions.projectId }).from(transactions).where(eq(transactions.id, id)));
    case "receipt":
      return one(db.select({ p: materialReceipts.projectId }).from(materialReceipts).where(eq(materialReceipts.id, id)));
    case "usage":
      return one(db.select({ p: materialUsages.projectId }).from(materialUsages).where(eq(materialUsages.id, id)));
    case "purchase_order":
      return one(db.select({ p: purchaseOrders.projectId }).from(purchaseOrders).where(eq(purchaseOrders.id, id)));
    case "activity":
      return one(db.select({ p: activities.projectId }).from(activities).where(eq(activities.id, id)));
    case "vendor":
      await one(db.select({ p: vendors.id }).from(vendors).where(eq(vendors.id, id)));
      return null;
    case "client":
      await one(db.select({ p: clients.id }).from(clients).where(eq(clients.id, id)));
      return null;
  }
}

/** Saves the file and the document row. Used directly and by AI drafts. */
export async function storeDocument(
  db: DbOrTx,
  actor: Actor,
  meta: z.output<typeof uploadMeta>,
  file: UploadFile,
): Promise<{ id: string; projectId: string | null; mimeType: string }> {
  assertKindAllowed(actor, meta.kind);
  const mime = validateFile(file);
  let projectId = meta.projectId ?? null;
  if (meta.entityType || meta.entityId) {
    if (!meta.entityType || !meta.entityId) throw new AppError("VALIDATION", "Pick the record to attach to.");
    const entityProj = await entityProject(db, meta.entityType, meta.entityId);
    if (entityProj && projectId && entityProj !== projectId) throw rule("That record belongs to another project.");
    projectId = entityProj ?? projectId;
  }
  if (projectId) await assertProjectAccess(db, actor, projectId, { write: true });
  else if (isProjectScoped(actor)) throw forbidden("Pick one of your projects.");
  if (actor.role === "ENGINEER" && meta.entityType && !["project", "receipt", "usage", "activity", "transaction"].includes(meta.entityType)) throw forbidden();

  const key = await getStorage().put(file.bytes, EXT_FOR_MIME[mime] ?? "");
  const title = meta.title ?? file.name.replace(/\.[^.]+$/, "").slice(0, 150) ?? "Document";
  const [doc] = await db
    .insert(documents)
    .values({
      projectId,
      entityType: meta.entityType ?? (projectId ? "project" : null),
      entityId: meta.entityId ?? projectId,
      kind: meta.kind,
      title: title || "Document",
      caption: meta.caption ?? null,
      fileName: file.name.slice(0, 200) || `upload${EXT_FOR_MIME[mime] ?? ""}`,
      mimeType: mime,
      sizeBytes: file.bytes.byteLength,
      storageKey: key,
      uploadedBy: actor.id,
    })
    .returning({ id: documents.id });
  await audit(db, actor, { action: "upload", entity: "document", entityId: doc!.id, projectId, data: { kind: meta.kind, entityType: meta.entityType } });
  return { id: doc!.id, projectId, mimeType: mime };
}

export async function uploadDocument(actor: Actor, metaInput: unknown, file: UploadFile) {
  const meta = uploadMeta.parse(metaInput);
  assertKindAllowed(actor, meta.kind);
  return inTx((tx) => storeDocument(tx, actor, meta, file));
}

const listQuery = z.object({
  page: zPage.optional().default(1),
  projectId: zOptionalId,
  kind: z.union([z.enum(DOC_KINDS), z.literal("")]).optional().transform((v) => v || undefined),
  entityType: z.union([z.enum(ENTITY_TYPES), z.literal("")]).optional().transform((v) => v || undefined),
  entityId: zOptionalId,
  status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).optional().catch("ACTIVE"),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
});

async function docScope(actor: Actor): Promise<SQL | undefined> {
  const ids = await visibleProjectIds(actor);
  const kindFilter = can(actor, "finance.read") ? undefined : notInArray(documents.kind, [...MONEY_KINDS]);
  if (ids === null) return kindFilter;
  return and(kindFilter, ids.length ? inArray(documents.projectId, ids) : sql`false`);
}

export async function listDocuments(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = listQuery.parse(query);
  const db = getDb();
  if (q.projectId) await assertProjectAccess(db, actor, q.projectId);
  const { limit, offset, page, pageSize } = pageWindow(q.page, q.pageSize);
  const where = and(
    await docScope(actor),
    q.projectId ? eq(documents.projectId, q.projectId) : undefined,
    q.kind ? eq(documents.kind, q.kind) : undefined,
    q.entityType ? eq(documents.entityType, q.entityType) : undefined,
    q.entityId ? eq(documents.entityId, q.entityId) : undefined,
    q.status === "ALL" ? undefined : eq(documents.status, q.status ?? "ACTIVE"),
  );
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      caption: documents.caption,
      kind: documents.kind,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      entityType: documents.entityType,
      entityId: documents.entityId,
      status: documents.status,
      createdAt: documents.createdAt,
      projectId: documents.projectId,
      projectName: projects.name,
      uploadedByName: users.name,
    })
    .from(documents)
    .leftJoin(projects, eq(projects.id, documents.projectId))
    .leftJoin(users, eq(users.id, documents.uploadedBy))
    .where(where)
    .orderBy(desc(documents.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(documents).where(where);
  return paged(rows, total, page, pageSize);
}

async function loadDoc(db: DbOrTx, actor: Actor, id: string, write = false) {
  const [d] = await db.select().from(documents).where(eq(documents.id, zId.parse(id))).limit(1);
  if (!d) throw notFound("Document");
  if (MONEY_KINDS.includes(d.kind) && !can(actor, "finance.read")) throw forbidden();
  if (d.projectId) await assertProjectAccess(db, actor, d.projectId, { write });
  else if (isProjectScoped(actor)) throw forbidden();
  return d;
}

export async function getDocument(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const db = getDb();
  const d = await loadDoc(db, actor, id);
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, d.uploadedBy));
  const history = await auditTrail(db, "document", d.id);
  return { ...d, uploadedByName: u?.name ?? "", history };
}

export async function readDocumentFile(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const d = await loadDoc(getDb(), actor, id);
  const bytes = await getStorage().get(d.storageKey);
  return { bytes, mimeType: d.mimeType, fileName: d.fileName };
}

export const documentUpdateInput = z.object({
  title: zRequiredText(150, "Title"),
  caption: zText(500),
  kind: z.enum(DOC_KINDS),
});

export async function updateDocument(actor: Actor, id: string, input: unknown) {
  const data = documentUpdateInput.parse(input);
  return inTx(async (tx) => {
    const d = await loadDoc(tx, actor, id, true);
    assertKindAllowed(actor, d.kind);
    assertKindAllowed(actor, data.kind);
    await tx.update(documents).set({ title: data.title, caption: data.caption ?? null, kind: data.kind }).where(eq(documents.id, d.id));
    await audit(tx, actor, { action: "update", entity: "document", entityId: d.id, projectId: d.projectId, data });
    return { id: d.id };
  });
}

export async function setDocumentArchived(actor: Actor, id: string, input: unknown) {
  const data = z.object({ archived: z.boolean(), reason: zReason }).parse(input);
  assertCan(actor, "record.void");
  return inTx(async (tx) => {
    const d = await loadDoc(tx, actor, id, true);
    await tx
      .update(documents)
      .set({ status: data.archived ? "ARCHIVED" : "ACTIVE", statusReason: data.reason })
      .where(eq(documents.id, d.id));
    await audit(tx, actor, { action: data.archived ? "archive" : "restore", entity: "document", entityId: d.id, projectId: d.projectId, reason: data.reason });
    return { id: d.id };
  });
}
