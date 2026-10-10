import { readJson, route } from "@/server/http/route";
import { setCompanyName } from "@/server/services/settings.service";

export const PUT = route(async ({ req, actor }) => setCompanyName(actor, await readJson(req)));
