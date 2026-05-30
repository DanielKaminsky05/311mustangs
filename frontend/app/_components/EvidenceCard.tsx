import type { NearestRecord } from "../_server/types";

export function EvidenceCard({ record }: { record: NearestRecord }) {
  return (
    <article className="border border-border rounded-sm bg-surface-alt/30">
      <div className="px-3 py-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-border">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-ink-muted truncate">
            {record.record_id}
          </p>
          <p className="text-sm text-ink truncate">
            {record.service_request_type}
          </p>
          <p className="text-[11px] text-ink-muted truncate">
            {record.division} · {record.section}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-ink">
            sim {record.similarity.toFixed(2)}
          </p>
          <p className="text-[11px] text-ink-muted">{record.status}</p>
        </div>
      </div>
      <div className="px-3 py-2 text-xs text-ink-muted grid grid-cols-1 sm:grid-cols-2 gap-1">
        <span>
          ward:{" "}
          <span className="text-ink">{record.ward ?? "—"}</span>
        </span>
        <span>
          intersection:{" "}
          <span className="text-ink">
            {record.intersection_street_1 ?? "—"}
            {record.intersection_street_2 ? ` / ${record.intersection_street_2}` : ""}
          </span>
        </span>
        <span>
          creation_date:{" "}
          <span className="font-mono text-ink">{record.creation_date}</span>
        </span>
        {record.filter_match && (
          <span className="sm:col-span-2">
            filter_match:{" "}
            <span className="text-ink">{record.filter_match.join(" · ")}</span>
          </span>
        )}
      </div>
      <details className="px-3 pb-3 text-xs">
        <summary className="cursor-pointer text-ink-muted hover:text-ink">
          structured_text
        </summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-ink bg-surface p-2 border border-border rounded-sm">
          {record.structured_text}
        </pre>
      </details>
    </article>
  );
}
