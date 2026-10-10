import { BarChart3, Building2, ClipboardList, FileText, HardHat, LayoutDashboard, type LucideIcon, Package, ReceiptIndianRupee, Settings, Truck, Upload, Users } from "lucide-react";
import { can, type Permission } from "@/lib/access";
import type { Role } from "@/lib/domain";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  need?: Permission;
}

/** Desktop sidebar, in the order from the brief. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Building2 },
  { href: "/transactions", label: "Transactions", icon: ReceiptIndianRupee },
  { href: "/materials", label: "Materials", icon: Package },
  { href: "/labor", label: "Labor", icon: HardHat },
  { href: "/vendors", label: "Vendors / Contractors", icon: Truck },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/progress", label: "Work & Progress", icon: ClipboardList },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart3, need: "finance.read" },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Phone bottom bar: Dashboard, Projects, Transactions, Upload, More. */
export const BOTTOM: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Building2 },
  { href: "/transactions", label: "Transactions", icon: ReceiptIndianRupee },
  { href: "/upload", label: "Upload", icon: Upload },
];

export function navFor(role: Role, items: NavItem[]) {
  return items.filter((i) => !i.need || can({ role }, i.need));
}
