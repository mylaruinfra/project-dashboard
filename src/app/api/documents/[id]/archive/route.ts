import { readJson, route } from "@/server/http/route";
import { setDocumentArchived } from "@/server/services/documents.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => setDocumentArchived(actor, params.id, await readJson(req)));
