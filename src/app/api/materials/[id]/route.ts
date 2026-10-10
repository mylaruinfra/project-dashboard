import { readJson, route } from "@/server/http/route";
import { updateMaterial } from "@/server/services/materials.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updateMaterial(actor, params.id, await readJson(req)));
