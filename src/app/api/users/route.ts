import { readJson, route } from "@/server/http/route";
import { createUser } from "@/server/services/users.service";

export const POST = route(async ({ req, actor }) => createUser(actor, await readJson(req)));
