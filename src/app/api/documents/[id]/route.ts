import { readJson, route } from "@/server/http/route";
import { updateDocument } from "@/server/services/documents.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updateDocument(actor, params.id, await readJson(req)));
