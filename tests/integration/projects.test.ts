import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";
import { getProject, listProjects, setProjectStatus, slabOptions, updateBuilding, updateEstimate, updateSite } from "@/server/services/projects.service";
import { createProject } from "@/server/services/projects.service";
import { createTransaction } from "@/server/services/transactions.service";
import { expectAppError, hasTestDb, makeWorld, useTestDb, villaInput } from "../support/db";

describe.skipIf(!hasTestDb)("projects", () => {
  useTestDb();

  it("wizard creates floors, slabs and the estimate on the server", async () => {
    const w = await makeWorld();
    const p = await getProject(w.manager, w.project.id);
    expect(p.code).toBe("MYL-0001");
    expect(p.floors).toHaveLength(3);
    expect(p.totalSlabArea).toBe(5300_00);
    expect(p.plotArea).toBe(2400_00);
    expect(p.estimatedCost).toBe(1_06_00_000_00);
    expect(p.phaseBudgets).toEqual({ EXCAVATION: 5_00_000_00, CIVIL: 70_00_000_00 });
    expect(p.kpis?.clientBalance).toBe(1_06_00_000_00);
    const logs = await getDb().select().from(auditLogs).where(eq(auditLogs.entityId, w.project.id));
    expect(logs.some((l) => l.action === "create")).toBe(true);
  });

  it("validates the wizard: dates, floors vs counts, irregular plot area", async () => {
    const w = await makeWorld();
    const bad = villaInput(w.client.id);
    bad.basics.expectedCompletion = "2026-01-01";
    await expectAppError(createProject(w.manager, bad), "VALIDATION");
    const bad2 = villaInput(w.client.id);
    bad2.building.floorsAbove = 3;
    await expectAppError(createProject(w.manager, bad2), "VALIDATION");
    const irregular = villaInput(w.client.id);
    (irregular.site as Record<string, unknown>).plotShape = "IRREGULAR";
    await expectAppError(createProject(w.manager, irregular), "VALIDATION");
    (irregular.site as Record<string, unknown>).plotArea = "2150.5";
    const ok = await createProject(w.manager, irregular);
    expect((await getProject(w.manager, ok.id)).plotArea).toBe(2150_50);
  });

  it("GPS can be added later and the reminder clears", async () => {
    const w = await makeWorld();
    const input = villaInput(w.client.id);
    delete (input.site as Record<string, unknown>).latitude;
    delete (input.site as Record<string, unknown>).longitude;
    const p = await createProject(w.manager, input);
    expect((await getProject(w.manager, p.id)).gpsMissing).toBe(true);
    await expectAppError(updateSite(w.manager, p.id, { ...input.site, latitude: "17.3" }), "VALIDATION");
    await updateSite(w.manager, p.id, { ...input.site, latitude: "17.3", longitude: "78.4" });
    expect((await getProject(w.manager, p.id)).gpsMissing).toBe(false);
  });

  it("engineers only see assigned projects and never money", async () => {
    const w = await makeWorld();
    await createProject(w.manager, { ...villaInput(w.client.id), basics: { ...villaInput(w.client.id).basics, name: "Other site" } });
    const list = await listProjects(w.engineer, {});
    expect(list.rows.map((r) => r.name)).toEqual(["Villa Project"]);
    expect(list.rows[0]!.kpis).toBeNull();
    const p = await getProject(w.engineer, w.project.id);
    expect(p.estimatedCost).toBeNull();
    expect(p.costPerSft).toBeNull();
    expect(p.kpis).toBeNull();
    expect(p.phaseBudgets).toBeNull();
    await expectAppError(getProject(w.otherEngineer, w.project.id), "FORBIDDEN");
    expect((await listProjects(w.otherEngineer, {})).rows).toHaveLength(0);
    await expectAppError(createProject(w.engineer, villaInput(w.client.id)), "FORBIDDEN");
    await expectAppError(createProject(w.viewer, villaInput(w.client.id)), "FORBIDDEN");
  });

  it("building edits recompute the estimate and refuse to drop slabs with records", async () => {
    const w = await makeWorld();
    const p = await getProject(w.manager, w.project.id);
    const building = {
      floorsBelow: 0,
      floorsAbove: 2,
      hasTerrace: true,
      floors: [
        ...p.floors.map((f) => ({ id: f.id, level: f.level, name: f.name, isTerrace: false, slabs: f.slabs.map((s) => ({ id: s.id, name: s.name, length: s.length / 100, width: s.width / 100 })) })),
        { level: 3, name: "Terrace", isTerrace: true, slabs: [{ name: "Slab 1", length: 10, width: 10 }] },
      ],
    };
    const r = await updateBuilding(w.manager, w.project.id, building);
    expect(r.totalArea).toBe(5400_00);
    expect(r.estimatedCost).toBe(1_08_00_000_00);

    const slabId = p.floors[0]!.slabs[0]!.id;
    await createTransaction(w.manager, { projectId: w.project.id, type: "SITE_EXPENSE", date: "2026-10-06", item: "Tea", amount: "450", slabId });
    const without = { ...building, floors: building.floors.map((f, i) => (i === 0 ? { ...f, slabs: f.slabs.slice(1) } : f)) };
    await expectAppError(updateBuilding(w.manager, w.project.id, without), "BUSINESS_RULE", /records/);
    expect((await slabOptions(w.manager, w.project.id)).length).toBe(6);

    const est = await updateEstimate(w.manager, w.project.id, { costPerSft: "2500", contractValue: "15000000", phaseBudgets: {} });
    expect(est.estimatedCost).toBe(1_35_00_000_00);
    const after = await getProject(w.manager, w.project.id);
    expect(after.kpis?.clientBalance).toBe(1_50_00_000_00);
    expect(after.phaseBudgets).toEqual({});
  });

  it("archived projects are read-only and archiving needs a reason", async () => {
    const w = await makeWorld();
    await expectAppError(setProjectStatus(w.manager, w.project.id, { status: "ARCHIVED", reason: "" }), "VALIDATION");
    await setProjectStatus(w.manager, w.project.id, { status: "ARCHIVED", reason: "Duplicate entry" });
    await expectAppError(createTransaction(w.manager, { projectId: w.project.id, type: "SITE_EXPENSE", date: "2026-10-06", item: "Tea", amount: "100" }), "FORBIDDEN", /archived/);
    await expectAppError(setProjectStatus(w.engineer, w.project.id, { status: "ONGOING", reason: "Restore it" }), "FORBIDDEN");
    await setProjectStatus(w.manager, w.project.id, { status: "ONGOING", reason: "Restore it" });
  });
});
