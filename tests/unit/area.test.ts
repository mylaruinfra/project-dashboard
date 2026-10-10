import { describe, expect, it } from "vitest";
import { formatArea, parseFeet, plotArea, rectArea } from "@/lib/area";

const ft = (n: number) => Math.round(n * 100);

describe("area", () => {
  it("computes slab areas from feet", () => {
    expect(rectArea(ft(40), ft(30))).toBe(1200_00);
    expect(rectArea(ft(20), ft(15))).toBe(300_00);
    expect(rectArea(ft(10.5), ft(10.25))).toBe(10763); // 107.625 → 107.63
  });

  it("computes plot area by shape", () => {
    expect(plotArea("RECTANGLE", { length: ft(60), width: ft(40) })).toBe(2400_00);
    expect(plotArea("TRAPEZOID", { front: ft(60), back: ft(50), depth: ft(40) })).toBe(2200_00);
    expect(plotArea("L_SHAPE", { length: ft(60), width: ft(40), cutLength: ft(20), cutWidth: ft(10) })).toBe(2200_00);
    expect(plotArea("T_SHAPE", { topLength: ft(60), topWidth: ft(20), stemLength: ft(30), stemWidth: ft(20) })).toBe(1800_00);
    expect(plotArea("IRREGULAR", {})).toBeNull();
  });

  it("rejects missing sides and impossible cut-outs", () => {
    expect(() => plotArea("RECTANGLE", { length: ft(60) })).toThrow(/width/);
    expect(() => plotArea("L_SHAPE", { length: ft(60), width: ft(40), cutLength: ft(60), cutWidth: ft(10) })).toThrow(/cut-out/);
  });

  it("parses and formats", () => {
    expect(parseFeet("40")).toBe(4000);
    expect(parseFeet("40.5")).toBe(4050);
    expect(parseFeet("40.555")).toBeNull();
    expect(formatArea(1500_00)).toBe("1,500 SFT");
    expect(formatArea(5300_00)).toBe("5,300 SFT");
    expect(formatArea(30050)).toBe("300.5 SFT");
  });
});
