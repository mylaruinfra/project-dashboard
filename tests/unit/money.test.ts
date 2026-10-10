import { describe, expect, it } from "vitest";
import { formatINR, formatINRCompact, mulQtyRate, paiseFromDb, paiseToDb, paiseToInput, parseRupees } from "@/lib/money";

describe("money", () => {
  it("parses rupees into integer paise without floats", () => {
    expect(parseRupees("1,06,00,000")).toBe(1_06_00_000_00);
    expect(parseRupees("350.5")).toBe(35050);
    expect(parseRupees("0.1")).toBe(10);
    expect(parseRupees(0.1)).toBe(10);
    expect(parseRupees("₹ 2,000")).toBe(200000);
    expect(parseRupees("12.345")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
    expect(parseRupees("")).toBeNull();
  });

  it("round-trips numeric(14,2) strings", () => {
    expect(paiseFromDb("1234.50")).toBe(123450);
    expect(paiseFromDb("0")).toBe(0);
    expect(paiseFromDb(null)).toBe(0);
    expect(paiseToDb(123450)).toBe("1234.50");
    expect(paiseToDb(5)).toBe("0.05");
    expect(paiseToDb(-250)).toBe("-2.50");
    expect(() => paiseToDb(1.5)).toThrow();
  });

  it("formats with Indian grouping", () => {
    expect(formatINR(1_06_00_000_00)).toBe("₹1,06,00,000");
    expect(formatINR(84_500_00)).toBe("₹84,500");
    expect(formatINR(35050)).toBe("₹350.50");
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(-45000)).toBe("−₹450");
    expect(formatINR(999_00)).toBe("₹999");
  });

  it("formats compact card values in L and Cr", () => {
    expect(formatINRCompact(84_500_00)).toBe("₹84,500");
    expect(formatINRCompact(14_80_000_00)).toBe("₹14.80 L");
    expect(formatINRCompact(1_06_00_000_00)).toBe("₹1.06 Cr");
    expect(formatINRCompact(1_42_00_000_00)).toBe("₹1.42 Cr");
    expect(formatINRCompact(42_50_000_00)).toBe("₹42.50 L");
    expect(formatINRCompact(99_99_999_00)).toBe("₹1.00 Cr"); // rounds up across the boundary
    expect(formatINRCompact(1_00_000_00)).toBe("₹1.00 L");
    expect(formatINRCompact(-63_50_000_00)).toBe("−₹63.50 L");
    expect(formatINRCompact(123_45_00_000_00)).toBe("₹123.45 Cr");
  });

  it("multiplies qty (milli) × rate (paise) exactly", () => {
    expect(mulQtyRate(50_000, 700_00)).toBe(35_000_00); // 50 bags × ₹700
    expect(mulQtyRate(12_500, 1_234_56)).toBe(15_432_00); // 12.5 × 1234.56 = 15432.00
    expect(mulQtyRate(1, 1)).toBe(0); // 0.001 × 0.01 rounds down
    expect(mulQtyRate(333, 150)).toBe(50); // 0.333 × 1.50 = 0.4995 → 0.50
  });

  it("gives plain input strings back", () => {
    expect(paiseToInput(200000)).toBe("2000");
    expect(paiseToInput(35050)).toBe("350.50");
    expect(paiseToInput(null)).toBe("");
  });
});
