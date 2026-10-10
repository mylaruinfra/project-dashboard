import { describe, expect, it } from "vitest";
import { setReaderForTests } from "@/server/ai";
import type { DocumentReader, RawExtraction } from "@/server/ai/types";
import { confirmDraft, createDraft, deleteDraft, getDraft, listDrafts, rejectDraft } from "@/server/services/drafts.service";
import { getProject } from "@/server/services/projects.service";
import { projectStockSummary } from "@/server/services/stock.service";
import { listTransactions } from "@/server/services/transactions.service";
import { expectAppError, hasTestDb, makeWorld, useTestDb } from "../support/db";

const PDF = { name: "bill.pdf", type: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.4 bill") };

const bill: RawExtraction = {
  documentType: "bill",
  vendorName: "Sri Sai Traders",
  vendorGstin: null,
  documentNumber: "SST/245",
  date: "05/10/2026",
  vehicleNo: null,
  lines: [{ description: "Cement OPC 53 grade", quantity: "50", unit: "bags", rate: "700", amount: "35,000" }],
  subtotal: "35,000",
  taxTotal: "6,300",
  total: "41,300",
};

function fakeReader(raw: RawExtraction): DocumentReader {
  return { name: "fake", read: async () => raw };
}

describe.skipIf(!hasTestDb)("AI drafts", () => {
  useTestDb();

  it("reads a bill into a draft that does not count until confirmed", async () => {
    const w = await makeWorld();
    setReaderForTests(fakeReader(bill));
    const d = await createDraft(w.manager, { projectId: w.project.id, kind: "TRANSACTION" }, PDF);
    const draft = await getDraft(w.manager, d.id);
    expect(draft.status).toBe("PENDING");
    expect(draft.extracted!.normalized.lines[0]!.amount).toBe(35_000_00);
    expect(draft.extracted!.suggestions.vendorId).toBe(w.vendor.id);
    expect(draft.extracted!.suggestions.lineMaterialIds[0]).toBe(w.cement.id);
    expect(draft.checks.find((c) => c.id === "line-0")!.status).toBe("pass");
    expect((await getProject(w.manager, w.project.id)).kpis!.actualCost).toBe(0);
    expect((await listTransactions(w.manager, { projectId: w.project.id })).total).toBe(0);

    const r = await confirmDraft(w.manager, d.id, {
      vendorId: w.vendor.id,
      date: "2026-10-05",
      billNo: "SST/245",
      phase: "CIVIL",
      lines: [
        { type: "MATERIAL", materialId: w.cement.id, qty: "50", rate: "700" },
        { type: "OTHER", item: "GST on bill", amount: "6300" },
      ],
    });
    expect(r.created).toHaveLength(2);
    expect((await getProject(w.manager, w.project.id)).kpis!.actualCost).toBe(41_300_00);
    const list = await listTransactions(w.manager, { projectId: w.project.id });
    expect(list.rows.every((t) => t.source === "AI")).toBe(true);
    await expectAppError(confirmDraft(w.manager, d.id, { date: "2026-10-05", lines: [{ type: "OTHER", item: "x", amount: "1" }] }), "BUSINESS_RULE", /already/);
  });

  it("works without an AI key: empty draft for manual entry", async () => {
    const w = await makeWorld();
    setReaderForTests(null);
    const d = await createDraft(w.manager, { projectId: w.project.id, kind: "TRANSACTION" }, PDF);
    expect(d.readError).toMatch(/off/);
    const draft = await getDraft(w.manager, d.id);
    expect(draft.extracted).toBeNull();
    await confirmDraft(w.manager, d.id, { date: "2026-10-05", lines: [{ type: "SITE_EXPENSE", item: "Water tanker", amount: "1200" }] });
  });

  it("a reader failure still leaves a usable draft", async () => {
    const w = await makeWorld();
    setReaderForTests({ name: "broken", read: async () => { throw new Error("timeout"); } });
    const d = await createDraft(w.manager, { projectId: w.project.id, kind: "TRANSACTION" }, PDF);
    expect(d.readError).toMatch(/by hand/);
  });

  it("delivery drafts: engineers upload challans and confirm deliveries into stock", async () => {
    const w = await makeWorld();
    setReaderForTests(fakeReader({ ...bill, documentType: "challan", lines: [{ description: "Cement OPC 53", quantity: "100", unit: "bags", rate: null, amount: null }] }));
    await expectAppError(createDraft(w.engineer, { projectId: w.project.id, kind: "TRANSACTION" }, PDF), "FORBIDDEN");
    const d = await createDraft(w.engineer, { projectId: w.project.id, kind: "DELIVERY" }, PDF);
    await confirmDraft(w.engineer, d.id, { vendorId: w.vendor.id, date: "2026-10-05", challanNo: "DC-1", lines: [{ materialId: w.cement.id, qty: "100" }] });
    const [line] = await projectStockSummary(w.engineer, w.project.id);
    expect(line!.received).toBe(100_000);
    expect((await listDrafts(w.engineer, { status: "ALL" })).total).toBe(1);
  });

  it("validation errors on confirm point at the line", async () => {
    const w = await makeWorld();
    setReaderForTests(null);
    const d = await createDraft(w.manager, { projectId: w.project.id, kind: "TRANSACTION" }, PDF);
    const err = await expectAppError(confirmDraft(w.manager, d.id, { date: "2026-10-05", lines: [{ type: "MATERIAL", qty: "5", rate: "10" }] }), "VALIDATION", /Line 1/);
    expect(Object.keys(err.fields ?? {})).toContain("lines.0.materialId");
    expect((await getDraft(w.manager, d.id)).status).toBe("PENDING"); // rolled back
  });

  it("reject keeps the record; delete is admin-only and never for confirmed drafts", async () => {
    const w = await makeWorld();
    setReaderForTests(null);
    const a = await createDraft(w.manager, { projectId: w.project.id, kind: "TRANSACTION" }, PDF);
    await expectAppError(rejectDraft(w.manager, a.id, { reason: "" }), "VALIDATION");
    await rejectDraft(w.manager, a.id, { reason: "Duplicate upload" });
    expect((await getDraft(w.manager, a.id)).status).toBe("REJECTED");
    await expectAppError(deleteDraft(w.manager, a.id, { reason: "Junk" }), "FORBIDDEN");
    await deleteDraft(w.admin, a.id, { reason: "Junk" });
    await expectAppError(getDraft(w.admin, a.id), "NOT_FOUND");
    const b = await createDraft(w.manager, { projectId: w.project.id, kind: "TRANSACTION" }, PDF);
    await confirmDraft(w.manager, b.id, { date: "2026-10-05", lines: [{ type: "SITE_EXPENSE", item: "Water", amount: "100" }] });
    await expectAppError(deleteDraft(w.admin, b.id, { reason: "Junk" }), "BUSINESS_RULE");
  });
});
