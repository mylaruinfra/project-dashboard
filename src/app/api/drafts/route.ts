import { route } from "@/server/http/route";
import { readUpload } from "@/server/http/upload";
import { createDraft } from "@/server/services/drafts.service";

export const maxDuration = 120;

export const POST = route(async ({ req, actor }) => {
  const { fields, file } = await readUpload(req);
  return createDraft(actor, fields, file);
});
