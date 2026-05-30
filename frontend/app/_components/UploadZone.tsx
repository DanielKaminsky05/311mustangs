"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "@/app/lib/mock-data";

const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];
const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.heic,.pdf";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

export interface UploadedFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  previewUrl?: string;
  /** Simulated upload progress 0–100. */
  progress: number;
}

/**
 * Client file-upload leaf (docs/planning/frontend.md §2).
 *
 * Client-side validation here is UX only — in the real system the Server
 * Function that receives the bytes is the authority (MIME sniff, size, count).
 * This mock simulates per-file progress and never sends bytes anywhere.
 */
export function UploadZone({
  files,
  onChange,
}: {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      setError(null);
      const next = [...files];

      for (const file of Array.from(incoming)) {
        if (next.length >= MAX_FILES) {
          setError(`Max ${MAX_FILES} files per request.`);
          break;
        }
        if (!ACCEPTED.includes(file.type)) {
          setError(`"${file.name}" rejected — unsupported type (${file.type || "unknown"}).`);
          continue;
        }
        if (file.size > MAX_SIZE) {
          setError(`"${file.name}" rejected — over 10 MB.`);
          continue;
        }
        const id = `att_${Math.random().toString(36).slice(2, 8)}`;
        const isImage = file.type.startsWith("image/");
        next.push({
          id,
          name: file.name,
          mime: file.type,
          size: file.size,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
          progress: 0,
        });
      }
      onChange(next);
    },
    [files, onChange],
  );

  // Simulate per-file upload progress: advance any file still below 100%.
  useEffect(() => {
    if (!files.some((f) => f.progress < 100)) return;
    const t = setTimeout(() => {
      onChange(
        files.map((f) =>
          f.progress < 100
            ? { ...f, progress: Math.min(100, f.progress + 25) }
            : f,
        ),
      );
    }, 180);
    return () => clearTimeout(t);
  }, [files, onChange]);

  function remove(id: string) {
    const target = files.find((f) => f.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter((f) => f.id !== id));
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging
            ? "border-sky-400 bg-sky-50 dark:bg-sky-950/30"
            : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        }`}
      >
        <span className="text-2xl text-zinc-400">⬆</span>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Drag photos or a permit PDF here, or{" "}
          <span className="font-medium text-sky-600 dark:text-sky-400">
            browse
          </span>
        </p>
        <p className="text-xs text-zinc-400">
          JPG · PNG · WEBP · HEIC · PDF — up to 10 MB each, {MAX_FILES} max
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {files.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
            >
              {f.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.previewUrl}
                  alt={f.name}
                  className="size-12 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-md bg-zinc-100 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
                  PDF
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-zinc-700 dark:text-zinc-200">
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    className="shrink-0 text-zinc-400 hover:text-rose-500"
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        f.progress >= 100 ? "bg-emerald-500" : "bg-sky-500"
                      }`}
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs text-zinc-400">
                    {f.progress >= 100 ? formatBytes(f.size) : `${f.progress}%`}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
