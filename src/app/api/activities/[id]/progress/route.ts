import { readJson, route } from "@/server/http/route";
import { recordProgress } from "@/server/services/progress.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => recordProgress(actor, params.id, await readJson(req)));
