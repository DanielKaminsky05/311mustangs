import { FileText, ImageIcon, X } from "lucide-react";

export type AttachmentTileProps = {
  attachment_id: string;
  display_name: string;
  mime_type: string;
  size_bytes: number;
  preview_url?: string;
  onRemove?: () => void;
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentTile({
  attachment_id,
  display_name,
  mime_type,
  size_bytes,
  preview_url,
  onRemove,
}: AttachmentTileProps) {
  const isImage = mime_type.startsWith("image/");
  return (
    <figure className="relative border border-border rounded-sm bg-surface overflow-hidden">
      <div className="aspect-[4/3] bg-surface-alt grid place-items-center text-ink-faint">
        {isImage && preview_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview_url}
            alt={display_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-ink-muted">
            {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
            <span className="font-mono text-[10px] uppercase">{mime_type}</span>
          </div>
        )}
      </div>
      <figcaption className="px-2 py-1.5 border-t border-border">
        <p className="text-[11px] text-ink truncate" title={display_name}>
          {display_name}
        </p>
        <p className="text-[10px] text-ink-faint font-mono">
          {fmtSize(size_bytes)} · {attachment_id.slice(0, 8)}…
        </p>
      </figcaption>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${display_name}`}
          className="absolute top-1 right-1 bg-surface/90 border border-border rounded-sm p-0.5 text-ink-muted hover:text-decision-stop hover:border-decision-stop"
        >
          <X size={12} />
        </button>
      )}
    </figure>
  );
}
