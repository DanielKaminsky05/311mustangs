"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Upload, Loader2 } from "lucide-react";
import { uploadAttachment, type UploadFileResult } from "../_actions/uploadAttachment";
import { AttachmentTile } from "./AttachmentTile";

type Attachment = Extract<UploadFileResult, { ok: true }>;
type Rejection = Extract<UploadFileResult, { ok: false }>;

export function UploadZone({
  name = "media_refs",
}: {
  name?: string;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback((files: FileList | File[]) => {
    if (!files || (files as FileList).length === 0) return;
    const fd = new FormData();
    Array.from(files as FileList).forEach((f) => fd.append("file", f));
    startTransition(async () => {
      const { results } = await uploadAttachment(fd);
      setAttachments((prev) => [
        ...prev,
        ...results.filter((r): r is Attachment => r.ok),
      ]);
      setRejections(results.filter((r): r is Rejection => !r.ok));
    });
  }, []);

  const removeOne = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.attachment_id !== id));

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files);
        }}
        className={[
          "border-2 border-dashed rounded-sm px-4 py-8 text-center transition-colors",
          dragOver
            ? "border-civic-blue bg-civic-blue-soft"
            : "border-border bg-surface-alt/40",
        ].join(" ")}
      >
        <div className="flex flex-col items-center gap-2 text-ink-muted">
          {pending ? (
            <Loader2 size={20} className="animate-spin" aria-hidden />
          ) : (
            <Upload size={20} aria-hidden />
          )}
          <p className="text-sm text-ink">
            Drop files here or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-civic-blue-deep underline underline-offset-4"
            >
              browse
            </button>
          </p>
          <p className="text-xs text-ink-faint">
            JPEG · PNG · WEBP · HEIC · PDF · up to 10&nbsp;MB each · max
            5&nbsp;files
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) upload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {pending
          ? "Uploading attachment…"
          : attachments.length > 0
            ? `${attachments.length} attachment${attachments.length === 1 ? "" : "s"} ready`
            : ""}
      </p>

      {attachments.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {attachments.map((a) => (
            <li key={a.attachment_id}>
              <AttachmentTile
                attachment_id={a.attachment_id}
                display_name={a.display_name}
                mime_type={a.mime_type}
                size_bytes={a.size_bytes}
                preview_url={a.preview_url}
                onRemove={() => removeOne(a.attachment_id)}
              />
              <input
                type="hidden"
                name={name}
                value={a.attachment_id}
                readOnly
              />
            </li>
          ))}
        </ul>
      )}

      {rejections.length > 0 && (
        <ul
          role="alert"
          aria-live="polite"
          className="text-xs text-[color:var(--color-decision-stop)] border border-[color:var(--color-decision-stop)]/40 bg-[color:var(--color-decision-stop)]/10 rounded-sm px-3 py-2"
        >
          {rejections.map((r) => (
            <li key={`${r.file_index}-${r.display_name}`}>
              <span className="font-medium">{r.display_name}</span> — {r.reason}{" "}
              <span className="font-mono text-[10px] text-ink-faint">
                ({r.error_code})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
