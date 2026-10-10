import { readJson, route } from "@/server/http/route";
import { addMember } from "@/server/services/projects.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => addMember(actor, params.id, await readJson(req)));
