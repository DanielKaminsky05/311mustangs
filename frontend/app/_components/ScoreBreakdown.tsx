import {
  SCORE_LABELS,
  type ScoreBreakdown as Scores,
} from "@/app/lib/mock-data";
import { scoreBarClass } from "@/app/lib/tone";

export function ScoreBreakdown({ scores }: { scores: Scores }) {
  const entries = Object.entries(scores) as [keyof Scores, number][];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {SCORE_LABELS[key]}
            </span>
            <span className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
              {value.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full ${scoreBarClass(value)}`}
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
