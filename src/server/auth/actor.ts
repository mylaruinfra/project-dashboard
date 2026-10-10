import { eq } from "drizzle-orm";
import type { Role } from "@/lib/domain";
import { getDb } from "../db/client";
import { users } from "../db/schema";

/** The signed-in person a service call runs as. */
export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Loads a fresh actor from the DB so deactivation and role changes apply immediately. */
export async function loadActor(userId: string): Promise<Actor | null> {
  const [u] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.status !== "ACTIVE") return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}
