/**
 * Create (or reset) a user from the command line — handy for the first admin on a new server.
 *
 *   npm run user:create -- --email you@company.in --name "Your Name" --role ADMIN --password 'S3cret-pass'
 *
 * If the email exists, the password and role are updated and the user is re-activated.
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { parseArgs } from "node:util";
import { ROLES } from "../src/lib/domain";
import { hashPassword } from "../src/server/auth/password";
import { closeDb, getDb } from "../src/server/db/client";
import { auditLogs, users } from "../src/server/db/schema";

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "ADMIN" },
      password: { type: "string" },
    },
  });
  const email = values.email?.trim().toLowerCase();
  const role = values.role?.toUpperCase() as (typeof ROLES)[number];
  if (!email || !values.password) throw new Error("Usage: --email <email> --password <password> [--name <name>] [--role ADMIN|MANAGER|ENGINEER|VIEWER]");
  if (!ROLES.includes(role)) throw new Error(`Role must be one of ${ROLES.join(", ")}`);
  if (values.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await hashPassword(values.password);
  const db = getDb();
  const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  const [u] = existing
    ? await db
        .update(users)
        .set({ passwordHash, role, status: "ACTIVE", updatedAt: new Date(), ...(values.name ? { name: values.name } : {}) })
        .where(eq(users.id, existing.id))
        .returning()
    : await db.insert(users).values({ email, name: values.name ?? email.split("@")[0]!, role, passwordHash }).returning();
  await db.insert(auditLogs).values({ actorId: null, action: "cli_upsert", entity: "user", entityId: u!.id, data: { email, role } });
  console.log(`Saved ${u!.email} (${u!.role}).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
