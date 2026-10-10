import { describe, expect, it } from "vitest";
import { costPerSft, estimatedCost, projectKpis, totalSlabArea } from "@/lib/estimate";

describe("estimate", () => {
  it("multiplies total slab area by cost per SFT", () => {
    const area = totalSlabArea([1200_00, 300_00, 1000_00, 800_00, 1500_00, 500_00]);
    expect(area).toBe(5300_00);
    expect(estimatedCost(area, 2000_00)).toBe(1_06_00_000_00); // ₹1,06,00,000 — matches the reference image
    expect(estimatedCost(150_50, 1999_99)).toBe(300998_50); // 150.5 × 1999.99 = 300998.4950 → .50
    expect(estimatedCost(0, 2000_00)).toBe(0);
  });

  it("computes KPIs: actual cost, remaining, client balance with contract fallback", () => {
    const k = projectKpis({ estimatedCost: 1_06_00_000_00, contractValue: null, expenseCost: 30_00_000_00, laborCost: 12_50_000_00, clientReceived: 55_00_000_00, pendingPayments: 3_00_000_00 });
    expect(k.actualCost).toBe(42_50_000_00);
    expect(k.remaining).toBe(63_50_000_00);
    expect(k.clientBalance).toBe(51_00_000_00);
    expect(k.contractValue).toBe(1_06_00_000_00);
    const withContract = projectKpis({ estimatedCost: 100_00, contractValue: 150_00, expenseCost: 0, laborCost: 0, clientReceived: 50_00, pendingPayments: 0 });
    expect(withContract.clientBalance).toBe(100_00);
  });

  it("cost per SFT handles zero area", () => {
    expect(costPerSft(1_06_00_000_00, 5300_00)).toBe(2000_00);
    expect(costPerSft(100, 0)).toBeNull();
  });
});
