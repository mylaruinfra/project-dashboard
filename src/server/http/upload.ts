import type { NextRequest } from "next/server";
import { AppError } from "../errors";
import type { UploadFile } from "../services/documents.service";

/** Reads multipart form data: one "file" plus plain fields. */
export async function readUpload(req: NextRequest): Promise<{ fields: Record<string, string>; file: UploadFile }> {
  const form = await req.formData().catch(() => null);
  if (!form) throw new AppError("VALIDATION", "Send the file as a form upload.");
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Pick a file to upload.", { file: "Pick a file to upload" });
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") fields[k] = v;
  return { fields, file: { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) } };
}
