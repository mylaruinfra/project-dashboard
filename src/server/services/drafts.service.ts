/**
 * AI drafts: upload a bill or challan → reader extracts → normalized draft with checks →
 * a person confirms (creates real records through the normal services) or rejects it.
 * Nothing in a draft counts anywhere until it is confirmed.
 */
import { and, count, desc, eq, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";
import { todayIso } from "@/lib/dates";
import { PHASES } from "@/lib/domain";
import { zDate, zId, zMoney, zOptionalId, zPage, zQty, zReason, zText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { audit } from "../audit";
import { getReader } from "../ai";
import { type Check, type Normalized, normalizeExtraction, runChecks } from "../ai/normalize";
import { type DbOrTx, getDb } from "../db/client";
import { aiDrafts, documents, materials, projects, users, vendors } from "../db/schema";
import { AppError, forbidden, notFound, rule } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan, assertProjectAccess, can } from "../permissions";
import { getStorage } from "../storage/files";
import { inTx } from "../tx";
import { storeDocument, type UploadFile, validateFile } from "./documents.service";
import { projectScopeFilter } from "./scope";
import { insertReceipt } from "./stock.service";
import { insertTransaction } from "./transactions.service";

export interface DraftSuggestions {
  vendorId: string | null;
  lineMaterialIds: (string | null)[];
}

export interface DraftExtracted {
  normalized: Normalized;
  suggestions: DraftSuggestions;
}

const DRAFT_KIND = z.enum(["TRANSACTION", "DELIVERY"]);

function assertDraftKind(actor: Actor, kind: "TRANSACTION" | "DELIVERY") {
  if (kind === "TRANSACTION") assertCan(actor, "finance.write");
  else assertCan(actor, "field.write");
}

/** Matches vendor by GSTIN, then by name; materials by name words. */
async function suggest(db: DbOrTx, n: Normalized): Promise<DraftSuggestions> {
  let vendorId: string | null = null;
  if (n.vendorGstin) {
    const [v] = await db.select({ id: vendors.id }).from(vendors).where(and(eq(vendors.gstin, n.vendorGstin), eq(vendors.status, "ACTIVE"))).limit(1);
    vendorId = v?.id ?? null;
  }
  if (!vendorId && n.vendorName) {
    const first = n.vendorName.split(/\s+/).slice(0, 2).join(" ");
    const [v] = await db.select({ id: vendors.id }).from(vendors).where(and(ilike(vendors.name, `%${first}%`), eq(vendors.status, "ACTIVE"))).limit(1);
    vendorId = v?.id ?? null;
  }
  const mats = await db.select({ id: materials.id, name: materials.name }).from(materials).where(eq(materials.status, "ACTIVE"));
  const lineMaterialIds = n.lines.map((l) => {
    const desc = l.description.toLowerCase();
    const hit = mats
      .filter((m) => desc.includes(m.name.toLowerCase()) || m.name.toLowerCase().split(/\s+/).every((w) => desc.includes(w)))
      .sort((a, b) => b.name.length - a.name.length)[0];
    return hit?.id ?? null;
  });
  return { vendorId, lineMaterialIds };
}

async function readAndCheck(db: DbOrTx, bytes: Uint8Array, mimeType: string, kind: "TRANSACTION" | "DELIVERY") {
  const reader = getReader();
  if (!reader) return { provider: "none", extracted: null, checks: [] as Check[], readError: "AI reading is off. Fill in the details by hand." };
  try {
    const raw = await reader.read({ bytes, mimeType, kind });
    const normalized = normalizeExtraction(raw);
    const checks = runChecks(normalized, { today: todayIso(), kind });
    const suggestions = await suggest(db, normalized);
    return { provider: reader.name, extracted: { normalized, suggestions } satisfies DraftExtracted, checks, readError: null };
  } catch (err) {
    console.error("AI read failed", err);
    return { provider: reader.name, extracted: null, checks: [] as Check[], readError: "The file could not be read automatically. Fill in the details by hand." };
  }
}

/* ---------- create ---------- */

export const createDraftInput = z.object({ projectId: zId, kind: DRAFT_KIND });

export async function createDraft(actor: Actor, input: unknown, file: UploadFile) {
  const data = createDraftInput.parse(input);
  assertDraftKind(actor, data.kind);
  const mimeType = validateFile(file);
  await assertProjectAccess(getDb(), actor, data.projectId, { write: true });
  // Read outside the DB transaction: it can take a while.
  const result = await readAndCheck(getDb(), file.bytes, mimeType, data.kind);
  return inTx(async (tx) => {
    const doc = await storeDocument(
      tx,
      actor,
      { projectId: data.projectId, kind: data.kind === "TRANSACTION" ? "BILL" : "CHALLAN", title: file.name.replace(/\.[^.]+$/, "") || undefined, entityType: "project", entityId: data.projectId, caption: undefined },
      file,
    );
    const [d] = await tx
      .insert(aiDrafts)
      .values({
        projectId: data.projectId,
        documentId: doc.id,
        kind: data.kind,
        provider: result.provider,
        extracted: result.extracted,
        checks: result.checks,
        readError: result.readError,
        createdBy: actor.id,
      })
      .returning({ id: aiDrafts.id });
    await audit(tx, actor, { action: "create", entity: "ai_draft", entityId: d!.id, projectId: data.projectId, data: { kind: data.kind, provider: result.provider, read: !result.readError } });
    return { id: d!.id, readError: result.readError };
  });
}

/** Runs the reader again on a pending draft (e.g. after adding an API key). */
export async function rereadDraft(actor: Actor, id: string) {
  const draft = await loadDraft(getDb(), actor, id);
  if (draft.status !== "PENDING") throw rule("Only drafts waiting for review can be read again.");
  const [doc] = await getDb().select().from(documents).where(eq(documents.id, draft.documentId)).limit(1);
  const bytes = await getStorage().get(doc!.storageKey);
  const result = await readAndCheck(getDb(), bytes, doc!.mimeType, draft.kind);
  return inTx(async (tx) => {
    await tx
      .update(aiDrafts)
      .set({ provider: result.provider, extracted: result.extracted, checks: result.checks, readError: result.readError })
      .where(and(eq(aiDrafts.id, draft.id), eq(aiDrafts.status, "PENDING")));
    await audit(tx, actor, { action: "reread", entity: "ai_draft", entityId: draft.id, projectId: draft.projectId });
    return { id: draft.id, readError: result.readError };
  });
}

/* ---------- reads ---------- */

async function loadDraft(db: DbOrTx, actor: Actor, id: string, lock = false) {
  const q = db.select().from(aiDrafts).where(eq(aiDrafts.id, zId.parse(id))).limit(1);
  const [d] = lock ? await q.for("update") : await q;
  if (!d) throw notFound("Draft");
  if (d.kind === "TRANSACTION" && !can(actor, "finance.read")) throw forbidden();
  await assertProjectAccess(db, actor, d.projectId);
  return d;
}

export async function getDraft(actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const db = getDb();
  const d = await loadDraft(db, actor, id);
  const [doc] = await db.select({ id: documents.id, title: documents.title, mimeType: documents.mimeType }).from(documents).where(eq(documents.id, d.documentId));
  const [p] = await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, d.projectId));
  const [by] = await db.select({ name: users.name }).from(users).where(eq(users.id, d.createdBy));
  return {
    ...d,
    extracted: (d.extracted as DraftExtracted | null) ?? null,
    checks: (d.checks as Check[]) ?? [],
    document: doc!,
    project: p!,
    createdByName: by?.name ?? "",
  };
}

export type DraftDetail = Awaited<ReturnType<typeof getDraft>>;

export async function listDrafts(actor: Actor, query: unknown) {
  assertCan(actor, "project.read");
  const q = z
    .object({
      page: zPage.optional().default(1),
      projectId: zOptionalId,
      status: z.enum(["PENDING", "CONFIRMED", "REJECTED", "ALL"]).optional().catch("PENDING"),
    })
    .parse(query);
  const db = getDb();
  const { limit, offset, page } = pageWindow(q.page);
  const where: SQL | undefined = and(
    await projectScopeFilter(actor, aiDrafts.projectId),
    can(actor, "finance.read") ? undefined : eq(aiDrafts.kind, "DELIVERY"),
    q.projectId ? eq(aiDrafts.projectId, q.projectId) : undefined,
    q.status === "ALL" ? undefined : eq(aiDrafts.status, q.status ?? "PENDING"),
  );
  const rows = await db
    .select({
      id: aiDrafts.id,
      kind: aiDrafts.kind,
      status: aiDrafts.status,
      provider: aiDrafts.provider,
      readError: aiDrafts.readError,
      checks: aiDrafts.checks,
      createdAt: aiDrafts.createdAt,
      projectId: aiDrafts.projectId,
      projectName: projects.name,
      documentTitle: documents.title,
      createdByName: users.name,
    })
    .from(aiDrafts)
    .innerJoin(projects, eq(projects.id, aiDrafts.projectId))
    .innerJoin(documents, eq(documents.id, aiDrafts.documentId))
    .innerJoin(users, eq(users.id, aiDrafts.createdBy))
    .where(where)
    .orderBy(desc(aiDrafts.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(aiDrafts).where(where);
  return paged(
    rows.map((r) => {
      const checks = (r.checks as Check[]) ?? [];
      return { ...r, checks: undefined, failed: checks.filter((c) => c.status === "fail").length, warned: checks.filter((c) => c.status === "warn").length };
    }),
    total,
    page,
  );
}

/* ---------- confirm / reject / delete ---------- */

const optMoney = z.union([zMoney, z.literal(""), z.null()]).optional().transform((v) => (v === "" || v === null ? undefined : v));
const optQty = z.union([zQty, z.literal(""), z.null()]).optional().transform((v) => (v === "" || v === null ? undefined : v));

export const confirmTransactionInput = z.object({
  vendorId: zOptionalId,
  date: zDate,
  billNo: zText(50),
  phase: z.union([z.enum(PHASES), z.literal("")]).optional().transform((v) => v || undefined),
  slabId: zOptionalId,
  paidNow: z.boolean().default(false),
  notes: zText(1000),
  lines: z
    .array(
      z.object({
        type: z.enum(["MATERIAL", "MACHINERY", "LOGISTICS", "SITE_EXPENSE", "OTHER"]),
        materialId: zOptionalId,
        item: zText(200),
        spec: zText(200),
        qty: optQty,
        unit: zText(20),
        rate: optMoney,
        amount: optMoney,
      }),
    )
    .min(1, "Keep at least one line")
    .max(50),
});

export const confirmDeliveryInput = z.object({
  vendorId: zOptionalId,
  date: zDate,
  challanNo: zText(50),
  vehicleNo: zText(30),
  purchaseOrderId: zOptionalId,
  notes: zText(500),
  lines: z.array(z.object({ materialId: zId, qty: zQty })).min(1, "Keep at least one line").max(50),
});

export async function confirmDraft(actor: Actor, id: string, input: unknown) {
  return inTx(async (tx) => {
    const draft = await loadDraft(tx, actor, id, true);
    assertDraftKind(actor, draft.kind);
    await assertProjectAccess(tx, actor, draft.projectId, { write: true });
    if (draft.status !== "PENDING") throw rule("This draft was already reviewed.");
    const created: string[] = [];
    let entityType: "transaction" | "receipt";

    if (draft.kind === "TRANSACTION") {
      const d = confirmTransactionInput.parse(input);
      entityType = "transaction";
      for (const [i, line] of d.lines.entries()) {
        try {
          const r = await insertTransaction(
            tx,
            actor,
            draft.projectId,
            {
              type: line.type,
              date: d.date,
              item: line.item,
              spec: line.spec,
              materialId: line.materialId,
              qty: line.qty,
              unit: line.unit,
              rate: line.rate,
              amount: line.amount,
              vendorId: d.vendorId,
              phase: d.phase,
              slabId: d.slabId,
              billNo: d.billNo,
              billLine: i + 1,
              paidNow: d.paidNow,
              notes: d.notes,
            },
            { source: "AI", aiDraftId: draft.id },
          );
          created.push(r.id);
        } catch (err) {
          if (err instanceof AppError && err.fields) {
            throw new AppError(err.code, `Line ${i + 1}: ${err.message}`, Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [`lines.${i}.${k}`, v])));
          }
          throw err;
        }
      }
    } else {
      const d = confirmDeliveryInput.parse(input);
      entityType = "receipt";
      for (const [i, line] of d.lines.entries()) {
        const r = await insertReceipt(
          tx,
          actor,
          {
            projectId: draft.projectId,
            materialId: line.materialId,
            vendorId: d.vendorId,
            purchaseOrderId: d.purchaseOrderId,
            date: d.date,
            qty: line.qty,
            challanNo: d.challanNo,
            challanLine: i + 1,
            vehicleNo: d.vehicleNo,
            notes: d.notes,
          },
          { source: "AI", aiDraftId: draft.id },
        );
        created.push(r.id);
      }
    }

    // The bill / challan now belongs to the first record it produced.
    await tx.update(documents).set({ entityType, entityId: created[0]! }).where(eq(documents.id, draft.documentId));
    await tx.update(aiDrafts).set({ status: "CONFIRMED", decidedBy: actor.id, decidedAt: new Date() }).where(eq(aiDrafts.id, draft.id));
    await audit(tx, actor, { action: "confirm", entity: "ai_draft", entityId: draft.id, projectId: draft.projectId, data: { created, entityType } });
    return { id: draft.id, created, entityType };
  });
}

export async function rejectDraft(actor: Actor, id: string, input: unknown) {
  const { reason } = z.object({ reason: zReason }).parse(input);
  return inTx(async (tx) => {
    const draft = await loadDraft(tx, actor, id, true);
    assertDraftKind(actor, draft.kind);
    if (draft.status !== "PENDING") throw rule("This draft was already reviewed.");
    await tx.update(aiDrafts).set({ status: "REJECTED", decisionReason: reason, decidedBy: actor.id, decidedAt: new Date() }).where(eq(aiDrafts.id, draft.id));
    await audit(tx, actor, { action: "reject", entity: "ai_draft", entityId: draft.id, projectId: draft.projectId, reason });
    return { id: draft.id };
  });
}

/** Admin only: removes a throwaway draft. The uploaded file is kept but archived (evidence). */
export async function deleteDraft(actor: Actor, id: string, input: unknown) {
  const { reason } = z.object({ reason: zReason }).parse(input);
  assertCan(actor, "draft.delete");
  return inTx(async (tx) => {
    const draft = await loadDraft(tx, actor, id, true);
    if (draft.status === "CONFIRMED") throw rule("Confirmed drafts are part of the record and cannot be deleted.");
    await tx.delete(aiDrafts).where(eq(aiDrafts.id, draft.id));
    await tx.update(documents).set({ status: "ARCHIVED", statusReason: `Draft deleted: ${reason}` }).where(eq(documents.id, draft.documentId));
    await audit(tx, actor, { action: "delete", entity: "ai_draft", entityId: draft.id, projectId: draft.projectId, reason });
    return { id: draft.id };
  });
}

export async function pendingDraftCount(actor: Actor): Promise<number> {
  const where = and(
    await projectScopeFilter(actor, aiDrafts.projectId),
    can(actor, "finance.read") ? undefined : eq(aiDrafts.kind, "DELIVERY"),
    eq(aiDrafts.status, "PENDING"),
  );
  const [{ n } = { n: 0 }] = await getDb().select({ n: count() }).from(aiDrafts).where(where);
  return n;
}

