import { readJson, route } from "@/server/http/route";
import { createReceipt } from "@/server/services/stock.service";

export const POST = route(async ({ req, actor }) => createReceipt(actor, await readJson(req)));
