import { readJson, route } from "@/server/http/route";
import { setVendorStatus } from "@/server/services/vendors.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => setVendorStatus(actor, params.id, await readJson(req)));
