import { readJson, route } from "@/server/http/route";
import { createPurchaseOrder } from "@/server/services/stock.service";

export const POST = route(async ({ req, actor }) => createPurchaseOrder(actor, await readJson(req)));
