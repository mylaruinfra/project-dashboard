import { describe, expect, it } from "vitest";
import { getDocument, listDocuments, readDocumentFile, setDocumentArchived, updateDocument, uploadDocument } from "@/server/services/documents.service";
import { createActivity, getActivity, listActivities, recordProgress, setActivityArchived, updateActivity } from "@/server/services/progress.service";
import { getProject } from "@/server/services/projects.service";
import { expectAppError, hasTestDb, makeWorld, useTestDb } from "../support/db";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.4 test");

describe.skipIf(!hasTestDb)("work & progress", () => {
  useTestDb();

  it("phase progress is the average of its activities; overall is the average of phases", async () => {
    const w = await makeWorld();
    const a = await createActivity(w.engineer, w.project.id, { phase: "EXCAVATION", name: "Earthwork" });
    const b = await createActivity(w.engineer, w.project.id, { phase: "EXCAVATION", name: "PCC" });
    const c = await createActivity(w.manager, w.project.id, { phase: "CIVIL", name: "Columns" });
    await recordProgress(w.engineer, a.id, { progress: 100, date: "2026-10-06" });
    await recordProgress(w.engineer, b.id, { progress: 50, date: "2026-10-06", note: "Half done" });
    await recordProgress(w.engineer, c.id, { progress: 30, date: "2026-10-06" });
    const { progress, phases } = await listActivities(w.engineer, w.project.id);
    expect(progress).toEqual({ EXCAVATION: 75, CIVIL: 30, INTERIOR: 0, overall: 35 });
    expect(phases.EXCAVATION.find((x) => x.id === a.id)!.status).toBe("COMPLETED");
    await expectAppError(recordProgress(w.engineer, b.id, { progress: 120 }), "VALIDATION");
    await expectAppError(recordProgress(w.viewer, b.id, { progress: 60 }), "FORBIDDEN");
    await expectAppError(setActivityArchived(w.engineer, b.id, { archived: true, reason: "Not needed" }), "FORBIDDEN");
    await setActivityArchived(w.manager, b.id, { archived: true, reason: "Not needed" });
    expect((await getProject(w.manager, w.project.id)).progress.EXCAVATION).toBe(100);
    await expectAppError(updateActivity(w.engineer, b.id, { phase: "EXCAVATION", name: "PCC" }), "BUSINESS_RULE");
    const detail = await getActivity(w.manager, c.id);
    expect(detail.history).toHaveLength(1);
  });
});

describe.skipIf(!hasTestDb)("documents", () => {
  useTestDb();

  it("stores files, checks type by content, and attaches to records", async () => {
    const w = await makeWorld();
    const d = await uploadDocument(w.engineer, { projectId: w.project.id, kind: "PHOTO", caption: "Footing" }, { name: "site.png", type: "image/png", bytes: PNG });
    const file = await readDocumentFile(w.engineer, d.id);
    expect(file.bytes.byteLength).toBe(PNG.byteLength);
    await expectAppError(uploadDocument(w.engineer, { projectId: w.project.id, kind: "PHOTO" }, { name: "x.png", type: "image/png", bytes: new TextEncoder().encode("not an image") }), "VALIDATION");
    await expectAppError(uploadDocument(w.viewer, { projectId: w.project.id, kind: "PHOTO" }, { name: "a.png", type: "image/png", bytes: PNG }), "FORBIDDEN");
    await expectAppError(uploadDocument(w.otherEngineer, { projectId: w.project.id, kind: "PHOTO" }, { name: "a.png", type: "image/png", bytes: PNG }), "FORBIDDEN");
    const photos = await listDocuments(w.manager, { projectId: w.project.id, kind: "PHOTO" });
    expect(photos.total).toBe(1);
    await updateDocument(w.engineer, d.id, { title: "Footing photo", kind: "PHOTO", caption: "Grid A" });
    expect((await getDocument(w.manager, d.id)).title).toBe("Footing photo");
  });

  it("bills are money documents: engineers can neither upload nor see them", async () => {
    const w = await makeWorld();
    await expectAppError(uploadDocument(w.engineer, { projectId: w.project.id, kind: "BILL" }, { name: "bill.pdf", type: "application/pdf", bytes: PDF }), "FORBIDDEN");
    const bill = await uploadDocument(w.manager, { projectId: w.project.id, kind: "BILL" }, { name: "bill.pdf", type: "application/pdf", bytes: PDF });
    expect((await listDocuments(w.engineer, { projectId: w.project.id })).total).toBe(0);
    await expectAppError(getDocument(w.engineer, bill.id), "FORBIDDEN");
    await expectAppError(setDocumentArchived(w.manager, bill.id, { archived: true, reason: "" }), "VALIDATION");
    await setDocumentArchived(w.manager, bill.id, { archived: true, reason: "Wrong file" });
    expect((await listDocuments(w.manager, { projectId: w.project.id })).total).toBe(0);
    expect((await listDocuments(w.manager, { projectId: w.project.id, status: "ARCHIVED" })).total).toBe(1);
  });
});
