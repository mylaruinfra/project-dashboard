import { describe, expect, it } from "vitest";
import { laborAmount, resolveTxn } from "@/lib/txn-rules";

const base = { date: "2026-10-05" };
const id = "00000000-0000-4000-8000-000000000001";

describe("transaction rules", () => {
  it("computes material amount from qty × rate and takes name/unit from the material", () => {
    const r = resolveTxn({ ...base, type: "MATERIAL", materialId: id, vendorId: id, qty: 50_000, rate: 700_00, amount: 1 }, { materialName: "Cement", materialUnit: "bags" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.amount).toBe(35_000_00);
      expect(r.value.item).toBe("Cement");
      expect(r.value.unit).toBe("bags");
      expect(r.value.paidNow).toBe(false);
    }
  });

  it("requires per-type fields", () => {
    const r = resolveTxn({ ...base, type: "MATERIAL" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["materialId", "qty", "rate", "vendorId"]);
    const p = resolveTxn({ ...base, type: "CONTRACTOR_PAYMENT", amount: 100 });
    expect(p.ok).toBe(false);
  });

  it("labor: workers × days × rate", () => {
    expect(laborAmount(4, 150, 800_00)).toBe(4_800_00);
    const r = resolveTxn({ ...base, type: "LABOR", laborType: "Mason", workers: 4, days: 100, rate: 900_00 });
    expect(r.ok && r.value.amount).toBe(3_600_00);
    expect(r.ok && r.value.qty).toBe(4_000); // 4 man-days
  });

  it("drops fields the type does not use", () => {
    const r = resolveTxn({ ...base, type: "CLIENT_PAYMENT", amount: 5_00_000_00, vendorId: id, qty: 5, slabId: id, paymentMode: "UPI" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.vendorId).toBeNull();
      expect(r.value.qty).toBeNull();
      expect(r.value.slabId).toBeNull();
      expect(r.value.paymentMode).toBe("UPI");
    }
  });

  it("treats costs without a vendor, and site expenses, as paid now", () => {
    const a = resolveTxn({ ...base, type: "SITE_EXPENSE", item: "Tea", amount: 450_00, paidNow: false });
    expect(a.ok && a.value.paidNow).toBe(true);
    const b = resolveTxn({ ...base, type: "MACHINERY", item: "JCB", qty: 8_000, unit: "hours", rate: 1500_00 });
    expect(b.ok && b.value.paidNow).toBe(true);
    const c = resolveTxn({ ...base, type: "MACHINERY", item: "JCB", qty: 8_000, unit: "hours", rate: 1500_00, vendorId: id });
    expect(c.ok && c.value.paidNow).toBe(false);
  });

  it("rejects zero amounts", () => {
    const r = resolveTxn({ ...base, type: "OTHER", item: "x", amount: 0 });
    expect(r.ok).toBe(false);
  });
});
