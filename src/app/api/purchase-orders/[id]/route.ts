import { readJson, route } from "@/server/http/route";
import { updatePurchaseOrder } from "@/server/services/stock.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updatePurchaseOrder(actor, params.id, await readJson(req)));
