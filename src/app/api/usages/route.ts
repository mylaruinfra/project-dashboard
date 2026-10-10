import { readJson, route } from "@/server/http/route";
import { createUsage } from "@/server/services/stock.service";

export const POST = route(async ({ req, actor }) => createUsage(actor, await readJson(req)));
