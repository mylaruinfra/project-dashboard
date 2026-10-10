import { describe, expect, it } from "vitest";
import { createProject } from "@/server/services/projects.service";
import { createTransaction } from "@/server/services/transactions.service";
import {
  createPurchaseOrder,
  createReceipt,
  createUsage,
  getPurchaseOrder,
  projectStockSummary,
  setPurchaseOrderStatus,
  stockByProject,
  updateReceipt,
  updateUsage,
  voidReceipt,
  voidUsage,
} from "@/server/services/stock.service";
import { expectAppError, hasTestDb, makeWorld, useTestDb, villaInput } from "../support/db";

describe.skipIf(!hasTestDb)("materials: purchased → received → used → remaining", () => {
  useTestDb();

  it("tracks the full flow including partial deliveries", async () => {
    const w = await makeWorld();
    const pid = w.project.id;
    await createTransaction(w.manager, { projectId: pid, type: "MATERIAL", date: "2026-10-05", materialId: w.cement.id, qty: "100", rate: "700", vendorId: w.vendor.id });
    await createReceipt(w.engineer, { projectId: pid, materialId: w.cement.id, vendorId: w.vendor.id, date: "2026-10-05", qty: "60", challanNo: "CH-1" });
    await createUsage(w.engineer, { projectId: pid, materialId: w.cement.id, date: "2026-10-06", qty: "45", phase: "CIVIL" });
    const [line] = await projectStockSummary(w.manager, pid);
    expect(line).toMatchObject({ purchased: 100_000, received: 60_000, used: 45_000, remaining: 15_000, pendingDelivery: 40_000, purchasedValue: 70_000_00 });
    const [eng] = await projectStockSummary(w.engineer, pid);
    expect(eng!.purchasedValue).toBeNull();
  });

  it("never lets stock go negative", async () => {
    const w = await makeWorld();
    const pid = w.project.id;
    const r = await createReceipt(w.engineer, { projectId: pid, materialId: w.cement.id, date: "2026-10-05", qty: "10" });
    await expectAppError(createUsage(w.engineer, { projectId: pid, materialId: w.cement.id, date: "2026-10-05", qty: "10.5" }), "BUSINESS_RULE", /Only 10 bags/);
    const u = await createUsage(w.engineer, { projectId: pid, materialId: w.cement.id, date: "2026-10-05", qty: "8" });
    await expectAppError(voidReceipt(w.manager, r.id, { reason: "Wrong project" }), "BUSINESS_RULE", /Void the usage/);
    await expectAppError(updateReceipt(w.engineer, r.id, { date: "2026-10-05", qty: "7" }), "BUSINESS_RULE");
    await expectAppError(updateUsage(w.engineer, u.id, { date: "2026-10-05", qty: "11" }), "BUSINESS_RULE");
    await updateUsage(w.engineer, u.id, { date: "2026-10-05", qty: "10" });
    await expectAppError(voidUsage(w.engineer, u.id, { reason: "Typo" }), "FORBIDDEN");
    await voidUsage(w.manager, u.id, { reason: "Typo" });
    await voidReceipt(w.manager, r.id, { reason: "Wrong project" });
    const [line] = await projectStockSummary(w.manager, pid);
    expect(line).toMatchObject({ received: 0, used: 0, remaining: 0 });
  });

  it("row locks serialise concurrent usage so only one can take the last stock", async () => {
    const w = await makeWorld();
    const pid = w.project.id;
    await createReceipt(w.engineer, { projectId: pid, materialId: w.cement.id, date: "2026-10-05", qty: "10" });
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => createUsage(w.engineer, { projectId: pid, materialId: w.cement.id, date: "2026-10-05", qty: "6" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [line] = await projectStockSummary(w.manager, pid);
    expect(line!.remaining).toBe(4_000);
  });

  it("challan numbers are unique per vendor, ignoring void deliveries", async () => {
    const w = await makeWorld();
    const body = { projectId: w.project.id, materialId: w.cement.id, vendorId: w.vendor.id, date: "2026-10-05", qty: "5", challanNo: "CH-9" };
    const r = await createReceipt(w.engineer, body);
    await expectAppError(createReceipt(w.engineer, body), "CONFLICT", /challan/);
    await voidReceipt(w.manager, r.id, { reason: "Re-entering" });
    await createReceipt(w.engineer, body);
  });

  it("engineers cannot reach other projects", async () => {
    const w = await makeWorld();
    await expectAppError(createReceipt(w.otherEngineer, { projectId: w.project.id, materialId: w.cement.id, date: "2026-10-05", qty: "5" }), "FORBIDDEN");
    await expectAppError(createReceipt(w.viewer, { projectId: w.project.id, materialId: w.cement.id, date: "2026-10-05", qty: "5" }), "FORBIDDEN");
  });

  it("optional purchase orders: totals, deliveries against them, void with reason", async () => {
    const w = await makeWorld();
    const po = await createPurchaseOrder(w.manager, {
      projectId: w.project.id,
      vendorId: w.vendor.id,
      date: "2026-10-05",
      lines: [
        { materialId: w.cement.id, qty: "200", rate: "700" },
        { materialId: w.steel.id, qty: "2.5", rate: "62000" },
      ],
    });
    expect(po.number).toBe("PO-00001");
    await createReceipt(w.engineer, { projectId: w.project.id, materialId: w.cement.id, purchaseOrderId: po.id, date: "2026-10-06", qty: "80" });
    const d = await getPurchaseOrder(w.manager, po.id);
    expect(d.total).toBe(1_40_000_00 + 1_55_000_00);
    expect(d.lines.find((l) => l.materialId === w.cement.id)!.received).toBe(80_000);
    await expectAppError(createPurchaseOrder(w.engineer, { projectId: w.project.id, vendorId: w.vendor.id, date: "2026-10-05", lines: [{ materialId: w.cement.id, qty: "1", rate: "1" }] }), "FORBIDDEN");
    await expectAppError(createPurchaseOrder(w.manager, { projectId: w.project.id, vendorId: w.vendor.id, number: "PO-00001", date: "2026-10-05", lines: [{ materialId: w.cement.id, qty: "1", rate: "1" }] }), "CONFLICT");
    await setPurchaseOrderStatus(w.manager, po.id, { status: "VOID", reason: "Vendor changed" });
    await createPurchaseOrder(w.manager, { projectId: w.project.id, vendorId: w.vendor.id, number: "PO-00001", date: "2026-10-05", lines: [{ materialId: w.cement.id, qty: "1", rate: "1" }] });
    await expectAppError(createReceipt(w.engineer, { projectId: w.project.id, materialId: w.cement.id, purchaseOrderId: po.id, date: "2026-10-06", qty: "1" }), "BUSINESS_RULE");
  });
});

describe.skipIf(!hasTestDb)("materials: stock grouped by project", () => {
  useTestDb();

  async function twoProjects() {
    const w = await makeWorld();
    const second = await createProject(w.manager, villaInput(w.client.id));
    const [a, b] = [w.project.id, second.id];
    for (const [pid, qty] of [[a, "10"], [b, "30"]] as const) {
      await createTransaction(w.manager, { projectId: pid, type: "MATERIAL", date: "2026-10-05", materialId: w.cement.id, qty, rate: "700", vendorId: w.vendor.id });
      await createReceipt(w.manager, { projectId: pid, materialId: w.cement.id, date: "2026-10-05", qty });
    }
    return { w, a, b };
  }

  it("returns one row per project and material, never summed across projects", async () => {
    const { w, a, b } = await twoProjects();
    const data = await stockByProject(w.manager, {});
    expect(data.total).toBe(2);
    expect(data.rows.map((r) => r.projectId).sort()).toEqual([a, b].sort());
    expect(data.rows.find((r) => r.projectId === a)).toMatchObject({ received: 10_000, remaining: 10_000, purchasedValue: 7_000_00 });
    expect(data.rows.find((r) => r.projectId === b)).toMatchObject({ received: 30_000, remaining: 30_000, purchasedValue: 21_000_00 });
  });

  it("gives an engineer only assigned projects and no money", async () => {
    const { w, a } = await twoProjects();
    const data = await stockByProject(w.engineer, {});
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ projectId: a, received: 10_000, purchasedValue: null });
    const none = await stockByProject(w.otherEngineer, {});
    expect(none.rows).toEqual([]);
  });
});
