"use server";

import { cookies } from "next/headers";
import { ulid } from "ulid";
import { updateTag } from "next/cache";
import {
  MAX_FILES_PER_REQUEST,
  saveTempFile,
  sweepOrphans,
  type UploadError,
} from "../_server/uploads";
import { listAttachmentsBySession } from "../_server/uploads";

const SESSION_COOKIE = "311_session";

export type UploadFileResult =
  | {
      ok: true;
      attachment_id: string;
      display_name: string;
      mime_type: string;
      size_bytes: number;
      checksum: string;
      preview_url: string;
    }
  | {
      ok: false;
      file_index: number;
      error_code: UploadError;
      reason: string;
      display_name: string;
    };

export async function uploadAttachment(
  formData: FormData,
): Promise<{ session_id: string; results: UploadFileResult[] }> {
  // Best-effort orphan sweep so the temp dir doesn't grow forever
  sweepOrphans().catch(() => {});

  const cookieStore = await cookies();
  let session_id = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session_id) {
    session_id = ulid();
    cookieStore.set(SESSION_COOKIE, session_id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24h
    });
  }

  const files = formData.getAll("file").filter((v): v is File => v instanceof File);
  const existing = await listAttachmentsBySession(session_id);
  const remainingSlots = MAX_FILES_PER_REQUEST - existing.length;

  const results: UploadFileResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const display = (file.name || "untitled").replace(/[\r\n]/g, "");
    if (i >= remainingSlots) {
      results.push({
        ok: false,
        file_index: i,
        error_code: "TOO_MANY_FILES",
        reason: `Max ${MAX_FILES_PER_REQUEST} files per request.`,
        display_name: display,
      });
      continue;
    }
    const save = await saveTempFile(session_id, file, display);
    if (save.ok) {
      results.push({
        ok: true,
        attachment_id: save.record.attachment_id,
        display_name: save.record.display_name,
        mime_type: save.record.mime_type,
        size_bytes: save.record.size_bytes,
        checksum: save.record.checksum,
        preview_url: `/uploads/${save.record.storage_scope}/${save.record.attachment_id}`,
      });
    } else {
      results.push({
        ok: false,
        file_index: i,
        error_code: save.error,
        reason: save.reason,
        display_name: display,
      });
    }
  }

  updateTag("fixtures");
  return { session_id, results };
}
