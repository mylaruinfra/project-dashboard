import { readJson, route } from "@/server/http/route";
import { rejectDraft } from "@/server/services/drafts.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => rejectDraft(actor, params.id, await readJson(req)));
