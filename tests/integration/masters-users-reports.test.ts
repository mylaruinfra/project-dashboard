import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";
import { getClient, listClients, setClientStatus, updateClient } from "@/server/services/clients.service";
import { getDashboard } from "@/server/services/dashboard.service";
import { createProject } from "@/server/services/projects.service";
import { costAnalysis, financialReport, laborReport, materialReport, projectComparison } from "@/server/services/reports.service";
import { listLaborRates, upsertLaborRate } from "@/server/services/settings.service";
import { createTransaction } from "@/server/services/transactions.service";
import { authenticate, createUser, listUsers, resetPassword, setUserStatus, updateUser } from "@/server/services/users.service";
import { getVendor, listVendors, setVendorStatus, updateVendor } from "@/server/services/vendors.service";
import { expectAppError, hasTestDb, makeWorld, useTestDb, villaInput } from "../support/db";

describe.skipIf(!hasTestDb)("users", () => {
  useTestDb();

  it("only admins manage users; deactivated users cannot sign in", async () => {
    const w = await makeWorld();
    await expectAppError(createUser(w.manager, { name: "X", email: "x@y.in", role: "VIEWER", password: "password1" }), "FORBIDDEN");
    const u = await createUser(w.admin, { name: "Site Eng", email: "Eng@Mylaru.in", role: "ENGINEER", password: "password1" });
    expect(await authenticate("eng@mylaru.in", "password1")).toMatchObject({ role: "ENGINEER" });
    expect(await authenticate("eng@mylaru.in", "wrong")).toBeNull();
    await expectAppError(createUser(w.admin, { name: "Dup", email: "eng@mylaru.in", role: "VIEWER", password: "password1" }), "CONFLICT");
    await expectAppError(setUserStatus(w.admin, u.id, { status: "INACTIVE", reason: "" }), "VALIDATION");
    await setUserStatus(w.admin, u.id, { status: "INACTIVE", reason: "Left the company" });
    expect(await authenticate("eng@mylaru.in", "password1")).toBeNull();
    await expectAppError(setUserStatus(w.admin, w.admin.id, { status: "INACTIVE", reason: "Testing" }), "BUSINESS_RULE");
    await expectAppError(updateUser(w.admin, w.admin.id, { name: "A", email: w.admin.email, role: "VIEWER" }), "BUSINESS_RULE");
    await resetPassword(w.admin, u.id, { password: "newpassword" });
    expect((await listUsers(w.admin, {})).total).toBe(6);
  });
});

describe.skipIf(!hasTestDb)("clients and vendors", () => {
  useTestDb();

  it("deactivate with a reason instead of deleting; inactive ones cannot be used", async () => {
    const w = await makeWorld();
    await expectAppError(updateClient(w.engineer, w.client.id, { name: "X" }), "FORBIDDEN");
    await updateClient(w.manager, w.client.id, { name: "ABC Constructions Pvt Ltd", phone: "9876543210" });
    await expectAppError(updateClient(w.manager, w.client.id, { name: "ABC", gstin: "BADGSTIN" }), "VALIDATION");
    await setClientStatus(w.manager, w.client.id, { status: "INACTIVE", reason: "Closed account" });
    expect((await listClients(w.manager, {})).total).toBe(0);
    expect((await listClients(w.manager, { status: "ALL" })).total).toBe(1);
    await expectAppError(createProject(w.manager, villaInput(w.client.id)), "BUSINESS_RULE", /inactive/);
    const log = await getDb().select().from(auditLogs).where(and(eq(auditLogs.entity, "client"), eq(auditLogs.action, "deactivate")));
    expect(log[0]!.reason).toBe("Closed account");
    expect((await getClient(w.manager, w.client.id)).projects).toHaveLength(1);

    await updateVendor(w.manager, w.vendor.id, { name: "Sri Sai Traders", type: "MATERIAL_VENDOR", phone: "040-2345678" });
    await setVendorStatus(w.manager, w.vendor.id, { status: "INACTIVE", reason: "Poor quality" });
    await expectAppError(createTransaction(w.manager, { projectId: w.project.id, type: "CONTRACTOR_PAYMENT", date: "2026-10-05", vendorId: w.vendor.id, amount: "100" }), "BUSINESS_RULE", /inactive/);
    expect((await listVendors(w.manager, { status: "ALL", type: "MATERIAL_VENDOR" })).total).toBe(1);
  });

  it("vendor ledger is hidden from engineers", async () => {
    const w = await makeWorld();
    await createTransaction(w.manager, { projectId: w.project.id, type: "MATERIAL", date: "2026-10-05", materialId: w.cement.id, qty: "10", rate: "700", vendorId: w.vendor.id });
    expect((await getVendor(w.manager, w.vendor.id)).ledger![0]!.pending).toBe(7_000_00);
    expect((await getVendor(w.engineer, w.vendor.id)).ledger).toBeNull();
    expect((await listVendors(w.engineer, {})).rows.every((r) => r.pending === null)).toBe(true);
  });
});

describe.skipIf(!hasTestDb)("settings, reports and dashboard", () => {
  useTestDb();

  it("labor rates: managers set them, engineers see types without rates", async () => {
    const w = await makeWorld();
    await expectAppError(upsertLaborRate(w.engineer, { laborType: "Painter", rate: "700" }), "FORBIDDEN");
    await upsertLaborRate(w.manager, { laborType: "Painter", rate: "700" });
    expect((await listLaborRates(w.engineer)).every((r) => r.rate === null)).toBe(true);
    expect((await listLaborRates(w.manager)).find((r) => r.laborType === "Painter")!.rate).toBe(700_00);
  });

  it("reports are money-only and never include void rows", async () => {
    const w = await makeWorld();
    const pid = w.project.id;
    await createTransaction(w.manager, { projectId: pid, type: "MATERIAL", date: "2026-10-05", materialId: w.cement.id, qty: "10", rate: "700", vendorId: w.vendor.id, phase: "CIVIL" });
    await createTransaction(w.manager, { projectId: pid, type: "LABOR", date: "2026-10-05", laborType: "Mason", workers: 2, days: "1", rate: "900", vendorId: w.contractor.id, phase: "EXCAVATION" });
    await createTransaction(w.manager, { projectId: pid, type: "CONTRACTOR_PAYMENT", date: "2026-10-05", vendorId: w.contractor.id, amount: "1000" });
    await createTransaction(w.manager, { projectId: pid, type: "CLIENT_PAYMENT", date: "2026-10-05", amount: "100000" });
    await expectAppError(costAnalysis(w.engineer, {}), "FORBIDDEN");
    const cost = await costAnalysis(w.viewer, { projectId: pid });
    expect(cost.total).toBe(7_000_00 + 1_800_00);
    expect(cost.byPhase.find((p) => p.phase === "CIVIL")).toMatchObject({ amount: 7_000_00, budget: 70_00_000_00 });
    const cmp = await projectComparison(w.viewer);
    expect(cmp[0]).toMatchObject({ area: 5300_00, estimatedPerSft: 2000_00 });
    expect((await materialReport(w.viewer, {}))[0]!.purchased).toBe(10_000);
    const labor = await laborReport(w.viewer, {});
    expect(labor.byParty[0]).toMatchObject({ name: "Ramesh Labor Party", attendance: 1_800_00, paid: 1_000_00, pending: 800_00 });
    const fin = await financialReport(w.viewer);
    expect(fin[0]).toMatchObject({ clientReceived: 1_00_000_00, clientBalance: 1_05_00_000_00 });
  });

  it("dashboard hides money from engineers", async () => {
    const w = await makeWorld();
    const d = await getDashboard(w.engineer);
    expect(d.totals).toBeNull();
    expect(d.sites).toHaveLength(1);
    const m = await getDashboard(w.manager);
    expect(m.totals!.budget).toBe(1_06_00_000_00);
  });
});
