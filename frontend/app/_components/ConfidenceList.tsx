import type { CategoryCandidate } from "../_server/types";
import { describeStrength } from "../_lib/translations";

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
  const strength = describeStrength(confidence);
  return (
    <div>
      <div className="text-sm text-ink-muted mb-3">
        Top match: {candidates[0] && (
          <span className="text-ink font-medium">
            {candidates[0].service_request_type}
          </span>
        )}{" "}
        — <span className={strength.className}>{strength.band} match</span>{" "}
        <span
          className="text-ink-faint text-xs font-mono"
          title={`category_confidence=${confidence.toFixed(2)} · category_margin=${margin.toFixed(2)}`}
        >
          ({Math.round(confidence * 100)}% confidence, runner-up{" "}
          {Math.round((confidence - margin) * 100)}%)
        </span>
      </div>
      <ol className="flex flex-col gap-2">
        {candidates.map((c, i) => {
          const pct = top > 0 ? (c.confidence / top) * 100 : 0;
          const isTop = i === 0;
          const s = describeStrength(c.confidence);
          return (
            <li
              key={`${c.service_request_type}-${i}`}
              className="border border-border rounded-[3px] bg-surface-alt/40 px-3 py-2"
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
                <div
                  className="shrink-0 text-xs"
                  title={`confidence=${c.confidence.toFixed(2)} · similarity=${c.similarity.toFixed(2)}`}
                >
                  <span className={s.className}>{s.band} match</span>{" "}
                  <span className="text-ink-faint">
                    · {Math.round(c.confidence * 100)}%
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1 bg-surface rounded-[3px] overflow-hidden border border-border">
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
