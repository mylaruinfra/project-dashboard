import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

/** Liveness + DB check for Docker health checks. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
