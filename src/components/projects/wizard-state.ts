/** Client-side state for the project wizard and the section edit modals. All inputs are strings. */
import { PLOT_SIDES, parseFeet, plotArea, rectArea, type PlotShape } from "@/lib/area";
import type { Facing, Phase, ProjectType } from "@/lib/domain";
import { estimatedCost, totalSlabArea } from "@/lib/estimate";
import { parseRupees, paiseToInput } from "@/lib/money";
import { basicsInput, buildingInput, estimateInput, siteInput } from "@/lib/schemas/project";

export interface BasicsState {
  name: string;
  clientId: string;
  type: ProjectType | "";
  startDate: string;
  expectedCompletion: string;
  description: string;
}

export interface SiteState {
  latitude: string;
  longitude: string;
  address: string;
  plotShape: PlotShape;
  plotSides: Record<string, string>;
  plotArea: string;
  facing: Facing | "";
  nearestRoad: string;
}

export interface SlabState {
  key: string;
  id?: string;
  name: string;
  length: string;
  width: string;
}

export interface FloorState {
  key: string;
  id?: string;
  level: number;
  name: string;
  isTerrace: boolean;
  slabs: SlabState[];
}

export interface BuildingState {
  floorsBelow: string;
  floorsAbove: string;
  hasTerrace: boolean;
  floors: FloorState[];
}

export interface EstimateState {
  costPerSft: string;
  contractValue: string;
  phaseBudgets: Record<Phase, string>;
}

export interface WizardState {
  basics: BasicsState;
  site: SiteState;
  building: BuildingState;
  estimate: EstimateState;
}

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

const ORDINAL = ["Ground", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];

export function floorName(level: number, isTerrace = false): string {
  if (isTerrace) return "Terrace";
  if (level < 0) return `Basement ${-level}`;
  return ORDINAL[level] ? `${ORDINAL[level]} floor` : `Floor ${level}`;
}

export function newSlab(index: number): SlabState {
  return { key: newKey(), name: `Slab ${index + 1}`, length: "", width: "" };
}

/** Rebuilds the floor list for new counts, keeping slabs of levels that still exist. */
export function syncFloors(b: BuildingState): FloorState[] {
  const below = Math.max(0, Math.min(5, Number.parseInt(b.floorsBelow, 10) || 0));
  const above = Math.max(0, Math.min(60, Number.parseInt(b.floorsAbove, 10) || 0));
  const levels: { level: number; isTerrace: boolean }[] = [];
  for (let l = -below; l <= above; l++) levels.push({ level: l, isTerrace: false });
  if (b.hasTerrace) levels.push({ level: above + 1, isTerrace: true });
  return levels.map(({ level, isTerrace }) => {
    const existing = b.floors.find((f) => f.isTerrace === isTerrace && (isTerrace || f.level === level));
    if (existing) return { ...existing, level, name: existing.name || floorName(level, isTerrace) };
    return { key: newKey(), level, name: floorName(level, isTerrace), isTerrace, slabs: isTerrace ? [] : [newSlab(0)] };
  });
}

export function emptyWizard(today: string): WizardState {
  return {
    basics: { name: "", clientId: "", type: "RESIDENTIAL", startDate: today, expectedCompletion: "", description: "" },
    site: { latitude: "", longitude: "", address: "", plotShape: "RECTANGLE", plotSides: {}, plotArea: "", facing: "", nearestRoad: "" },
    building: { floorsBelow: "0", floorsAbove: "0", hasTerrace: false, floors: [{ key: newKey(), level: 0, name: "Ground floor", isTerrace: false, slabs: [newSlab(0)] }] },
    estimate: { costPerSft: "", contractValue: "", phaseBudgets: { EXCAVATION: "", CIVIL: "", INTERIOR: "" } },
  };
}

/* ---------- derived numbers (integers: centi-SFT, paise) ---------- */

export function slabArea(s: Pick<SlabState, "length" | "width">): number | null {
  const l = parseFeet(s.length);
  const w = parseFeet(s.width);
  return l && w && l > 0 && w > 0 ? rectArea(l, w) : null;
}

export function floorArea(f: FloorState): number {
  return totalSlabArea(f.slabs.map((s) => slabArea(s) ?? 0));
}

export function buildingArea(b: BuildingState): number {
  return totalSlabArea(b.floors.map(floorArea));
}

export function sitePlotArea(s: SiteState): number | null {
  if (s.plotShape === "IRREGULAR") return parseFeet(s.plotArea);
  const sides: Record<string, number | undefined> = {};
  for (const { key } of PLOT_SIDES[s.plotShape]) sides[key] = parseFeet(s.plotSides[key] ?? "") ?? undefined;
  try {
    return plotArea(s.plotShape, sides);
  } catch {
    return null;
  }
}

export function estimateFor(b: BuildingState, e: EstimateState): number | null {
  const rate = parseRupees(e.costPerSft);
  return rate === null ? null : estimatedCost(buildingArea(b), rate);
}

/* ---------- payloads for the API ---------- */

export function siteBody(s: SiteState) {
  return {
    latitude: s.latitude,
    longitude: s.longitude,
    address: s.address,
    plotShape: s.plotShape,
    plotSides: s.plotShape === "IRREGULAR" ? {} : Object.fromEntries(PLOT_SIDES[s.plotShape].map(({ key }) => [key, s.plotSides[key] ?? ""])),
    plotArea: s.plotShape === "IRREGULAR" ? s.plotArea : undefined,
    facing: s.facing || undefined,
    nearestRoad: s.nearestRoad,
  };
}

export function buildingBody(b: BuildingState) {
  return {
    floorsBelow: b.floorsBelow,
    floorsAbove: b.floorsAbove,
    hasTerrace: b.hasTerrace,
    floors: b.floors.map((f) => ({
      id: f.id,
      level: f.level,
      name: f.name,
      isTerrace: f.isTerrace,
      slabs: f.slabs.map((s) => ({ id: s.id, name: s.name, length: s.length, width: s.width })),
    })),
  };
}

export function estimateBody(e: EstimateState) {
  return { costPerSft: e.costPerSft, contractValue: e.contractValue, phaseBudgets: e.phaseBudgets };
}

export function wizardBody(w: WizardState) {
  return { basics: { ...w.basics, type: w.basics.type || undefined }, site: siteBody(w.site), building: buildingBody(w.building), estimate: estimateBody(w.estimate) };
}

/* ---------- step validation with the same zod schemas the server uses ---------- */

export type Errors = Record<string, string>;

function issues(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, prefix = ""): Errors {
  if (result.success || !result.error) return {};
  const out: Errors = {};
  for (const i of result.error.issues) {
    const key = prefix + (i.path.map(String).join(".") || "_");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

export function validateStep(step: number, w: WizardState): Errors {
  switch (step) {
    case 0:
      return issues(basicsInput.safeParse({ ...w.basics, type: w.basics.type || undefined }));
    case 1:
      return issues(siteInput.safeParse(siteBody(w.site)));
    case 2:
      return issues(buildingInput.safeParse(buildingBody(w.building)));
    case 3:
      return issues(estimateInput.safeParse(estimateBody(w.estimate)));
    default:
      return {};
  }
}

/* ---------- from a saved project (for edit modals) ---------- */

const ft = (centi: number) => (centi / 100).toString();

export interface ProjectLike {
  name: string;
  client: { id: string };
  type: ProjectType;
  startDate: string;
  expectedCompletion: string;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  plotShape: PlotShape;
  plotSides: Record<string, number>;
  plotArea: number;
  facing: Facing | null;
  nearestRoad: string | null;
  floorsBelow: number;
  floorsAbove: number;
  hasTerrace: boolean;
  floors: { id: string; level: number; name: string; isTerrace: boolean; slabs: { id: string; name: string; length: number; width: number }[] }[];
  costPerSft: number | null;
  contractValue: number | null;
  phaseBudgets: Partial<Record<Phase, number>> | null;
}

export function stateFromProject(p: ProjectLike): WizardState {
  return {
    basics: { name: p.name, clientId: p.client.id, type: p.type, startDate: p.startDate, expectedCompletion: p.expectedCompletion, description: p.description ?? "" },
    site: {
      latitude: p.latitude ?? "",
      longitude: p.longitude ?? "",
      address: p.address ?? "",
      plotShape: p.plotShape,
      plotSides: Object.fromEntries(Object.entries(p.plotSides).map(([k, v]) => [k, String(v)])),
      plotArea: p.plotShape === "IRREGULAR" ? ft(p.plotArea) : "",
      facing: p.facing ?? "",
      nearestRoad: p.nearestRoad ?? "",
    },
    building: {
      floorsBelow: String(p.floorsBelow),
      floorsAbove: String(p.floorsAbove),
      hasTerrace: p.hasTerrace,
      floors: p.floors.map((f) => ({ key: f.id, id: f.id, level: f.level, name: f.name, isTerrace: f.isTerrace, slabs: f.slabs.map((s) => ({ key: s.id, id: s.id, name: s.name, length: ft(s.length), width: ft(s.width) })) })),
    },
    estimate: {
      costPerSft: paiseToInput(p.costPerSft),
      contractValue: paiseToInput(p.contractValue),
      phaseBudgets: { EXCAVATION: paiseToInput(p.phaseBudgets?.EXCAVATION), CIVIL: paiseToInput(p.phaseBudgets?.CIVIL), INTERIOR: paiseToInput(p.phaseBudgets?.INTERIOR) },
    },
  };
}
