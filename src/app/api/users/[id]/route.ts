import { readJson, route } from "@/server/http/route";
import { updateUser } from "@/server/services/users.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updateUser(actor, params.id, await readJson(req)));
