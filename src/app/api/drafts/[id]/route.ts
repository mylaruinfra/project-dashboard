import { readJson, route } from "@/server/http/route";
import { deleteDraft } from "@/server/services/drafts.service";

/** Admin-only hard delete of a throwaway draft (reason required). */
export const DELETE = route<{ id: string }>(async ({ req, actor, params }) => deleteDraft(actor, params.id, await readJson(req)));
