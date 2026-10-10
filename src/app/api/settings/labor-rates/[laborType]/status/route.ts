import { readJson, route } from "@/server/http/route";
import { setLaborRateStatus } from "@/server/services/settings.service";

export const POST = route<{ laborType: string }>(async ({ req, actor, params }) => setLaborRateStatus(actor, decodeURIComponent(params.laborType), await readJson(req)));
