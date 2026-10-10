import type { Actor } from "./auth/actor";
import type { DbOrTx } from "./db/client";
import { auditLogs } from "./db/schema";

export interface AuditEntry {
  action: string; // e.g. "create", "update", "void", "archive", "confirm"
  entity: string; // e.g. "transaction"
  entityId: string;
  projectId?: string | null;
  reason?: string | null;
  data?: unknown;
}

/** Always called inside the same db.transaction as the change it records. */
export async function audit(tx: DbOrTx, actor: Actor | null, e: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: actor?.id ?? null,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId,
    projectId: e.projectId ?? null,
    reason: e.reason ?? null,
    data: e.data ?? null,
  });
}
