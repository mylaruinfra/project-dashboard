import { readJson, route } from "@/server/http/route";
import { updateReceipt } from "@/server/services/stock.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updateReceipt(actor, params.id, await readJson(req)));
