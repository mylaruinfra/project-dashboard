import { readJson, route } from "@/server/http/route";
import { setPurchaseOrderStatus } from "@/server/services/stock.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => setPurchaseOrderStatus(actor, params.id, await readJson(req)));
