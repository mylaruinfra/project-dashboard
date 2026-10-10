import { readJson, route } from "@/server/http/route";
import { updateUsage } from "@/server/services/stock.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updateUsage(actor, params.id, await readJson(req)));
