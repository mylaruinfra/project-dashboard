import { readJson, route } from "@/server/http/route";
import { setProjectStatus } from "@/server/services/projects.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => setProjectStatus(actor, params.id, await readJson(req)));
