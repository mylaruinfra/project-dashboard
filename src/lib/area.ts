/**
 * Area helpers. Lengths are integer hundredths of a foot (centi-ft); areas are integer
 * hundredths of a square foot (centi-SFT). numeric(14,2) SFT in the database.
 */
import { groupIndian, parseScaledDecimal, scaledToDecimal } from "./indian-number";

export type CentiFt = number;
export type CentiSft = number;

export const PLOT_SHAPES = ["RECTANGLE", "TRAPEZOID", "L_SHAPE", "T_SHAPE", "IRREGULAR"] as const;
export type PlotShape = (typeof PLOT_SHAPES)[number];

/** Side names each shape needs, in feet. */
export const PLOT_SIDES: Record<PlotShape, readonly { key: string; label: string }[]> = {
  RECTANGLE: [
    { key: "length", label: "Length (front)" },
    { key: "width", label: "Width (depth)" },
  ],
  TRAPEZOID: [
    { key: "front", label: "Front side" },
    { key: "back", label: "Back side" },
    { key: "depth", label: "Depth" },
  ],
  L_SHAPE: [
    { key: "length", label: "Overall length" },
    { key: "width", label: "Overall width" },
    { key: "cutLength", label: "Cut-out length" },
    { key: "cutWidth", label: "Cut-out width" },
  ],
  T_SHAPE: [
    { key: "topLength", label: "Top bar length" },
    { key: "topWidth", label: "Top bar width" },
    { key: "stemLength", label: "Stem length" },
    { key: "stemWidth", label: "Stem width" },
  ],
  IRREGULAR: [],
};

export function parseFeet(input: string | number): CentiFt | null {
  return parseScaledDecimal(input, 2);
}

export function areaFromDb(value: string | null | undefined): CentiSft {
  if (value === null || value === undefined) return 0;
  const a = parseScaledDecimal(value, 2);
  if (a === null) throw new Error(`Invalid area from database: ${value}`);
  return a;
}

export function areaToDb(centi: CentiSft): string {
  return scaledToDecimal(centi, 2);
}

export function feetToDb(centi: CentiFt): string {
  return scaledToDecimal(centi, 2);
}

/** centi-ft × centi-ft → centi-SFT (rounded). */
export function rectArea(lengthC: CentiFt, widthC: CentiFt): CentiSft {
  return Math.round((lengthC * widthC) / 100);
}

/**
 * Plot area from side lengths in centi-ft. IRREGULAR returns null (area is typed in by hand).
 * Throws when a needed side is missing, or the cut-out does not fit (L shape).
 */
export function plotArea(shape: PlotShape, sides: Record<string, CentiFt | undefined>): CentiSft | null {
  const need = (k: string): CentiFt => {
    const v = sides[k];
    if (v === undefined || !Number.isFinite(v) || v <= 0) throw new Error(`Side "${k}" must be more than 0`);
    return v;
  };
  switch (shape) {
    case "RECTANGLE":
      return rectArea(need("length"), need("width"));
    case "TRAPEZOID":
      return Math.round(((need("front") + need("back")) * need("depth")) / 200);
    case "L_SHAPE": {
      const L = need("length");
      const W = need("width");
      const cl = need("cutLength");
      const cw = need("cutWidth");
      if (cl >= L || cw >= W) throw new Error("The cut-out must be smaller than the overall plot");
      return rectArea(L, W) - rectArea(cl, cw);
    }
    case "T_SHAPE":
      return rectArea(need("topLength"), need("topWidth")) + rectArea(need("stemLength"), need("stemWidth"));
    case "IRREGULAR":
      return null;
  }
}

/** 150000 → "1,500 SFT"; 30050 → "300.5 SFT" */
export function formatArea(centi: CentiSft, unit = "SFT"): string {
  const whole = Math.floor(Math.abs(centi) / 100);
  const frac = String(Math.abs(centi) % 100).padStart(2, "0").replace(/0+$/, "");
  return `${centi < 0 ? "−" : ""}${groupIndian(String(whole))}${frac ? `.${frac}` : ""} ${unit}`.trim();
}

export function feetToInput(centi: CentiFt | null | undefined): string {
  if (centi === null || centi === undefined) return "";
  return scaledToDecimal(centi, 2).replace(/\.?0+$/, "");
}
