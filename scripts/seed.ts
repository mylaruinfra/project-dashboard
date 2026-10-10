/**
 * Demo data for local development. Goes through the real services so every rule applies.
 *
 *   npm run db:seed            # only when the database is empty
 *   npm run db:seed -- --reset # wipes the DEV database first (never the test DB)
 *
 * Covers: all 8 transaction types, voided records (transaction, delivery, usage, PO),
 * pending payments and an advance, partial deliveries, a purchase order, AI drafts in every
 * state, documents and site photos, and an engineer-only project.
 */
import "dotenv/config";
import { deflateSync } from "node:zlib";
import { sql } from "drizzle-orm";
import { setReaderForTests as setReader } from "../src/server/ai";
import type { RawExtraction } from "../src/server/ai/types";
import type { Actor } from "../src/server/auth/actor";
import { hashPassword } from "../src/server/auth/password";
import { closeDb, getDb } from "../src/server/db/client";
import { appSettings, laborRates, users } from "../src/server/db/schema";
import { createClient } from "../src/server/services/clients.service";
import { uploadDocument } from "../src/server/services/documents.service";
import { confirmDraft, createDraft, rejectDraft } from "../src/server/services/drafts.service";
import { createMaterial } from "../src/server/services/materials.service";
import { createActivity, recordProgress, setActivityArchived } from "../src/server/services/progress.service";
import { addMember, createProject, getProject, setProjectStatus } from "../src/server/services/projects.service";
import { createPurchaseOrder, createReceipt, createUsage, setPurchaseOrderStatus, voidReceipt, voidUsage } from "../src/server/services/stock.service";
import { createTransaction, voidTransaction } from "../src/server/services/transactions.service";
import { createVendor, setVendorStatus } from "../src/server/services/vendors.service";

const RESET = process.argv.includes("--reset");

/* ---------- tiny PNG generator for placeholder site photos ---------- */
function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Drafting-style placeholder: canvas ground, hairline grid, one hazard block. */
function placeholderPng(seed: number, w = 320, h = 200): Uint8Array {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const bx = 40 + ((seed * 53) % 180);
  const by = 30 + ((seed * 31) % 100);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      let [r, g, b] = [0xf4, 0xf3, 0xef];
      if (x % 20 === 0 || y % 20 === 0) [r, g, b] = [0xd5, 0xd2, 0xca];
      if (x >= bx && x < bx + 90 && y >= by && y < by + 60) [r, g, b] = [0xf0, 0x5a, 0x24];
      if (x === bx || y === by) [r, g, b] = [0x12, 0x15, 0x17];
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
const pdf = (title: string) => new TextEncoder().encode(`%PDF-1.4\n% SiteBook demo file: ${title}\n%%EOF\n`);

/* ---------- helpers ---------- */
async function user(name: string, email: string, role: Actor["role"], password: string): Promise<Actor> {
  const [u] = await getDb()
    .insert(users)
    .values({ name, email, role, passwordHash: await hashPassword(password) })
    .returning();
  return { id: u!.id, name: u!.name, email: u!.email, role: u!.role };
}

const sampleBill = (lines: RawExtraction["lines"], extra: Partial<RawExtraction> = {}): RawExtraction => ({
  documentType: "bill",
  vendorName: "Sri Sai Traders",
  vendorGstin: "36AAGFS1234K1Z6",
  documentNumber: "SST/2026/245",
  date: "28/09/2026",
  vehicleNo: null,
  lines,
  subtotal: null,
  taxTotal: null,
  total: null,
  ...extra,
});

async function main() {
  const db = getDb();
  const [{ n } = { n: 0 }] = (await db.execute(sql`select count(*)::int as n from users`)).rows as { n: number }[];
  if (n > 0 && !RESET) {
    console.log("The database already has data. Run `npm run db:seed -- --reset` to wipe it and reseed.");
    return;
  }
  if (RESET) {
    if (process.env.DATABASE_URL === process.env.TEST_DATABASE_URL) throw new Error("Refusing to reset: DATABASE_URL equals TEST_DATABASE_URL.");
    console.log("Wiping dev database…");
    await db.execute(sql`truncate audit_logs, ai_drafts, documents, material_usages, material_receipts, purchase_order_lines, transactions, purchase_orders, project_stock, progress_updates, activities, phase_budgets, slabs, floors, project_members, projects, materials, vendors, clients, labor_rates, app_settings, counters, users restart identity cascade`);
  }

  /* people */
  const admin = await user("R. K. Sharma", "admin@mylaru.in", "ADMIN", "Admin@123");
  const manager = await user("Priya Reddy", "manager@mylaru.in", "MANAGER", "Manager@123");
  const eng = await user("Suresh Kumar", "engineer@mylaru.in", "ENGINEER", "Engineer@123");
  const eng2 = await user("Kiran Rao", "kiran@mylaru.in", "ENGINEER", "Engineer@123");
  await user("Anil Mehta", "viewer@mylaru.in", "VIEWER", "Viewer@123");
  await db.insert(appSettings).values({ key: "company_name", value: "Mylaru Infra" });
  await db.insert(laborRates).values([
    { laborType: "Mason", rate: "900.00" },
    { laborType: "Helper", rate: "600.00" },
    { laborType: "Carpenter", rate: "950.00" },
    { laborType: "Bar bender", rate: "850.00" },
    { laborType: "Electrician", rate: "1000.00" },
    { laborType: "Plumber", rate: "1000.00" },
    { laborType: "Painter", rate: "800.00" },
    { laborType: "Tiler", rate: "900.00", status: "INACTIVE" },
  ]);

  /* clients, vendors, materials */
  const abc = await createClient(admin, { name: "ABC Constructions", contactPerson: "Ravi Varma", phone: "9876543210", email: "ravi@abc.example", address: "Madhapur, Hyderabad" });
  const metro = await createClient(admin, { name: "Metro Retail Ventures", contactPerson: "Sneha Iyer", phone: "9123456780", address: "Banjara Hills, Hyderabad" });
  const green = await createClient(admin, { name: "Greenwood Farms", contactPerson: "Mohan Das", phone: "9000012345" });

  const sai = await createVendor(admin, { name: "Sri Sai Traders", type: "MATERIAL_VENDOR", phone: "040-23456789", gstin: "36AAGFS1234K1Z6", address: "Kukatpally, Hyderabad" });
  const steelCo = await createVendor(admin, { name: "Bharat Steel Depot", type: "MATERIAL_VENDOR", phone: "9848012345" });
  const ramesh = await createVendor(admin, { name: "Ramesh Labor Party", type: "CIVIL_CONTRACTOR", contactPerson: "Ramesh", phone: "9701234567" });
  const interiors = await createVendor(admin, { name: "Urban Nest Interiors", type: "INTERIOR_CONTRACTOR", phone: "9988776655" });
  const jcb = await createVendor(admin, { name: "Venkat Earthmovers", type: "MACHINERY", phone: "9440011223" });
  const lorry = await createVendor(admin, { name: "Laxmi Transport", type: "LOGISTICS", phone: "9393939393" });
  const old = await createVendor(admin, { name: "Old Cement Agency", type: "MATERIAL_VENDOR" });
  await setVendorStatus(manager, old.id, { status: "INACTIVE", reason: "Stopped supplying after quality complaints" });
  await createVendor(admin, { name: "City Waterproofing", type: "OTHER" });

  const cement = await createMaterial(admin, { name: "Cement OPC 53", unit: "bags", category: "Binding" });
  const steel = await createMaterial(admin, { name: "TMT steel 12mm", unit: "MT", category: "Steel" });
  const sand = await createMaterial(admin, { name: "River sand", unit: "brass", category: "Aggregate" });
  const agg = await createMaterial(admin, { name: "Aggregate 20mm", unit: "CFT", category: "Aggregate" });
  const bricks = await createMaterial(admin, { name: "Red bricks", unit: "nos", category: "Masonry" });
  await createMaterial(admin, { name: "Tiles 2x2 vitrified", unit: "SFT", category: "Finishing" });

  /* ---------- Project 1: Villa (residential, everything) ---------- */
  const villa = await createProject(manager, {
    basics: { name: "Villa Project", clientId: abc.id, type: "RESIDENTIAL", startDate: "2026-06-01", expectedCompletion: "2027-03-31", description: "3 floor residential villa with parking and terrace." },
    site: { latitude: "17.385044", longitude: "78.486671", address: "Hitech City, Hyderabad, Telangana", plotShape: "RECTANGLE", plotSides: { length: "60", width: "40" }, facing: "EAST", nearestRoad: "30 ft road (east side)" },
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
    estimate: { costPerSft: "2000", phaseBudgets: { EXCAVATION: "600000", CIVIL: "7200000", INTERIOR: "2800000" } },
  });
  await addMember(manager, villa.id, { userId: eng.id });
  const villaP = await getProject(manager, villa.id);
  const gf1 = villaP.floors[0]!.slabs[0]!.id;
  const gf2 = villaP.floors[0]!.slabs[1]!.id;
  const ff1 = villaP.floors[1]!.slabs[0]!.id;

  const T = (a: Actor, body: Record<string, unknown>) => createTransaction(a, { projectId: villa.id, ...body });
  // Material purchases (partially delivered below)
  await T(manager, { type: "MATERIAL", date: "2026-07-05", materialId: cement.id, qty: "200", rate: "700", vendorId: sai.id, phase: "CIVIL", slabId: gf1, billNo: "SST-1021", notes: "For foundation and ground floor" });
  await T(manager, { type: "MATERIAL", date: "2026-07-08", materialId: steel.id, qty: "4.5", rate: "62000", vendorId: steelCo.id, phase: "CIVIL", billNo: "BSD-77" });
  await T(manager, { type: "MATERIAL", date: "2026-07-10", materialId: sand.id, qty: "6", rate: "4500", vendorId: sai.id, phase: "CIVIL", billNo: "SST-1033", paidNow: true });
  await T(manager, { type: "MATERIAL", date: "2026-08-02", materialId: agg.id, qty: "800", rate: "55", vendorId: sai.id, phase: "CIVIL", billNo: "SST-1050" });
  await T(manager, { type: "MATERIAL", date: "2026-08-20", materialId: bricks.id, qty: "12000", rate: "8.5", vendorId: sai.id, phase: "CIVIL", slabId: ff1, billNo: "SST-1090" });
  // Labor attendance (engineer records at the rate card; manager can set rates)
  for (const [date, lt, w] of [["2026-06-10", "Helper", 8], ["2026-06-11", "Helper", 8], ["2026-07-12", "Mason", 4], ["2026-07-12", "Helper", 6], ["2026-08-05", "Bar bender", 3], ["2026-09-15", "Mason", 5], ["2026-09-28", "Carpenter", 2]] as const) {
    await T(eng, { type: "LABOR", date, laborType: lt, workers: w, days: "1", vendorId: ramesh.id, phase: date < "2026-07-01" ? "EXCAVATION" : "CIVIL", slabId: gf1 });
  }
  await T(manager, { type: "LABOR", date: "2026-09-29", laborType: "Electrician", workers: 2, days: "2.5", rate: "1100", vendorId: interiors.id, phase: "INTERIOR", notes: "Conduit work, special rate" });
  // Machinery, logistics, site expenses, other
  await T(manager, { type: "MACHINERY", date: "2026-06-03", item: "JCB excavator", spec: "JCB 3DX", qty: "16", unit: "hours", rate: "1500", vendorId: jcb.id, phase: "EXCAVATION", billNo: "VE-12" });
  await T(manager, { type: "MACHINERY", date: "2026-07-20", item: "Concrete mixer hire", qty: "3", unit: "days", rate: "1200", phase: "CIVIL", slabId: gf1 });
  await T(manager, { type: "LOGISTICS", date: "2026-07-07", item: "Sand transport", qty: "3", unit: "trips", rate: "3500", vendorId: lorry.id, phase: "CIVIL", paidNow: true });
  await T(manager, { type: "LOGISTICS", date: "2026-08-21", item: "Brick unloading", qty: "1", unit: "lot", rate: "2400", vendorId: lorry.id, phase: "CIVIL" });
  await T(manager, { type: "SITE_EXPENSE", date: "2026-06-10", item: "Worker food", amount: "2400", phase: "EXCAVATION" });
  await T(manager, { type: "SITE_EXPENSE", date: "2026-07-12", item: "Tea and water", amount: "450", phase: "CIVIL" });
  await T(manager, { type: "OTHER", date: "2026-06-01", item: "Building permit fee", amount: "35000", notes: "GHMC permit" });
  // Client and contractor payments
  await T(manager, { type: "CLIENT_PAYMENT", date: "2026-06-01", amount: "2500000", paymentMode: "Bank transfer", notes: "Booking advance" });
  await T(manager, { type: "CLIENT_PAYMENT", date: "2026-08-15", amount: "3000000", paymentMode: "Cheque", notes: "Plinth stage" });
  await T(manager, { type: "CONTRACTOR_PAYMENT", date: "2026-07-31", vendorId: sai.id, amount: "100000", paymentMode: "UPI" });
  await T(manager, { type: "CONTRACTOR_PAYMENT", date: "2026-08-31", vendorId: ramesh.id, amount: "20000", paymentMode: "Cash" });
  await T(manager, { type: "CONTRACTOR_PAYMENT", date: "2026-09-10", vendorId: steelCo.id, amount: "279000", paymentMode: "Bank transfer", notes: "Full settlement" });
  // Voided records
  const dup = await T(manager, { type: "SITE_EXPENSE", date: "2026-07-12", item: "Tea and water", amount: "450", phase: "CIVIL" });
  await voidTransaction(manager, dup.id, { reason: "Entered twice by mistake" });
  const wrong = await T(manager, { type: "MATERIAL", date: "2026-07-05", materialId: cement.id, qty: "20", rate: "720", vendorId: sai.id, billNo: "SST-1021-X" });
  await voidTransaction(admin, wrong.id, { reason: "Wrong rate; vendor sent a corrected bill" });

  // Deliveries (cement: 200 purchased, 120 received = partial) and usage
  const PO = await createPurchaseOrder(manager, { projectId: villa.id, vendorId: sai.id, date: "2026-07-01", notes: "Cement for ground and first floor", lines: [{ materialId: cement.id, qty: "300", rate: "700" }, { materialId: sand.id, qty: "6", rate: "4500" }] });
  await createReceipt(eng, { projectId: villa.id, materialId: cement.id, vendorId: sai.id, purchaseOrderId: PO.id, date: "2026-07-06", qty: "80", challanNo: "DC-501", vehicleNo: "TS09AB1234" });
  await createReceipt(eng, { projectId: villa.id, materialId: cement.id, vendorId: sai.id, purchaseOrderId: PO.id, date: "2026-07-14", qty: "40", challanNo: "DC-522" });
  await createReceipt(eng, { projectId: villa.id, materialId: steel.id, vendorId: steelCo.id, date: "2026-07-09", qty: "4.5", challanNo: "BSD-C-12" });
  await createReceipt(eng, { projectId: villa.id, materialId: sand.id, vendorId: sai.id, purchaseOrderId: PO.id, date: "2026-07-07", qty: "6", challanNo: "DC-509" });
  await createReceipt(eng, { projectId: villa.id, materialId: bricks.id, vendorId: sai.id, date: "2026-08-21", qty: "7000", challanNo: "DC-610", notes: "Rest pending" });
  const badRec = await createReceipt(eng, { projectId: villa.id, materialId: agg.id, vendorId: sai.id, date: "2026-08-03", qty: "800", challanNo: "DC-560" });
  await voidReceipt(manager, badRec.id, { reason: "Lorry went to another site; redelivered" });
  await createReceipt(eng, { projectId: villa.id, materialId: agg.id, vendorId: sai.id, date: "2026-08-04", qty: "800", challanNo: "DC-560" });
  await createUsage(eng, { projectId: villa.id, materialId: cement.id, date: "2026-07-15", qty: "70", phase: "CIVIL", slabId: gf1, notes: "Footings" });
  await createUsage(eng, { projectId: villa.id, materialId: cement.id, date: "2026-08-10", qty: "30", phase: "CIVIL", slabId: gf2 });
  await createUsage(eng, { projectId: villa.id, materialId: steel.id, date: "2026-07-18", qty: "3.2", phase: "CIVIL", slabId: gf1 });
  await createUsage(eng, { projectId: villa.id, materialId: sand.id, date: "2026-07-16", qty: "4", phase: "CIVIL" });
  const oops = await createUsage(eng, { projectId: villa.id, materialId: bricks.id, date: "2026-08-25", qty: "5000", phase: "CIVIL", slabId: ff1 });
  await voidUsage(manager, oops.id, { reason: "Counted bricks for the next floor" });
  await createUsage(eng, { projectId: villa.id, materialId: bricks.id, date: "2026-08-26", qty: "4200", phase: "CIVIL", slabId: ff1 });

  // Work & progress
  const acts: [string, string, number, string?][] = [
    ["EXCAVATION", "Site clearing", 100],
    ["EXCAVATION", "Earthwork excavation", 100],
    ["CIVIL", "Footings and plinth", 100, gf1],
    ["CIVIL", "Ground floor columns", 80, gf1],
    ["CIVIL", "Ground floor slab casting", 40, gf1],
    ["CIVIL", "First floor brickwork", 15, ff1],
    ["INTERIOR", "Electrical conduits", 10],
    ["INTERIOR", "Plumbing lines", 0],
  ];
  for (const [phase, name, pct, slabId] of acts) {
    const a = await createActivity(eng, villa.id, { phase, name, slabId, plannedStart: "2026-06-01", plannedEnd: "2026-12-31" });
    if (pct > 0) await recordProgress(eng, a.id, { progress: pct, date: "2026-09-30", note: pct === 100 ? "Done" : undefined });
  }
  const scrap = await createActivity(manager, villa.id, { phase: "INTERIOR", name: "False ceiling (dropped)" });
  await setActivityArchived(manager, scrap.id, { archived: true, reason: "Client dropped false ceiling" });

  // Documents and site photos
  for (let i = 1; i <= 4; i++) {
    await uploadDocument(eng, { projectId: villa.id, kind: "PHOTO", title: `Site photo ${i}`, caption: ["Footing reinforcement", "Plinth beam", "Ground floor columns", "Slab shuttering"][i - 1] }, { name: `site-${i}.png`, type: "image/png", bytes: placeholderPng(i) });
  }
  await uploadDocument(manager, { projectId: villa.id, kind: "DRAWING", title: "Structural drawing GF" }, { name: "structural-gf.pdf", type: "application/pdf", bytes: pdf("Structural drawing GF") });
  await uploadDocument(manager, { projectId: villa.id, kind: "AGREEMENT", title: "Client agreement" }, { name: "agreement.pdf", type: "application/pdf", bytes: pdf("Agreement") });

  // AI drafts: one confirmed, one pending with checks, one pending without AI
  setReader({ name: "demo", read: async () => sampleBill([{ description: "Cement OPC 53 grade", quantity: "50", unit: "bags", rate: "700", amount: "35,000" }], { subtotal: "35,000", taxTotal: "6,300", total: "41,300" }) });
  const confirmed = await createDraft(manager, { projectId: villa.id, kind: "TRANSACTION" }, { name: "sst-bill-1201.pdf", type: "application/pdf", bytes: pdf("SST bill 1201") });
  await confirmDraft(manager, confirmed.id, {
    vendorId: sai.id,
    date: "2026-09-28",
    billNo: "SST-1201",
    phase: "CIVIL",
    lines: [
      { type: "MATERIAL", materialId: cement.id, qty: "50", rate: "700" },
      { type: "OTHER", item: "GST on bill SST-1201", amount: "6300" },
    ],
  });
  setReader({
    name: "demo",
    read: async () =>
      sampleBill(
        [
          { description: "Ready mix concrete M20", quantity: "16", unit: "loads", rate: "57,625", amount: "9,22,000" },
          { description: "Pump charges", quantity: "1", unit: "lot", rate: "8,000", amount: "8,000" },
        ],
        { vendorName: "Deccan RMC", vendorGstin: "36AAACD1234E1Z0", documentNumber: "RMC/889", date: "01/10/2026", subtotal: "9,30,000", taxTotal: "1,67,400", total: "10,98,000" },
      ),
  });
  await createDraft(manager, { projectId: villa.id, kind: "TRANSACTION" }, { name: "rmc-bill-889.pdf", type: "application/pdf", bytes: pdf("RMC bill 889") });
  setReader({ name: "demo", read: async () => ({ ...sampleBill([{ description: "Red bricks", quantity: "5000", unit: "nos", rate: null, amount: null }]), documentType: "challan", documentNumber: "DC-640", vehicleNo: "TS10 CD 5678" }) });
  await createDraft(eng, { projectId: villa.id, kind: "DELIVERY" }, { name: "challan-dc-640.png", type: "image/png", bytes: placeholderPng(9) });
  setReader(null);
  await createDraft(manager, { projectId: villa.id, kind: "TRANSACTION" }, { name: "handwritten-receipt.png", type: "image/png", bytes: placeholderPng(11) });
  setReader(undefined);

  /* ---------- Project 2: Metro Plaza (commercial, basement + terrace, advance, rejected draft) ---------- */
  const metroP = await createProject(manager, {
    basics: { name: "Metro Plaza Retail", clientId: metro.id, type: "COMMERCIAL", startDate: "2026-08-01", expectedCompletion: "2027-12-31", description: "Retail block with basement parking." },
    site: { latitude: "17.412300", longitude: "78.448900", address: "Road No. 12, Banjara Hills, Hyderabad", plotShape: "TRAPEZOID", plotSides: { front: "80", back: "70", depth: "100" }, facing: "NORTH", nearestRoad: "60 ft main road (north)" },
    building: {
      floorsBelow: 1,
      floorsAbove: 2,
      hasTerrace: true,
      floors: [
        { level: -1, name: "Basement 1", slabs: [{ name: "Slab 1", length: "70", width: "90" }] },
        { level: 0, name: "Ground floor", slabs: [{ name: "Slab 1", length: "70", width: "45" }, { name: "Slab 2", length: "70", width: "45" }] },
        { level: 1, name: "First floor", slabs: [{ name: "Slab 1", length: "70", width: "90" }] },
        { level: 2, name: "Second floor", slabs: [{ name: "Slab 1", length: "70", width: "90" }] },
        { level: 3, name: "Terrace", isTerrace: true, slabs: [{ name: "Headroom", length: "20", width: "15" }] },
      ],
    },
    estimate: { costPerSft: "2800", contractValue: "75000000", phaseBudgets: { EXCAVATION: "4500000" } },
  });
  await addMember(manager, metroP.id, { userId: eng.id });
  const M = (a: Actor, body: Record<string, unknown>) => createTransaction(a, { projectId: metroP.id, ...body });
  await M(manager, { type: "MACHINERY", date: "2026-08-05", item: "Excavator", qty: "120", unit: "hours", rate: "1800", vendorId: jcb.id, phase: "EXCAVATION", billNo: "VE-31" });
  await M(manager, { type: "LOGISTICS", date: "2026-08-06", item: "Soil disposal", qty: "60", unit: "trips", rate: "2200", vendorId: lorry.id, phase: "EXCAVATION" });
  await M(manager, { type: "CONTRACTOR_PAYMENT", date: "2026-08-04", vendorId: jcb.id, amount: "300000", paymentMode: "Bank transfer", notes: "Advance before mobilisation" });
  await M(manager, { type: "CLIENT_PAYMENT", date: "2026-08-01", amount: "10000000", paymentMode: "Bank transfer", notes: "Mobilisation advance" });
  await M(eng, { type: "LABOR", date: "2026-08-10", laborType: "Helper", workers: 20, days: "6", vendorId: ramesh.id, phase: "EXCAVATION" });
  await M(manager, { type: "SITE_EXPENSE", date: "2026-08-10", item: "Barricading and signage", amount: "18500", phase: "EXCAVATION" });
  await M(manager, { type: "MATERIAL", date: "2026-09-01", materialId: steel.id, qty: "12", rate: "61500", vendorId: steelCo.id, phase: "CIVIL", billNo: "BSD-102" });
  await createReceipt(eng, { projectId: metroP.id, materialId: steel.id, vendorId: steelCo.id, date: "2026-09-03", qty: "5", challanNo: "BSD-C-40" });
  const vr = await createReceipt(eng, { projectId: metroP.id, materialId: steel.id, vendorId: steelCo.id, date: "2026-09-04", qty: "2", challanNo: "BSD-C-41" });
  await voidReceipt(manager, vr.id, { reason: "Wrong diameter delivered; sent back" });
  const ex = await createActivity(eng, metroP.id, { phase: "EXCAVATION", name: "Basement excavation" });
  await recordProgress(eng, ex.id, { progress: 65, date: "2026-09-25" });
  await createActivity(eng, metroP.id, { phase: "EXCAVATION", name: "Retaining wall" });
  await createActivity(manager, metroP.id, { phase: "CIVIL", name: "Basement raft" });
  const poVoid = await createPurchaseOrder(manager, { projectId: metroP.id, vendorId: sai.id, date: "2026-08-20", lines: [{ materialId: cement.id, qty: "1000", rate: "690" }] });
  await setPurchaseOrderStatus(manager, poVoid.id, { status: "VOID", reason: "Switched to RMC for basement" });
  setReader({ name: "demo", read: async () => sampleBill([{ description: "Cement", quantity: "100", unit: "bags", rate: "700", amount: "70,000" }], { documentNumber: "SST-1021", date: "05/07/2026" }) });
  const rej = await createDraft(manager, { projectId: metroP.id, kind: "TRANSACTION" }, { name: "duplicate-bill.pdf", type: "application/pdf", bytes: pdf("duplicate") });
  await rejectDraft(manager, rej.id, { reason: "Duplicate of SST-1021 already entered on Villa Project" });
  setReader(undefined);

  /* ---------- Project 3: Greenwood Shed (engineer-only: assigned only to Kiran; no GPS yet) ---------- */
  const shed = await createProject(manager, {
    basics: { name: "Greenwood Shed", clientId: green.id, type: "OTHER", startDate: "2026-09-01", expectedCompletion: "2026-12-15", description: "Steel-roof storage shed for farm produce." },
    site: { address: "Survey No. 112, Shamshabad", plotShape: "IRREGULAR", plotArea: "5400", facing: "SOUTH_WEST", nearestRoad: "Village road (south)" },
    building: { floorsBelow: 0, floorsAbove: 0, hasTerrace: false, floors: [{ level: 0, name: "Ground floor", slabs: [{ name: "Shed floor", length: "60", width: "40" }] }] },
    estimate: { costPerSft: "1200" },
  });
  await addMember(manager, shed.id, { userId: eng2.id });
  const S = (a: Actor, body: Record<string, unknown>) => createTransaction(a, { projectId: shed.id, ...body });
  await S(eng2, { type: "LABOR", date: "2026-09-05", laborType: "Helper", workers: 6, days: "2" });
  await S(eng2, { type: "LABOR", date: "2026-09-12", laborType: "Mason", workers: 3, days: "3" });
  await createReceipt(eng2, { projectId: shed.id, materialId: cement.id, date: "2026-09-06", qty: "60" });
  await createUsage(eng2, { projectId: shed.id, materialId: cement.id, date: "2026-09-08", qty: "35", phase: "CIVIL" });
  const pcc = await createActivity(eng2, shed.id, { phase: "EXCAVATION", name: "Ground levelling" });
  await recordProgress(eng2, pcc.id, { progress: 100, date: "2026-09-10" });
  const fnd = await createActivity(eng2, shed.id, { phase: "CIVIL", name: "Column footings" });
  await recordProgress(eng2, fnd.id, { progress: 60, date: "2026-09-28" });
  await uploadDocument(eng2, { projectId: shed.id, kind: "PHOTO", title: "Levelled ground" }, { name: "shed-1.png", type: "image/png", bytes: placeholderPng(21) });

  /* a fourth, archived project for the archive filter */
  const arch = await createProject(manager, {
    basics: { name: "Old Duplex (cancelled)", clientId: abc.id, type: "RESIDENTIAL", startDate: "2026-01-10", expectedCompletion: "2026-12-31" },
    site: { plotShape: "RECTANGLE", plotSides: { length: "30", width: "40" } },
    building: { floorsBelow: 0, floorsAbove: 1, hasTerrace: false, floors: [{ level: 0, name: "Ground floor", slabs: [{ name: "Slab 1", length: "30", width: "40" }] }, { level: 1, name: "First floor", slabs: [] }] },
    estimate: { costPerSft: "1800" },
  });
  await setProjectStatus(admin, arch.id, { status: "ARCHIVED", reason: "Client cancelled before start" });

  console.log("Seed complete. Demo logins:");
  console.log("  admin@mylaru.in / Admin@123");
  console.log("  manager@mylaru.in / Manager@123");
  console.log("  engineer@mylaru.in / Engineer@123   (Villa + Metro)");
  console.log("  kiran@mylaru.in / Engineer@123      (Greenwood Shed only)");
  console.log("  viewer@mylaru.in / Viewer@123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
