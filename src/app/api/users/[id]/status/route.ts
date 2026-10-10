import { readJson, route } from "@/server/http/route";
import { setUserStatus } from "@/server/services/users.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => setUserStatus(actor, params.id, await readJson(req)));
