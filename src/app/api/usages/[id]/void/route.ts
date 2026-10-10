import { readJson, route } from "@/server/http/route";
import { voidUsage } from "@/server/services/stock.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => voidUsage(actor, params.id, await readJson(req)));
