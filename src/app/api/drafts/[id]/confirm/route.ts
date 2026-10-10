import { readJson, route } from "@/server/http/route";
import { confirmDraft } from "@/server/services/drafts.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => confirmDraft(actor, params.id, await readJson(req)));
