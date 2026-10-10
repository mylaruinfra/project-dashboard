import { readJson, route } from "@/server/http/route";
import { setMaterialStatus } from "@/server/services/materials.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => setMaterialStatus(actor, params.id, await readJson(req)));
