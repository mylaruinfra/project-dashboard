import { route } from "@/server/http/route";
import { rereadDraft } from "@/server/services/drafts.service";

export const POST = route<{ id: string }>(async ({ actor, params }) => rereadDraft(actor, params.id));
