import { readJson, route } from "@/server/http/route";
import { updateActivity } from "@/server/services/progress.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updateActivity(actor, params.id, await readJson(req)));
