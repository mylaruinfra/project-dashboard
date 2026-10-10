import { readJson, route } from "@/server/http/route";
import { updateClient } from "@/server/services/clients.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updateClient(actor, params.id, await readJson(req)));
