import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ulid } from "ulid";
import type { AttachmentRecord } from "./types";

const ROOT = process.cwd();
const UPLOADS_DIR = path.join(ROOT, "var", "uploads");
const META_PATH = path.join(ROOT, "fixtures", "request_attachments.json");

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 5;

export type UploadError =
  | "WRONG_MIME"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "EMPTY_FILE"
  | "WRITE_FAILED";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};

/** Sniff first bytes of the buffer to determine real MIME — never trust client. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  // PDF: 25 50 44 46
  if (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    return "application/pdf";
  }
  // WEBP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  // HEIC: ftypheic / ftypheix / ftyphevc / ftypmif1 at offset 4
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "mif1", "msf1"].includes(brand))
      return "image/heic";
  }
  return null;
}

async function readMeta(): Promise<AttachmentRecord[]> {
  try {
    const raw = await fs.readFile(META_PATH, "utf-8");
    return JSON.parse(raw) as AttachmentRecord[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeMeta(records: AttachmentRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(META_PATH), { recursive: true });
  await fs.writeFile(META_PATH, JSON.stringify(records, null, 2), "utf-8");
}

export async function listAttachmentsByRequest(
  request_id: string,
): Promise<AttachmentRecord[]> {
  const all = await readMeta();
  return all.filter((a) => a.request_id === request_id);
}

export async function listAttachmentsBySession(
  session_id: string,
): Promise<AttachmentRecord[]> {
  const all = await readMeta();
  return all.filter(
    (a) => a.storage_scope === "temp" && a.storage_path.includes(session_id),
  );
}

export async function getAttachmentById(
  attachment_id: string,
): Promise<AttachmentRecord | null> {
  const all = await readMeta();
  return all.find((a) => a.attachment_id === attachment_id) ?? null;
}

export type SaveResult =
  | { ok: true; record: AttachmentRecord }
  | { ok: false; error: UploadError; reason: string };

/** Write a single file to the temp session scope. Caller has already enforced count. */
export async function saveTempFile(
  session_id: string,
  file: File,
  originalDisplayName: string,
): Promise<SaveResult> {
  if (file.size === 0)
    return { ok: false, error: "EMPTY_FILE", reason: "Zero bytes." };
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: "FILE_TOO_LARGE",
      reason: `File exceeds ${MAX_FILE_BYTES} bytes.`,
    };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMime(buf);
  if (!sniffed || !ALLOWED_MIME.has(sniffed)) {
    return {
      ok: false,
      error: "WRONG_MIME",
      reason: `MIME not on allowlist (sniffed: ${sniffed ?? "unknown"}).`,
    };
  }

  const checksum = crypto.createHash("sha256").update(buf).digest("hex");
  const all = await readMeta();
  // Dedupe within the session by checksum
  const existing = all.find(
    (a) =>
      a.checksum === checksum &&
      a.storage_scope === "temp" &&
      a.storage_path.includes(session_id),
  );
  if (existing) return { ok: true, record: existing };

  const attachment_id = ulid();
  const ext = MIME_EXT[sniffed];
  const scopeDir = path.join(UPLOADS_DIR, "temp", session_id);
  const relPath = path.posix.join(
    "temp",
    session_id,
    `${attachment_id}${ext}`,
  );
  const absPath = path.join(UPLOADS_DIR, relPath);

  try {
    await fs.mkdir(scopeDir, { recursive: true });
    await fs.writeFile(absPath, buf);
  } catch (err) {
    return {
      ok: false,
      error: "WRITE_FAILED",
      reason: (err as Error).message,
    };
  }

  const displayName = originalDisplayName
    .replace(/[\\/]/g, "_")
    .slice(0, 120);

  const record: AttachmentRecord = {
    attachment_id,
    request_id: null,
    display_name: displayName,
    mime_type: sniffed,
    size_bytes: buf.byteLength,
    checksum,
    storage_scope: "temp",
    storage_path: relPath,
    created_at: new Date().toISOString(),
  };
  await writeMeta([...all, record]);
  return { ok: true, record };
}

/** Move temp attachments belonging to a session under a real request_id. */
export async function bindSessionToRequest(
  session_id: string,
  request_id: string,
): Promise<void> {
  const all = await readMeta();
  const targetSet = all.filter(
    (a) => a.storage_scope === "temp" && a.storage_path.includes(session_id),
  );
  if (targetSet.length === 0) return;

  const updated = all.map((a) => {
    if (
      a.storage_scope !== "temp" ||
      !a.storage_path.includes(session_id)
    ) {
      return a;
    }
    const filename = path.basename(a.storage_path);
    const newRelPath = path.posix.join("req", request_id, filename);
    return {
      ...a,
      request_id,
      storage_scope: "req" as const,
      storage_path: newRelPath,
    };
  });

  // Move files on disk
  await fs.mkdir(path.join(UPLOADS_DIR, "req", request_id), { recursive: true });
  for (const a of targetSet) {
    const oldAbs = path.join(UPLOADS_DIR, a.storage_path);
    const filename = path.basename(a.storage_path);
    const newAbs = path.join(UPLOADS_DIR, "req", request_id, filename);
    try {
      await fs.rename(oldAbs, newAbs);
    } catch {
      /* file may have been moved already on a retry */
    }
  }
  await writeMeta(updated);
}

/** Sweep temp uploads older than maxAgeMs. Called best-effort. */
export async function sweepOrphans(
  maxAgeMs = 24 * 60 * 60 * 1000,
): Promise<void> {
  const all = await readMeta();
  const cutoff = Date.now() - maxAgeMs;
  const survivors: AttachmentRecord[] = [];
  for (const a of all) {
    if (a.storage_scope === "temp" && Date.parse(a.created_at) < cutoff) {
      try {
        await fs.unlink(path.join(UPLOADS_DIR, a.storage_path));
      } catch {
        /* ignore */
      }
      continue;
    }
    survivors.push(a);
  }
  if (survivors.length !== all.length) await writeMeta(survivors);
}

export function resolveAbsolutePath(record: AttachmentRecord): string {
  return path.join(UPLOADS_DIR, record.storage_path);
}
