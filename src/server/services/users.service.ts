import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { ROLES } from "@/lib/domain";
import { zId, zListQuery, zPhone, zReason, zRequiredText } from "@/lib/validation";
import type { Actor } from "../auth/actor";
import { hashPassword, verifyPassword } from "../auth/password";
import { audit } from "../audit";
import { getDb } from "../db/client";
import { projectMembers, projects, users } from "../db/schema";
import { AppError, notFound, rule } from "../errors";
import { paged, pageWindow } from "../pagination";
import { assertCan } from "../permissions";
import { inTx } from "../tx";

const zPassword = z.string().min(8, "Use at least 8 characters").max(100);
const zEmail = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));

export const createUserInput = z.object({
  name: zRequiredText(100, "Name"),
  email: zEmail,
  phone: zPhone,
  role: z.enum(ROLES),
  password: zPassword,
});

export const updateUserInput = z.object({
  name: zRequiredText(100, "Name"),
  email: zEmail,
  phone: zPhone,
  role: z.enum(ROLES),
});

const publicCols = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
};

export type UserRow = Awaited<ReturnType<typeof getUser>>;

/** Sign-in check. Returns null on any mismatch so callers cannot tell which part was wrong. */
export async function authenticate(email: string, password: string) {
  const [u] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!u || u.status !== "ACTIVE") return null;
  if (!(await verifyPassword(password, u.passwordHash))) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function listUsers(actor: Actor, query: unknown) {
  assertCan(actor, "user.manage");
  const q = zListQuery.parse(query);
  const { limit, offset, page } = pageWindow(q.page);
  const where: SQL | undefined = q.q ? or(ilike(users.name, `%${q.q}%`), ilike(users.email, `%${q.q}%`)) : undefined;
  const db = getDb();
  const rows = await db.select(publicCols).from(users).where(where).orderBy(asc(users.name)).limit(limit).offset(offset);
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(users).where(where);
  return paged(rows, total, page);
}

/** Small list for pickers (team assignment). */
export async function listUsersForPicker(actor: Actor, role?: (typeof ROLES)[number]) {
  assertCan(actor, "project.write");
  return getDb()
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.status, "ACTIVE"), role ? eq(users.role, role) : undefined))
    .orderBy(asc(users.name));
}

export async function getUser(actor: Actor, id: string) {
  assertCan(actor, "user.manage");
  const [u] = await getDb().select(publicCols).from(users).where(eq(users.id, zId.parse(id))).limit(1);
  if (!u) throw notFound("User");
  const assigned = await getDb()
    .select({ id: projects.id, name: projects.name, code: projects.code })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, u.id));
  return { ...u, projects: assigned };
}

export async function createUser(actor: Actor, input: unknown) {
  const data = createUserInput.parse(input);
  assertCan(actor, "user.manage");
  return inTx(async (tx) => {
    const passwordHash = await hashPassword(data.password);
    const [u] = await tx
      .insert(users)
      .values({ name: data.name, email: data.email, phone: data.phone, role: data.role, passwordHash })
      .returning({ id: users.id });
    await audit(tx, actor, { action: "create", entity: "user", entityId: u!.id, data: { email: data.email, role: data.role } });
    return { id: u!.id };
  });
}

export async function updateUser(actor: Actor, id: string, input: unknown) {
  const data = updateUserInput.parse(input);
  assertCan(actor, "user.manage");
  const userId = zId.parse(id);
  if (userId === actor.id && data.role !== actor.role) throw rule("You cannot change your own role.");
  return inTx(async (tx) => {
    const [u] = await tx.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id });
    if (!u) throw notFound("User");
    await audit(tx, actor, { action: "update", entity: "user", entityId: userId, data });
    return { id: userId };
  });
}

export async function setUserStatus(actor: Actor, id: string, input: unknown) {
  const data = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]), reason: zReason }).parse(input);
  assertCan(actor, "user.manage");
  const userId = zId.parse(id);
  if (userId === actor.id) throw rule("You cannot deactivate yourself.");
  return inTx(async (tx) => {
    const [u] = await tx.update(users).set({ status: data.status, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id });
    if (!u) throw notFound("User");
    await audit(tx, actor, { action: data.status === "ACTIVE" ? "activate" : "deactivate", entity: "user", entityId: userId, reason: data.reason });
    return { id: userId };
  });
}

export async function resetPassword(actor: Actor, id: string, input: unknown) {
  const data = z.object({ password: zPassword }).parse(input);
  assertCan(actor, "user.manage");
  const userId = zId.parse(id);
  return inTx(async (tx) => {
    const [u] = await tx
      .update(users)
      .set({ passwordHash: await hashPassword(data.password), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (!u) throw notFound("User");
    await audit(tx, actor, { action: "reset_password", entity: "user", entityId: userId });
    return { id: userId };
  });
}

export async function changeOwnPassword(actor: Actor, input: unknown) {
  const data = z.object({ current: z.string().min(1, "Enter your current password"), password: zPassword }).parse(input);
  return inTx(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, actor.id)).limit(1);
    if (!u || !(await verifyPassword(data.current, u.passwordHash))) {
      throw new AppError("VALIDATION", "Current password is wrong.", { current: "Current password is wrong." });
    }
    await tx.update(users).set({ passwordHash: await hashPassword(data.password), updatedAt: new Date() }).where(eq(users.id, actor.id));
    await audit(tx, actor, { action: "change_password", entity: "user", entityId: actor.id });
    return { id: actor.id };
  });
}
