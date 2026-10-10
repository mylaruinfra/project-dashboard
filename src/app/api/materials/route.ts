import { readJson, route } from "@/server/http/route";
import { createMaterial } from "@/server/services/materials.service";

export const POST = route(async ({ req, actor }) => createMaterial(actor, await readJson(req)));
