import { readJson, route } from "@/server/http/route";
import { upsertLaborRate } from "@/server/services/settings.service";

export const POST = route(async ({ req, actor }) => upsertLaborRate(actor, await readJson(req)));
