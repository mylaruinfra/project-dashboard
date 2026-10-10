import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import type { Actor } from "@/server/auth/actor";
import { closeDb, getDb } from "@/server/db/client";
import { laborRates, users } from "@/server/db/schema";
import { createClient } from "@/server/services/clients.service";
import { createMaterial } from "@/server/services/materials.service";
import { addMember, createProject } from "@/server/services/projects.service";
import { createVendor } from "@/server/services/vendors.service";
import { setReaderForTests } from "@/server/ai";
import { toAppError } from "@/server/errors";

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

const TABLES = [
  "audit_logs",
  "ai_drafts",
  "documents",
  "material_usages",
  "material_receipts",
  "purchase_order_lines",
  "transactions",
  "purchase_orders",
  "project_stock",
  "progress_updates",
  "activities",
  "phase_budgets",
  "slabs",
  "floors",
  "project_members",
  "projects",
  "materials",
  "vendors",
  "clients",
  "labor_rates",
  "app_settings",
  "counters",
  "users",
];

export async function resetDb() {
  await getDb().execute(sql.raw(`truncate ${TABLES.map((t) => `"${t}"`).join(", ")} restart identity cascade`));
}

/** Registers per-file hooks: clean DB before each test, close the pool after the file. */
export function useTestDb() {
  beforeEach(async () => {
    setReaderForTests(undefined);
    await resetDb();
  });
  afterAll(async () => {
    await closeDb();
  });
}

let n = 0;
export async function makeUser(role: Actor["role"], name?: string): Promise<Actor> {
  n++;
  const [u] = await getDb()
    .insert(users)
    .values({ name: name ?? `${role} ${n}`, email: `${role.toLowerCase()}${n}@test.local`, passwordHash: "x", role })
    .returning();
  return { id: u!.id, name: u!.name, email: u!.email, role: u!.role };
}

export async function makeWorld() {
  const admin = await makeUser("ADMIN");
  const manager = await makeUser("MANAGER");
  const engineer = await makeUser("ENGINEER");
  const otherEngineer = await makeUser("ENGINEER");
  const viewer = await makeUser("VIEWER");
  const client = await createClient(admin, { name: "ABC Constructions" });
  const vendor = await createVendor(admin, { name: "Sri Sai Traders", type: "MATERIAL_VENDOR" });
  const contractor = await createVendor(admin, { name: "Ramesh Labor Party", type: "CIVIL_CONTRACTOR" });
  const cement = await createMaterial(admin, { name: "Cement OPC 53", unit: "bags" });
  const steel = await createMaterial(admin, { name: "TMT steel", unit: "MT" });
  await getDb().insert(laborRates).values([
    { laborType: "Mason", rate: "900.00" },
    { laborType: "Helper", rate: "600.00" },
  ]);
  const project = await createProject(manager, villaInput(client.id));
  await addMember(manager, project.id, { userId: engineer.id });
  return { admin, manager, engineer, otherEngineer, viewer, client, vendor, contractor, cement, steel, project };
}

/** The "Villa Project" from the reference image: 5,300 SFT × ₹2,000 = ₹1,06,00,000. */
export function villaInput(clientId: string) {
  return {
    basics: { name: "Villa Project", clientId, type: "RESIDENTIAL", startDate: "2026-10-05", expectedCompletion: "2027-03-31", description: "3 floor residential villa" },
    site: { latitude: "17.385044", longitude: "78.486671", address: "Hitech City, Hyderabad", plotShape: "RECTANGLE", plotSides: { length: "60", width: "40" }, facing: "EAST", nearestRoad: "30 ft road (east side)" },
    building: {
      floorsBelow: 0,
      floorsAbove: 2,
      hasTerrace: false,
      floors: [
        { level: 0, name: "Ground floor", slabs: [{ name: "Slab 1", length: "40", width: "30" }, { name: "Slab 2", length: "20", width: "15" }] },
        { level: 1, name: "First floor", slabs: [{ name: "Slab 1", length: "40", width: "25" }, { name: "Slab 2", length: "40", width: "20" }] },
        { level: 2, name: "Second floor", slabs: [{ name: "Slab 1", length: "50", width: "40" }] },
      ],
    },
    estimate: { costPerSft: "2000", phaseBudgets: { EXCAVATION: "500000", CIVIL: "7000000" } },
  };
}

export async function expectAppError(p: Promise<unknown>, code: string, msg?: RegExp) {
  try {
    await p;
  } catch (e) {
    // Same mapping the route wrapper applies (ZodError → VALIDATION, pg errors → CONFLICT/BUSINESS_RULE).
    const err = toAppError(e);
    if (err.code === "INTERNAL") throw e;
    if (err.code !== code) throw new Error(`Expected ${code}, got ${err.code ?? ""}: ${err.message}`);
    if (msg && !msg.test(err.message ?? "")) throw new Error(`Message "${err.message}" did not match ${msg}`);
    return err;
  }
  throw new Error(`Expected ${code} but the call succeeded`);
}
