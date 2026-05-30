import { FileText, ImageIcon, X, ExternalLink } from "lucide-react";
import { formatByteSize } from "../_lib/format";

export type AttachmentTileProps = {
  attachment_id: string;
  display_name: string;
  mime_type: string;
  size_bytes: number;
  preview_url?: string;
  onRemove?: () => void;
};

export function AttachmentTile({
  attachment_id,
  display_name,
  mime_type,
  size_bytes,
  preview_url,
  onRemove,
}: AttachmentTileProps) {
  const isImage = mime_type.startsWith("image/");
  const hasPreview = !!preview_url;

  const Thumbnail = (
    <div className="aspect-[4/3] bg-surface-alt grid place-items-center text-ink-faint">
      {isImage && preview_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview_url}
          alt={display_name}
          width={400}
          height={300}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-1 text-ink-muted">
          {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
          <span className="font-mono text-[10px] uppercase">{mime_type}</span>
        </div>
      )}
    </div>
  );

  return (
    <figure className="relative border border-border rounded-sm bg-surface overflow-hidden group">
      {hasPreview ? (
        <a
          href={preview_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${display_name} at full size`}
          className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-blue"
        >
          {Thumbnail}
        </a>
      ) : (
        Thumbnail
      )}
      <figcaption className="px-2 py-1.5 border-t border-border">
        <p className="text-[11px] text-ink truncate" title={display_name}>
          {display_name}
        </p>
        <div className="flex items-baseline justify-between gap-1">
          <p className="text-[10px] text-ink-faint font-mono tabular-nums">
            {formatByteSize(size_bytes)} · {attachment_id.slice(0, 8)}…
          </p>
          {hasPreview && (
            <a
              href={preview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-civic-blue hover:text-civic-blue-deep no-underline"
              aria-label={`Open ${display_name} in a new tab`}
            >
              View <ExternalLink size={9} aria-hidden />
            </a>
          )}
        </div>
      </figcaption>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${display_name}`}
          className="absolute top-1 right-1 bg-surface/90 border border-border rounded-sm p-0.5 text-ink-muted hover:text-decision-stop hover:border-decision-stop"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </figure>
  );
}
