/** Domain constants and plain-word labels shared by UI and services. */

export const ROLES = ["ADMIN", "MANAGER", "ENGINEER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ENGINEER: "Engineer",
  VIEWER: "Viewer",
};

export const PHASES = ["EXCAVATION", "CIVIL", "INTERIOR"] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABEL: Record<Phase, string> = {
  EXCAVATION: "Excavation",
  CIVIL: "Civil",
  INTERIOR: "Interior",
};

export const PROJECT_TYPES = ["RESIDENTIAL", "COMMERCIAL", "OTHER"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  OTHER: "Other",
};

export const PROJECT_STATUSES = ["PLANNING", "ONGOING", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ONGOING: "Ongoing",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export const FACINGS = ["NORTH", "SOUTH", "EAST", "WEST", "NORTH_EAST", "NORTH_WEST", "SOUTH_EAST", "SOUTH_WEST"] as const;
export type Facing = (typeof FACINGS)[number];
export const FACING_LABEL: Record<Facing, string> = {
  NORTH: "North facing",
  SOUTH: "South facing",
  EAST: "East facing",
  WEST: "West facing",
  NORTH_EAST: "North-east facing",
  NORTH_WEST: "North-west facing",
  SOUTH_EAST: "South-east facing",
  SOUTH_WEST: "South-west facing",
};

export const PLOT_SHAPE_LABEL = {
  RECTANGLE: "Rectangle",
  TRAPEZOID: "Trapezoid",
  L_SHAPE: "L shape",
  T_SHAPE: "T shape",
  IRREGULAR: "Irregular (enter area)",
} as const;

export const VENDOR_TYPES = ["MATERIAL_VENDOR", "CIVIL_CONTRACTOR", "INTERIOR_CONTRACTOR", "MACHINERY", "LOGISTICS", "OTHER"] as const;
export type VendorType = (typeof VENDOR_TYPES)[number];
export const VENDOR_TYPE_LABEL: Record<VendorType, string> = {
  MATERIAL_VENDOR: "Material vendor",
  CIVIL_CONTRACTOR: "Civil contractor",
  INTERIOR_CONTRACTOR: "Interior contractor",
  MACHINERY: "Machinery",
  LOGISTICS: "Logistics",
  OTHER: "Other",
};

export const TXN_TYPES = [
  "LABOR",
  "MATERIAL",
  "MACHINERY",
  "LOGISTICS",
  "SITE_EXPENSE",
  "CLIENT_PAYMENT",
  "CONTRACTOR_PAYMENT",
  "OTHER",
] as const;
export type TxnType = (typeof TXN_TYPES)[number];

export const TXN_TYPE_LABEL: Record<TxnType, string> = {
  LABOR: "Labor",
  MATERIAL: "Material",
  MACHINERY: "Machinery",
  LOGISTICS: "Logistics",
  SITE_EXPENSE: "Site expense",
  CLIENT_PAYMENT: "Client payment",
  CONTRACTOR_PAYMENT: "Contractor payment",
  OTHER: "Other",
};

export const TXN_TYPE_HINT: Record<TxnType, string> = {
  LABOR: "Worker wages, attendance",
  MATERIAL: "Cement, steel, sand",
  MACHINERY: "JCB, mixer, crane hire",
  LOGISTICS: "Transport, loading",
  SITE_EXPENSE: "Food, tea, water, misc.",
  CLIENT_PAYMENT: "Money received from client",
  CONTRACTOR_PAYMENT: "Paid to vendor or contractor",
  OTHER: "Anything else",
};

/** Types that add to actual cost (LABOR counts through attendance cost). */
export const COST_TXN_TYPES = ["LABOR", "MATERIAL", "MACHINERY", "LOGISTICS", "SITE_EXPENSE", "OTHER"] as const satisfies readonly TxnType[];
export const EXPENSE_TXN_TYPES = ["MATERIAL", "MACHINERY", "LOGISTICS", "SITE_EXPENSE", "OTHER"] as const satisfies readonly TxnType[];
export const PAYMENT_TXN_TYPES = ["CLIENT_PAYMENT", "CONTRACTOR_PAYMENT"] as const satisfies readonly TxnType[];

export type TxnField =
  | "item"
  | "spec"
  | "material"
  | "qty"
  | "unit"
  | "rate"
  | "amount"
  | "vendor"
  | "phase"
  | "slab"
  | "laborType"
  | "workers"
  | "days"
  | "billNo"
  | "paidNow"
  | "paymentMode"
  | "purchaseOrder";

/** Step 2 of "Add transaction" shows only these fields (date, notes and attach bill are always shown). */
export const TXN_FIELDS: Record<TxnType, readonly TxnField[]> = {
  LABOR: ["laborType", "workers", "days", "rate", "amount", "vendor", "phase", "slab"],
  MATERIAL: ["material", "spec", "qty", "unit", "rate", "amount", "vendor", "phase", "slab", "billNo", "paidNow", "purchaseOrder"],
  MACHINERY: ["item", "spec", "qty", "unit", "rate", "amount", "vendor", "phase", "slab", "billNo", "paidNow"],
  LOGISTICS: ["item", "spec", "qty", "unit", "rate", "amount", "vendor", "phase", "slab", "billNo", "paidNow"],
  SITE_EXPENSE: ["item", "amount", "phase", "slab"],
  CLIENT_PAYMENT: ["amount", "paymentMode"],
  CONTRACTOR_PAYMENT: ["vendor", "amount", "paymentMode", "phase"],
  OTHER: ["item", "spec", "amount", "vendor", "phase", "slab", "billNo", "paidNow"],
};

/** Amount is computed from qty × rate (or workers × days × rate) for these types. */
export const TXN_AUTO_AMOUNT: Record<TxnType, boolean> = {
  LABOR: true,
  MATERIAL: true,
  MACHINERY: true,
  LOGISTICS: true,
  SITE_EXPENSE: false,
  CLIENT_PAYMENT: false,
  CONTRACTOR_PAYMENT: false,
  OTHER: false,
};

export const TXN_DEFAULT_UNIT: Partial<Record<TxnType, string>> = {
  MACHINERY: "hours",
  LOGISTICS: "trips",
};

export const UNITS = ["bags", "MT", "kg", "brass", "CFT", "cum", "SFT", "RFT", "nos", "litres", "loads", "trips", "hours", "days", "lot"] as const;

export const PAYMENT_MODES = ["Cash", "UPI", "Bank transfer", "Cheque"] as const;

export const DEFAULT_LABOR_TYPES = ["Mason", "Helper", "Carpenter", "Bar bender", "Electrician", "Plumber", "Painter", "Tiler"] as const;

export const DOC_KINDS = ["PHOTO", "BILL", "CHALLAN", "DRAWING", "AGREEMENT", "OTHER"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  PHOTO: "Photo",
  BILL: "Bill",
  CHALLAN: "Delivery challan",
  DRAWING: "Drawing",
  AGREEMENT: "Agreement",
  OTHER: "Other",
};

export const ACTIVITY_STATUS_LABEL = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
} as const;

export const DRAFT_STATUS_LABEL = { PENDING: "Waiting for review", CONFIRMED: "Confirmed", REJECTED: "Rejected" } as const;

/** Allowed file uploads */
export const UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
