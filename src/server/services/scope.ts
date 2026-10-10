import { eq, inArray, sql, type SQL, type AnyColumn } from "drizzle-orm";
import type { Actor } from "../auth/actor";
import { getDb } from "../db/client";
import { projectMembers } from "../db/schema";
import { isProjectScoped } from "../permissions";

/** null = all projects; otherwise the list of project ids the actor is assigned to. */
export async function visibleProjectIds(actor: Actor): Promise<string[] | null> {
  if (!isProjectScoped(actor)) return null;
  const rows = await getDb()
    .select({ id: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, actor.id));
  return rows.map((r) => r.id);
}

/** WHERE fragment limiting a project_id column to what the actor may see. */
export async function projectScopeFilter(actor: Actor, column: AnyColumn): Promise<SQL | undefined> {
  const ids = await visibleProjectIds(actor);
  if (ids === null) return undefined;
  if (ids.length === 0) return sql`false`;
  return inArray(column, ids);
}
