import { readJson, route } from "@/server/http/route";
import { createVendor } from "@/server/services/vendors.service";

export const POST = route(async ({ req, actor }) => createVendor(actor, await readJson(req)));
