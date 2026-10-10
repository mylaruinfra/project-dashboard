import { route } from "@/server/http/route";
import { readUpload } from "@/server/http/upload";
import { uploadDocument } from "@/server/services/documents.service";

export const POST = route(async ({ req, actor }) => {
  const { fields, file } = await readUpload(req);
  return uploadDocument(actor, fields, file);
});
