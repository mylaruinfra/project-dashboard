/**
 * File storage behind a tiny interface so it can move to S3-compatible storage later.
 * Default: local disk under UPLOAD_DIR (mounted as a Docker volume in production).
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface FileStorage {
  put(bytes: Uint8Array, ext: string): Promise<string>;
  get(key: string): Promise<Uint8Array>;
}

function root(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads");
}

export const localStorage: FileStorage = {
  async put(bytes, ext) {
    const now = new Date();
    const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const key = `${dir}/${randomUUID()}${ext}`;
    await mkdir(path.join(root(), dir), { recursive: true });
    await writeFile(path.join(root(), key), bytes);
    return key;
  },
  async get(key) {
    const full = path.resolve(root(), key);
    if (!full.startsWith(root() + path.sep)) throw new Error("Invalid storage key");
    return new Uint8Array(await readFile(full));
  },
};

export function getStorage(): FileStorage {
  return localStorage;
}

export const EXT_FOR_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

/** Checks magic bytes so a renamed file cannot pass as an image or PDF. */
export function sniffMime(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  return null;
}
