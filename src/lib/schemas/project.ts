/** Project wizard schemas. Pure zod, shared by the wizard (client) and the projects service (server). */
import { z } from "zod";
import { PLOT_SHAPES, plotArea } from "../area";
import { FACINGS, PROJECT_TYPES } from "../domain";
import { zArea, zDate, zFeet, zId, zMoney, zRequiredText, zText } from "../validation";

const zCoord = (min: number, max: number, label: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined || String(v).trim() === "") return undefined;
      const s = String(v).trim();
      if (!/^-?\d{1,3}(\.\d{1,6})?$/.test(s) || Number(s) < min || Number(s) > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and ${max}, up to 6 decimals` });
        return z.NEVER;
      }
      return s;
    });

export const basicsInput = z
  .object({
    name: zRequiredText(150, "Project name"),
    clientId: zId,
    type: z.enum(PROJECT_TYPES),
    startDate: zDate,
    expectedCompletion: zDate,
    description: zText(2000),
  })
  .refine((v) => v.expectedCompletion >= v.startDate, {
    path: ["expectedCompletion"],
    message: "Expected completion must be on or after the start date",
  });

export const siteInput = z
  .object({
    latitude: zCoord(-90, 90, "Latitude"),
    longitude: zCoord(-180, 180, "Longitude"),
    address: zText(500),
    plotShape: z.enum(PLOT_SHAPES),
    plotSides: z.record(z.string(), zFeet).default({}),
    plotArea: zArea.optional(),
    facing: z.enum(FACINGS).optional(),
    nearestRoad: zText(200),
  })
  .superRefine((v, ctx) => {
    if ((v.latitude === undefined) !== (v.longitude === undefined)) {
      ctx.addIssue({ code: "custom", path: ["longitude"], message: "Enter both latitude and longitude, or neither" });
    }
    if (v.plotShape === "IRREGULAR") {
      if (!v.plotArea || v.plotArea <= 0) ctx.addIssue({ code: "custom", path: ["plotArea"], message: "Enter the plot area for an irregular plot" });
    } else {
      try {
        plotArea(v.plotShape, v.plotSides);
      } catch (e) {
        ctx.addIssue({ code: "custom", path: ["plotSides"], message: (e as Error).message });
      }
    }
  });

const slabInput = z.object({
  id: zId.optional(),
  name: zRequiredText(40, "Slab name"),
  length: zFeet,
  width: zFeet,
});

const floorInput = z.object({
  id: zId.optional(),
  level: z.number().int().min(-10).max(100),
  name: zRequiredText(40, "Floor name"),
  isTerrace: z.boolean().default(false),
  slabs: z.array(slabInput).max(30),
});

export const buildingInput = z
  .object({
    floorsBelow: z.coerce.number().int().min(0, "Cannot be negative").max(5),
    floorsAbove: z.coerce.number().int().min(0, "Cannot be negative").max(60),
    hasTerrace: z.boolean().default(false),
    floors: z.array(floorInput).min(1),
  })
  .superRefine((v, ctx) => {
    const normal = v.floors.filter((f) => !f.isTerrace);
    const terraces = v.floors.filter((f) => f.isTerrace);
    if (normal.length !== v.floorsBelow + 1 + v.floorsAbove) {
      ctx.addIssue({ code: "custom", path: ["floors"], message: "Floors do not match the counts below and above ground" });
    }
    if (terraces.length !== (v.hasTerrace ? 1 : 0)) {
      ctx.addIssue({ code: "custom", path: ["floors"], message: "Terrace does not match the terrace option" });
    }
    const levels = new Set(v.floors.map((f) => `${f.level}:${f.isTerrace}`));
    if (levels.size !== v.floors.length) ctx.addIssue({ code: "custom", path: ["floors"], message: "Each floor must be at a different level" });
    if (v.floors.every((f) => f.slabs.length === 0)) ctx.addIssue({ code: "custom", path: ["floors"], message: "Add at least one slab" });
    v.floors.forEach((f, i) => {
      const names = f.slabs.map((s) => s.name.toLowerCase());
      if (new Set(names).size !== names.length) {
        ctx.addIssue({ code: "custom", path: ["floors", i, "slabs"], message: `Slab names repeat on ${f.name}` });
      }
    });
  });

export const estimateInput = z.object({
  costPerSft: zMoney.refine((p) => p > 0, "Cost per SFT must be more than 0"),
  contractValue: z
    .union([zMoney, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v)),
  phaseBudgets: z
    .object({
      EXCAVATION: z.union([zMoney, z.literal("")]).optional(),
      CIVIL: z.union([zMoney, z.literal("")]).optional(),
      INTERIOR: z.union([zMoney, z.literal("")]).optional(),
    })
    .default({}),
});

export const createProjectInput = z.object({
  basics: basicsInput,
  site: siteInput,
  building: buildingInput,
  estimate: estimateInput,
});
