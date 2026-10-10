import { readJson, route } from "@/server/http/route";
import { resetPassword } from "@/server/services/users.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => resetPassword(actor, params.id, await readJson(req)));
