/**
 * Who can do what. Services call `assertCan` before touching data and `assertProjectAccess`
 * for anything scoped to a project. Engineers only reach projects they are assigned to and
 * never receive money values (see `canSeeMoney`).
 */
import { and, eq } from "drizzle-orm";
import type { Actor } from "./auth/actor";
import type { DbOrTx } from "./db/client";
import { projectMembers, projects } from "./db/schema";
import { forbidden, notFound } from "./errors";

import { can, type Permission } from "@/lib/access";

export { type Permission, can, canSeeMoney, moneyFor } from "@/lib/access";

export function assertCan(actor: Pick<Actor, "role">, permission: Permission): void {
  if (!can(actor, permission)) throw forbidden();
}

/** Engineers see only assigned projects; everyone else sees all projects. */
export function isProjectScoped(actor: Pick<Actor, "role">): boolean {
  return actor.role === "ENGINEER";
}

/**
 * Loads the project (optionally FOR UPDATE) and checks the actor may reach it.
 * Archived projects are read-only for everyone.
 */
export async function assertProjectAccess(
  db: DbOrTx,
  actor: Actor,
  projectId: string,
  opts: { write?: boolean; lock?: boolean } = {},
) {
  const q = db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const [project] = opts.lock ? await q.for("update") : await q;
  if (!project) throw notFound("Project");
  if (isProjectScoped(actor)) {
    const [m] = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, actor.id)))
      .limit(1);
    if (!m) throw forbidden("You are not assigned to this project.");
  }
  if (opts.write && project.status === "ARCHIVED") throw forbidden("This project is archived. Restore it to make changes.");
  return project;
}
