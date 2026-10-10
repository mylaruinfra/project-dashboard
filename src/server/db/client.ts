import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction. Services accept either. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

/**
 * Picks the connection string. Under Vitest it only ever uses TEST_DATABASE_URL, and refuses
 * to run if that is missing, equals DATABASE_URL, or does not look like a test database.
 */
export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.VITEST) {
    const url = env.TEST_DATABASE_URL;
    if (!url) throw new Error("TEST_DATABASE_URL is required to run integration tests.");
    if (url === env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
    const dbName = new URL(url).pathname.slice(1);
    if (!dbName.includes("test")) throw new Error(`Refusing to run tests against "${dbName}": name must contain "test".`);
    return url;
  }
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return url;
}

const globalForDb = globalThis as unknown as { __sitebookPool?: Pool; __sitebookDb?: Db };

export function getPool(): Pool {
  if (!globalForDb.__sitebookPool) {
    globalForDb.__sitebookPool = new Pool({ connectionString: resolveDatabaseUrl(), max: 10 });
  }
  return globalForDb.__sitebookPool;
}

export function getDb(): Db {
  if (!globalForDb.__sitebookDb) globalForDb.__sitebookDb = drizzle(getPool(), { schema });
  return globalForDb.__sitebookDb;
}

export async function closeDb(): Promise<void> {
  await globalForDb.__sitebookPool?.end();
  globalForDb.__sitebookPool = undefined;
  globalForDb.__sitebookDb = undefined;
}
