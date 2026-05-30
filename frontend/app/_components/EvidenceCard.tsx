import type { NearestRecord } from "../_server/types";
import { describeStrength } from "../_lib/translations";
import { formatDateOnly, formatPercent } from "../_lib/format";

export function EvidenceCard({ record }: { record: NearestRecord }) {
  const s = describeStrength(record.similarity);
  return (
    <article className="border border-border rounded-[3px] bg-surface-alt/30">
      <div className="px-3 py-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-border">
        <div className="min-w-0">
          <p className="text-sm text-ink truncate">
            {record.service_request_type}
          </p>
          <p className="text-[11px] text-ink-muted truncate">
            {record.division} · {record.section}
          </p>
          <p
            className="text-[11px] text-ink-faint font-mono mt-0.5 truncate"
            title={`record_id=${record.record_id}`}
          >
            id {record.record_id}
          </p>
        </div>
        <div className="text-right text-xs">
          <p
            className={`${s.className} tabular-nums`}
            title={`similarity=${record.similarity.toFixed(2)}`}
          >
            {s.band} match · {formatPercent(record.similarity)}
          </p>
          <p className="text-ink-muted">{record.status}</p>
        </div>
      </div>
      <div className="px-3 py-2 text-xs text-ink-muted grid grid-cols-1 sm:grid-cols-2 gap-1">
        <span>
          Ward: <span className="text-ink">{record.ward ?? "—"}</span>
        </span>
        <span>
          Intersection:{" "}
          <span className="text-ink">
            {record.intersection_street_1 ?? "—"}
            {record.intersection_street_2
              ? ` / ${record.intersection_street_2}`
              : ""}
          </span>
        </span>
        <span>
          First reported:{" "}
          <span className="text-ink">{formatDateOnly(record.creation_date)}</span>
        </span>
        {record.filter_match && (
          <span className="sm:col-span-2">
            Why we matched:{" "}
            <span className="text-ink">{record.filter_match.join(" · ")}</span>
          </span>
        )}
      </div>
      <details className="px-3 pb-3 text-xs">
        <summary className="cursor-pointer text-ink-muted hover:text-ink">
          Show technical details
        </summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-ink bg-surface p-2 border border-border rounded-[3px]">
          {record.structured_text}
        </pre>
      </details>
    </article>
  );
}
