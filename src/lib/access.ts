/** Pure permission matrix, shared by server services and client UI (to hide buttons). */
import type { Role } from "./domain";


export type Permission =
  | "project.read"
  | "project.write" // create/edit projects, budgets, team
  | "finance.read" // see money anywhere
  | "finance.write" // transactions, payments, POs, AI bill drafts
  | "field.write" // attendance, deliveries, usage, progress, photos, uploads
  | "master.write" // clients, vendors, materials catalogue
  | "settings.manage" // labor rates, company settings
  | "user.manage" // users
  | "record.void" // void / archive financial, stock and evidence records
  | "draft.delete"; // hard-delete throwaway drafts

const MATRIX: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "project.read",
    "project.write",
    "finance.read",
    "finance.write",
    "field.write",
    "master.write",
    "settings.manage",
    "user.manage",
    "record.void",
    "draft.delete",
  ],
  MANAGER: ["project.read", "project.write", "finance.read", "finance.write", "field.write", "master.write", "settings.manage", "record.void"],
  ENGINEER: ["project.read", "field.write"],
  VIEWER: ["project.read", "finance.read"],
};

export function can(actor: { role: Role }, permission: Permission): boolean {
  return MATRIX[actor.role].includes(permission);
}

export function canSeeMoney(actor: { role: Role }): boolean {
  return can(actor, "finance.read");
}

/** Hides a money value from people who must not see it. */
export function moneyFor<T>(actor: { role: Role }, value: T): T | null {
  return canSeeMoney(actor) ? value : null;
}

