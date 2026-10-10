import { route } from "@/server/http/route";
import { readDocumentFile } from "@/server/services/documents.service";

/** Streams the stored file after the same permission checks as viewing the document. */
export const GET = route<{ id: string }>(async ({ req, actor, params }) => {
  const f = await readDocumentFile(actor, params.id);
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(Buffer.from(f.bytes), {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(f.fileName)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
