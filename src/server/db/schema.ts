/**
 * SiteBook database schema.
 *
 * Conventions
 * - Money is numeric(14,2) in rupees. Code converts to integer paise (see src/lib/money.ts).
 * - Quantities are numeric(14,3). Code converts to integer milli-units (see src/lib/qty.ts).
 * - Areas are numeric(14,2) in square feet. Code converts to integer centi-SFT (see src/lib/area.ts).
 * - Financial, stock and evidence rows are never deleted. They carry a status (VOID / ARCHIVED /
 *   INACTIVE) plus who changed it and why. Unique business numbers ignore VOID rows.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------- enums ---------- */

export const roleEnum = pgEnum("role", ["ADMIN", "MANAGER", "ENGINEER", "VIEWER"]);
export const projectTypeEnum = pgEnum("project_type", ["RESIDENTIAL", "COMMERCIAL", "OTHER"]);
export const projectStatusEnum = pgEnum("project_status", ["PLANNING", "ONGOING", "ON_HOLD", "COMPLETED", "ARCHIVED"]);
export const plotShapeEnum = pgEnum("plot_shape", ["RECTANGLE", "TRAPEZOID", "L_SHAPE", "T_SHAPE", "IRREGULAR"]);
export const facingEnum = pgEnum("facing", ["NORTH", "SOUTH", "EAST", "WEST", "NORTH_EAST", "NORTH_WEST", "SOUTH_EAST", "SOUTH_WEST"]);
export const phaseEnum = pgEnum("phase", ["EXCAVATION", "CIVIL", "INTERIOR"]);
export const txnTypeEnum = pgEnum("txn_type", [
  "LABOR",
  "MATERIAL",
  "MACHINERY",
  "LOGISTICS",
  "SITE_EXPENSE",
  "CLIENT_PAYMENT",
  "CONTRACTOR_PAYMENT",
  "OTHER",
]);
export const recordStatusEnum = pgEnum("record_status", ["ACTIVE", "VOID"]);
export const activeStatusEnum = pgEnum("active_status", ["ACTIVE", "INACTIVE"]);
export const vendorTypeEnum = pgEnum("vendor_type", [
  "MATERIAL_VENDOR",
  "CIVIL_CONTRACTOR",
  "INTERIOR_CONTRACTOR",
  "MACHINERY",
  "LOGISTICS",
  "OTHER",
]);
export const poStatusEnum = pgEnum("po_status", ["OPEN", "CLOSED", "VOID"]);
export const activityStatusEnum = pgEnum("activity_status", ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"]);
export const docKindEnum = pgEnum("doc_kind", ["PHOTO", "BILL", "CHALLAN", "DRAWING", "AGREEMENT", "OTHER"]);
export const docStatusEnum = pgEnum("doc_status", ["ACTIVE", "ARCHIVED"]);
export const draftKindEnum = pgEnum("draft_kind", ["TRANSACTION", "DELIVERY"]);
export const draftStatusEnum = pgEnum("draft_status", ["PENDING", "CONFIRMED", "REJECTED"]);

/* ---------- helpers ---------- */

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const qty = (name: string) => numeric(name, { precision: 14, scale: 3 });
const area = (name: string) => numeric(name, { precision: 14, scale: 2 });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ---------- people ---------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    status: activeStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(sql`lower(${t.email})`)],
);

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  gstin: text("gstin"),
  address: text("address"),
  status: activeStatusEnum("status").notNull().default("ACTIVE"),
  statusReason: text("status_reason"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: vendorTypeEnum("type").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  gstin: text("gstin"),
  address: text("address"),
  status: activeStatusEnum("status").notNull().default("ACTIVE"),
  statusReason: text("status_reason"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ---------- projects ---------- */

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    type: projectTypeEnum("type").notNull(),
    status: projectStatusEnum("status").notNull().default("ONGOING"),
    statusReason: text("status_reason"),
    startDate: date("start_date").notNull(),
    expectedCompletion: date("expected_completion").notNull(),
    description: text("description"),
    // site
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    address: text("address"),
    plotShape: plotShapeEnum("plot_shape").notNull().default("RECTANGLE"),
    plotSides: jsonb("plot_sides").$type<Record<string, number>>().notNull().default({}),
    plotArea: area("plot_area").notNull().default("0"),
    facing: facingEnum("facing"),
    nearestRoad: text("nearest_road"),
    // building
    floorsBelow: integer("floors_below").notNull().default(0),
    floorsAbove: integer("floors_above").notNull().default(0),
    hasTerrace: boolean("has_terrace").notNull().default(false),
    // estimate
    costPerSft: money("cost_per_sft").notNull().default("0"),
    estimatedCost: money("estimated_cost").notNull().default("0"),
    contractValue: money("contract_value"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("projects_code_uq").on(t.code)],
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

export const floors = pgTable(
  "floors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    /** Negative below ground, 0 = ground, positive above. Terrace uses floorsAbove + 1. */
    level: integer("level").notNull(),
    name: text("name").notNull(),
    isTerrace: boolean("is_terrace").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("floors_project_idx").on(t.projectId)],
);

export const slabs = pgTable(
  "slabs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    floorId: uuid("floor_id")
      .notNull()
      .references(() => floors.id),
    name: text("name").notNull(),
    lengthFt: numeric("length_ft", { precision: 10, scale: 2 }).notNull(),
    widthFt: numeric("width_ft", { precision: 10, scale: 2 }).notNull(),
    area: area("area").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("slabs_project_idx").on(t.projectId)],
);

export const phaseBudgets = pgTable(
  "phase_budgets",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    phase: phaseEnum("phase").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.phase] })],
);

/* ---------- work & progress ---------- */

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    phase: phaseEnum("phase").notNull(),
    name: text("name").notNull(),
    slabId: uuid("slab_id").references(() => slabs.id),
    plannedStart: date("planned_start"),
    plannedEnd: date("planned_end"),
    progress: integer("progress").notNull().default(0),
    status: activityStatusEnum("status").notNull().default("NOT_STARTED"),
    statusReason: text("status_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("activities_project_idx").on(t.projectId), check("activities_progress_ck", sql`${t.progress} between 0 and 100`)],
);

export const progressUpdates = pgTable("progress_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id")
    .notNull()
    .references(() => activities.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  date: date("date").notNull(),
  progress: integer("progress").notNull(),
  note: text("note"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

/* ---------- materials ---------- */

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    category: text("category"),
    status: activeStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("materials_name_unit_uq").on(sql`lower(${t.name})`, t.unit)],
);

/** One row per project + material. Locked FOR UPDATE whenever received or used quantity changes. */
export const projectStock = pgTable(
  "project_stock",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    received: qty("received").notNull().default("0"),
    used: qty("used").notNull().default("0"),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.materialId] }),
    check("project_stock_non_negative_ck", sql`${t.received} >= ${t.used} and ${t.used} >= 0`),
  ],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    date: date("date").notNull(),
    notes: text("notes"),
    status: poStatusEnum("status").notNull().default("OPEN"),
    statusReason: text("status_reason"),
    statusBy: uuid("status_by").references(() => users.id),
    statusAt: timestamp("status_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("purchase_orders_number_uq").on(t.number).where(sql`${t.status} <> 'VOID'`)],
);

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  materialId: uuid("material_id")
    .notNull()
    .references(() => materials.id),
  qty: qty("qty").notNull(),
  rate: money("rate").notNull(),
  amount: money("amount").notNull(),
});

/* ---------- transactions ---------- */

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    type: txnTypeEnum("type").notNull(),
    date: date("date").notNull(),
    item: text("item").notNull(),
    spec: text("spec"),
    qty: qty("qty"),
    unit: text("unit"),
    rate: money("rate"),
    amount: money("amount").notNull(),
    /** Cost was settled on the spot (cash). Unpaid vendor costs make up pending payments. */
    paidNow: boolean("paid_now").notNull().default(false),
    vendorId: uuid("vendor_id").references(() => vendors.id),
    clientId: uuid("client_id").references(() => clients.id),
    materialId: uuid("material_id").references(() => materials.id),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id),
    phase: phaseEnum("phase"),
    slabId: uuid("slab_id").references(() => slabs.id),
    location: text("location"),
    // labor attendance (type = LABOR)
    laborType: text("labor_type"),
    workers: integer("workers"),
    days: numeric("days", { precision: 6, scale: 2 }),
    // vendor bill reference
    billNo: text("bill_no"),
    billLine: integer("bill_line").notNull().default(1),
    paymentMode: text("payment_mode"),
    notes: text("notes"),
    source: text("source").notNull().default("MANUAL"),
    aiDraftId: uuid("ai_draft_id"),
    status: recordStatusEnum("status").notNull().default("ACTIVE"),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("transactions_number_uq").on(t.number).where(sql`${t.status} <> 'VOID'`),
    uniqueIndex("transactions_vendor_bill_uq")
      .on(t.vendorId, t.billNo, t.billLine)
      .where(sql`${t.status} <> 'VOID' and ${t.billNo} is not null and ${t.vendorId} is not null`),
    index("transactions_project_date_idx").on(t.projectId, t.date),
    check("transactions_amount_ck", sql`${t.amount} >= 0`),
  ],
);

/* ---------- deliveries and usage ---------- */

export const materialReceipts = pgTable(
  "material_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    vendorId: uuid("vendor_id").references(() => vendors.id),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id),
    date: date("date").notNull(),
    qty: qty("qty").notNull(),
    challanNo: text("challan_no"),
    challanLine: integer("challan_line").notNull().default(1),
    vehicleNo: text("vehicle_no"),
    notes: text("notes"),
    source: text("source").notNull().default("MANUAL"),
    aiDraftId: uuid("ai_draft_id"),
    status: recordStatusEnum("status").notNull().default("ACTIVE"),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("material_receipts_challan_uq")
      .on(t.vendorId, t.challanNo, t.challanLine)
      .where(sql`${t.status} <> 'VOID' and ${t.challanNo} is not null and ${t.vendorId} is not null`),
    index("material_receipts_project_idx").on(t.projectId),
    check("material_receipts_qty_ck", sql`${t.qty} > 0`),
  ],
);

export const materialUsages = pgTable(
  "material_usages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    date: date("date").notNull(),
    qty: qty("qty").notNull(),
    phase: phaseEnum("phase"),
    slabId: uuid("slab_id").references(() => slabs.id),
    activityId: uuid("activity_id").references(() => activities.id),
    notes: text("notes"),
    status: recordStatusEnum("status").notNull().default("ACTIVE"),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("material_usages_project_idx").on(t.projectId), check("material_usages_qty_ck", sql`${t.qty} > 0`)],
);

/* ---------- documents and AI drafts ---------- */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id),
    /** Record this document is attached to, e.g. "transaction", "receipt", "vendor". */
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    kind: docKindEnum("kind").notNull(),
    title: text("title").notNull(),
    caption: text("caption"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    status: docStatusEnum("status").notNull().default("ACTIVE"),
    statusReason: text("status_reason"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("documents_entity_idx").on(t.entityType, t.entityId), index("documents_project_idx").on(t.projectId)],
);

export const aiDrafts = pgTable("ai_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  kind: draftKindEnum("kind").notNull(),
  status: draftStatusEnum("status").notNull().default("PENDING"),
  provider: text("provider").notNull(),
  /** Normalized extraction (paise / milli-units), see src/server/ai/normalize.ts */
  extracted: jsonb("extracted").$type<unknown>(),
  checks: jsonb("checks").$type<unknown>().notNull().default([]),
  readError: text("read_error"),
  decisionReason: text("decision_reason"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

/* ---------- settings, counters, audit ---------- */

export const laborRates = pgTable("labor_rates", {
  laborType: text("labor_type").primaryKey(),
  rate: money("rate").notNull(),
  status: activeStatusEnum("status").notNull().default("ACTIVE"),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Gap-free-ish document numbers. Incremented under a row lock inside the creating transaction. */
export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    projectId: uuid("project_id"),
    reason: text("reason"),
    data: jsonb("data").$type<unknown>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_project_idx").on(t.projectId)],
);
