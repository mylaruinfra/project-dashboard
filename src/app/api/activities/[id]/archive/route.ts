import { readJson, route } from "@/server/http/route";
import { setActivityArchived } from "@/server/services/progress.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => setActivityArchived(actor, params.id, await readJson(req)));
