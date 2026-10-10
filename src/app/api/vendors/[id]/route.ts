import { readJson, route } from "@/server/http/route";
import { updateVendor } from "@/server/services/vendors.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updateVendor(actor, params.id, await readJson(req)));
