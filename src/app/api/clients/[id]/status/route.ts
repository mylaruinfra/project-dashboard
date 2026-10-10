import { readJson, route } from "@/server/http/route";
import { setClientStatus } from "@/server/services/clients.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => setClientStatus(actor, params.id, await readJson(req)));
