import { sql } from "drizzle-orm";
import type { DbOrTx } from "./db/client";
import { counters } from "./db/schema";

/** Atomically increments a named counter (row-locked by the upsert) and formats it: TXN-000042. */
export async function nextNumber(tx: DbOrTx, key: string, prefix: string, pad = 6): Promise<string> {
  const [row] = await tx
    .insert(counters)
    .values({ key, value: 1 })
    .onConflictDoUpdate({ target: counters.key, set: { value: sql`${counters.value} + 1` } })
    .returning({ value: counters.value });
  return `${prefix}-${String(row!.value).padStart(pad, "0")}`;
}
