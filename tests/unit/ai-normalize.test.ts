import { describe, expect, it } from "vitest";
import { normalizeExtraction, runChecks } from "@/server/ai/normalize";
import type { RawExtraction } from "@/server/ai/types";
import { gstinChecksumChar } from "@/lib/gstin";

const gst = (() => {
  const b = "36AAGFS1234K1Z";
  return b + gstinChecksumChar(b);
})();

const bill: RawExtraction = {
  documentType: "bill",
  vendorName: " Sri Sai Traders ",
  vendorGstin: gst.toLowerCase(),
  documentNumber: "SST/245",
  date: "05/10/2026",
  vehicleNo: null,
  lines: [
    { description: "OPC 53 Grade cement", quantity: "50", unit: "bags", rate: "700.00", amount: "35,000.00" },
    { description: "TMT 12mm", quantity: "1.25", unit: "MT", rate: "62,000", amount: "77,500" },
  ],
  subtotal: "1,12,500.00",
  taxTotal: "20,250.00",
  total: "1,32,750.00",
};

const today = "2026-10-06";

describe("AI normalize", () => {
  it("converts printed strings to paise, milli-units and ISO dates", () => {
    const n = normalizeExtraction(bill);
    expect(n.vendorName).toBe("Sri Sai Traders");
    expect(n.vendorGstin).toBe(gst);
    expect(n.date).toBe("2026-10-05");
    expect(n.lines[0]).toEqual({ description: "OPC 53 Grade cement", qty: 50_000, unit: "bags", rate: 700_00, amount: 35_000_00 });
    expect(n.lines[1]!.qty).toBe(1_250);
    expect(n.subtotal).toBe(1_12_500_00);
    expect(n.total).toBe(1_32_750_00);
  });

  it("passes every check on a consistent bill", () => {
    const checks = runChecks(normalizeExtraction(bill), { today, kind: "TRANSACTION" });
    expect(checks.filter((c) => c.status !== "pass")).toEqual([]);
    expect(checks.map((c) => c.id)).toEqual(["line-0", "line-1", "lines-total", "grand-total", "gstin", "date"]);
  });

  it("flags qty × rate mismatches, wrong totals, bad GSTIN and future dates", () => {
    const bad: RawExtraction = {
      ...bill,
      vendorGstin: gst.slice(0, 14) + (gst[14] === "0" ? "1" : "0"),
      date: "05/12/2026",
      lines: [{ description: "Cement", quantity: "16", unit: "loads", rate: "57,625", amount: "9,22,000" }],
      subtotal: "9,00,000",
      taxTotal: "0",
      total: "9,50,000",
    };
    const checks = runChecks(normalizeExtraction(bad), { today, kind: "TRANSACTION" });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.status]));
    expect(byId["line-0"]).toBe("pass"); // 16 × 57,625 = 9,22,000
    expect(byId["lines-total"]).toBe("fail");
    expect(byId["grand-total"]).toBe("fail");
    expect(byId.gstin).toBe("fail");
    expect(byId.date).toBe("fail");
  });

  it("tolerates ₹1 rounding and missing optional values", () => {
    const n = normalizeExtraction({ ...bill, lines: [{ description: "Sand", quantity: "3", unit: "brass", rate: "4,333.33", amount: "13,000" }], subtotal: "13,000", taxTotal: null, total: "13,000", vendorGstin: null, date: null });
    const checks = runChecks(n, { today, kind: "TRANSACTION" });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.status]));
    expect(byId["line-0"]).toBe("pass");
    expect(byId.gstin).toBe("warn");
    expect(byId.date).toBe("warn");
  });

  it("handles challans without prices", () => {
    const n = normalizeExtraction({ ...bill, documentType: "challan", lines: [{ description: "Cement", quantity: "100", unit: "bags", rate: null, amount: null }], subtotal: null, taxTotal: null, total: null });
    const checks = runChecks(n, { today, kind: "DELIVERY" });
    expect(checks.some((c) => c.status === "fail")).toBe(false);
    expect(n.lines[0]!.qty).toBe(100_000);
  });

  it("drops empty lines and rounds extra decimals", () => {
    const n = normalizeExtraction({ ...bill, lines: [{ description: "  ", quantity: "1", unit: null, rate: null, amount: null }, { description: "Steel", quantity: "1.2345", unit: "MT", rate: "100.005", amount: null }] });
    expect(n.lines).toHaveLength(1);
    expect(n.lines[0]!.qty).toBe(1_235);
    expect(n.lines[0]!.rate).toBe(100_01);
  });
});
