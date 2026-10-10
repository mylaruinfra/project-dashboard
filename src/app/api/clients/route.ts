import { readJson, route } from "@/server/http/route";
import { createClient } from "@/server/services/clients.service";

export const POST = route(async ({ req, actor }) => createClient(actor, await readJson(req)));
