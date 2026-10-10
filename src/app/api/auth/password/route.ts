import { readJson, route } from "@/server/http/route";
import { changeOwnPassword } from "@/server/services/users.service";

export const POST = route(async ({ req, actor }) => changeOwnPassword(actor, await readJson(req)));
