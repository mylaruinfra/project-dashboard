import { readJson, route } from "@/server/http/route";
import { voidReceipt } from "@/server/services/stock.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => voidReceipt(actor, params.id, await readJson(req)));
