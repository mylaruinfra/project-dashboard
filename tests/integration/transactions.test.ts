import { describe, expect, it } from "vitest";
import { getProject } from "@/server/services/projects.service";
import { createTransaction, getTransaction, listPendingPayments, listTransactions, updateTransaction, voidTransaction } from "@/server/services/transactions.service";
import { expectAppError, hasTestDb, makeWorld, useTestDb } from "../support/db";

describe.skipIf(!hasTestDb)("transactions", () => {
  useTestDb();

  it("computes amounts on the server and numbers them", async () => {
    const w = await makeWorld();
    const t = await createTransaction(w.manager, {
      projectId: w.project.id,
      type: "MATERIAL",
      date: "2026-10-05",
      materialId: w.cement.id,
      qty: "50",
      rate: "700",
      amount: "1", // ignored: amount is qty × rate
      vendorId: w.vendor.id,
      phase: "CIVIL",
      billNo: "SST-1",
    });
    expect(t.number).toBe("TXN-000001");
    expect(t.amount).toBe(35_000_00);
    const d = await getTransaction(w.manager, t.id);
    expect(d.item).toBe("Cement OPC 53");
    expect(d.unit).toBe("bags");
    expect(d.qty).toBe(50_000);
  });

  it("enforces per-type required fields and project-owned slabs", async () => {
    const w = await makeWorld();
    const err = await expectAppError(createTransaction(w.manager, { projectId: w.project.id, type: "MATERIAL", date: "2026-10-05" }), "VALIDATION");
    expect(Object.keys(err.fields ?? {})).toEqual(expect.arrayContaining(["materialId", "qty", "rate", "vendorId"]));
    await expectAppError(createTransaction(w.manager, { projectId: w.project.id, type: "CONTRACTOR_PAYMENT", date: "2026-10-05", amount: "1000" }), "VALIDATION");
    await expectAppError(
      createTransaction(w.manager, { projectId: w.project.id, type: "SITE_EXPENSE", date: "2026-10-05", item: "Tea", amount: "100", slabId: "00000000-0000-4000-8000-000000000009" }),
      "BUSINESS_RULE",
    );
    await expectAppError(createTransaction(w.manager, { projectId: w.project.id, type: "SITE_EXPENSE", date: "2026-02-30", item: "Tea", amount: "100" }), "VALIDATION");
    await expectAppError(createTransaction(w.manager, { projectId: w.project.id, type: "SITE_EXPENSE", date: "2026-10-05", item: "Tea", amount: "10.555" }), "VALIDATION");
  });

  it("KPIs: actual cost counts expenses + labor + machinery, paid or not; payments are separate", async () => {
    const w = await makeWorld();
    const pid = w.project.id;
    const add = (body: Record<string, unknown>) => createTransaction(w.manager, { projectId: pid, date: "2026-10-05", ...body });
    await add({ type: "MATERIAL", materialId: w.cement.id, qty: "50", rate: "700", vendorId: w.vendor.id }); // 35,000 unpaid
    await add({ type: "LABOR", laborType: "Mason", workers: 4, days: "1", rate: "900", vendorId: w.contractor.id }); // 3,600 unpaid
    await add({ type: "MACHINERY", item: "JCB", qty: "8", unit: "hours", rate: "1500" }); // 12,000 paid (no vendor)
    await add({ type: "LOGISTICS", item: "Sand transport", qty: "1", unit: "trips", rate: "3500", vendorId: w.vendor.id, paidNow: true }); // 3,500 paid now
    await add({ type: "SITE_EXPENSE", item: "Tea", amount: "450" });
    await add({ type: "OTHER", item: "Permit fee", amount: "2000" });
    await add({ type: "CLIENT_PAYMENT", amount: "500000", paymentMode: "UPI" });
    await add({ type: "CONTRACTOR_PAYMENT", vendorId: w.vendor.id, amount: "20000" });
    const voided = await add({ type: "SITE_EXPENSE", item: "Duplicate", amount: "9999" });
    await voidTransaction(w.manager, voided.id, { reason: "Entered twice" });

    const p = await getProject(w.manager, pid);
    expect(p.kpis!.actualCost).toBe(35_000_00 + 3_600_00 + 12_000_00 + 3_500_00 + 450_00 + 2_000_00);
    expect(p.kpis!.clientReceived).toBe(5_00_000_00);
    expect(p.kpis!.clientBalance).toBe(1_06_00_000_00 - 5_00_000_00);
    expect(p.kpis!.remaining).toBe(p.kpis!.estimatedCost - p.kpis!.actualCost);
    // vendor: 35,000 unpaid (3,500 was paid now) − 20,000 paid = 15,000; labor party: 3,600
    expect(p.kpis!.pendingPayments).toBe(15_000_00 + 3_600_00);
    const pend = await listPendingPayments(w.manager, { projectId: pid });
    expect(pend.rows.map((r) => [r.vendorName, r.pending])).toEqual([
      ["Sri Sai Traders", 15_000_00],
      ["Ramesh Labor Party", 3_600_00],
    ]);
  });

  it("void needs a reason, keeps the row, and frees the bill number", async () => {
    const w = await makeWorld();
    const body = { projectId: w.project.id, type: "MATERIAL", date: "2026-10-05", materialId: w.cement.id, qty: "10", rate: "700", vendorId: w.vendor.id, billNo: "B-77" };
    const t = await createTransaction(w.manager, body);
    await expectAppError(createTransaction(w.manager, body), "CONFLICT", /bill number/);
    await expectAppError(voidTransaction(w.manager, t.id, { reason: "" }), "VALIDATION");
    await expectAppError(voidTransaction(w.engineer, t.id, { reason: "Wrong" }), "FORBIDDEN");
    await expectAppError(voidTransaction(w.viewer, t.id, { reason: "Wrong" }), "FORBIDDEN");
    await voidTransaction(w.manager, t.id, { reason: "Wrong qty" });
    await expectAppError(voidTransaction(w.manager, t.id, { reason: "Again" }), "BUSINESS_RULE");
    await expectAppError(updateTransaction(w.manager, t.id, { ...body }), "BUSINESS_RULE");
    const again = await createTransaction(w.manager, body); // same bill number allowed once the first is void
    expect(again.number).toBe("TXN-000002");
    const d = await getTransaction(w.manager, t.id);
    expect(d.status).toBe("VOID");
    expect(d.voidReason).toBe("Wrong qty");
    expect(d.history.some((h) => h.action === "void" && h.reason === "Wrong qty")).toBe(true);
    expect((await listTransactions(w.manager, { projectId: w.project.id })).total).toBe(1);
    expect((await listTransactions(w.manager, { projectId: w.project.id, status: "VOID" })).total).toBe(1);
  });

  it("edits recompute the amount and are audited", async () => {
    const w = await makeWorld();
    const t = await createTransaction(w.manager, { projectId: w.project.id, type: "MACHINERY", date: "2026-10-05", item: "JCB", qty: "8", unit: "hours", rate: "1500" });
    await updateTransaction(w.manager, t.id, { date: "2026-10-06", item: "JCB", qty: "10", unit: "hours", rate: "1500" });
    const d = await getTransaction(w.manager, t.id);
    expect(d.amount).toBe(15_000_00);
    expect(d.history[0]!.action).toBe("update");
  });

  it("engineers record labor only, at the rate card, and never see money", async () => {
    const w = await makeWorld();
    const att = await createTransaction(w.engineer, { projectId: w.project.id, type: "LABOR", date: "2026-10-05", laborType: "Mason", workers: 3, days: "1", rate: "1" });
    const asManager = await getTransaction(w.manager, att.id);
    expect(asManager.rate).toBe(900_00); // rate card, not what the engineer sent
    expect(asManager.amount).toBe(2_700_00);
    const asEngineer = await getTransaction(w.engineer, att.id);
    expect(asEngineer.amount).toBeNull();
    expect(asEngineer.rate).toBeNull();
    await expectAppError(createTransaction(w.engineer, { projectId: w.project.id, type: "SITE_EXPENSE", date: "2026-10-05", item: "Tea", amount: "100" }), "FORBIDDEN");
    await expectAppError(createTransaction(w.engineer, { projectId: w.project.id, type: "LABOR", date: "2026-10-05", laborType: "Painter", workers: 1, days: "1" }), "BUSINESS_RULE", /rate/);
    await expectAppError(createTransaction(w.otherEngineer, { projectId: w.project.id, type: "LABOR", date: "2026-10-05", laborType: "Mason", workers: 1, days: "1" }), "FORBIDDEN");
    const exp = await createTransaction(w.manager, { projectId: w.project.id, type: "SITE_EXPENSE", date: "2026-10-05", item: "Tea", amount: "100" });
    await expectAppError(getTransaction(w.engineer, exp.id), "FORBIDDEN");
    const list = await listTransactions(w.engineer, { projectId: w.project.id });
    expect(list.rows.every((r) => r.type === "LABOR" && r.amount === null && r.rate === null)).toBe(true);
    await updateTransaction(w.engineer, att.id, { date: "2026-10-05", laborType: "Mason", workers: 5, days: "1" });
    expect((await getTransaction(w.manager, att.id)).amount).toBe(4_500_00);
    await expectAppError(createTransaction(w.viewer, { projectId: w.project.id, type: "SITE_EXPENSE", date: "2026-10-05", item: "Tea", amount: "100" }), "FORBIDDEN");
  });

  it("lists with filters and pagination", async () => {
    const w = await makeWorld();
    for (let i = 0; i < 25; i++) {
      await createTransaction(w.manager, { projectId: w.project.id, type: i % 2 ? "SITE_EXPENSE" : "OTHER", date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, item: `Item ${i}`, amount: "100", phase: i < 5 ? "EXCAVATION" : "CIVIL" });
    }
    const p1 = await listTransactions(w.manager, { projectId: w.project.id });
    expect(p1.rows).toHaveLength(20);
    expect(p1.pageCount).toBe(2);
    expect((await listTransactions(w.manager, { projectId: w.project.id, page: 2 })).rows).toHaveLength(5);
    expect((await listTransactions(w.manager, { projectId: w.project.id, type: "OTHER" })).total).toBe(13);
    expect((await listTransactions(w.manager, { projectId: w.project.id, phase: "EXCAVATION" })).total).toBe(5);
    expect((await listTransactions(w.manager, { projectId: w.project.id, from: "2026-10-10", to: "2026-10-12" })).total).toBe(3);
  });
});
