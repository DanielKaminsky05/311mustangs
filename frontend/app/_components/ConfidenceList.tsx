import type { CategoryCandidate } from "../_server/types";

export function ConfidenceList({
  candidates,
  confidence,
  margin,
}: {
  candidates: CategoryCandidate[];
  confidence: number;
  margin: number;
}) {
  const top = candidates[0]?.confidence ?? 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-ink-muted mb-3">
        <span>
          top confidence{" "}
          <span className="font-mono text-ink">{confidence.toFixed(2)}</span> ·
          margin <span className="font-mono text-ink">{margin.toFixed(2)}</span>
        </span>
        <span className="text-ink-faint font-mono">top-K = {candidates.length}</span>
      </div>
      <ol className="flex flex-col gap-2">
        {candidates.map((c, i) => {
          const pct = top > 0 ? (c.confidence / top) * 100 : 0;
          const isTop = i === 0;
          return (
            <li
              key={`${c.service_request_type}-${i}`}
              className="border border-border rounded-sm bg-surface-alt/40 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={[
                      "truncate text-sm",
                      isTop ? "text-ink font-semibold" : "text-ink",
                    ].join(" ")}
                  >
                    {c.service_request_type}
                  </p>
                  <p className="text-xs text-ink-muted truncate">
                    {c.division} · {c.section}
                  </p>
                </div>
                <div className="shrink-0 font-mono text-xs text-ink">
                  conf {c.confidence.toFixed(2)} · sim {c.similarity.toFixed(2)}
                </div>
              </div>
              <div className="mt-2 h-1 bg-surface rounded-sm overflow-hidden border border-border">
                <div
                  className="h-full bg-civic-blue"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
