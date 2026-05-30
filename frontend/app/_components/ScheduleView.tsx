import type { ScheduleCandidate } from "@/app/lib/mock-data";

export function ScheduleView({
  candidates,
}: {
  candidates: ScheduleCandidate[];
}) {
  return (
    <ol className="space-y-2">
      {candidates.map((c) => {
        const rejected = c.status === "rejected";
        return (
          <li
            key={c.label}
            className={`flex gap-3 rounded-lg border p-3 ${
              rejected
                ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20"
                : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
            }`}
          >
            <span
              className={`mt-0.5 select-none text-sm ${
                rejected
                  ? "text-rose-500 line-through"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
              aria-hidden
            >
              {rejected ? "✕" : "✓"}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {c.label}
                </span>
                <span
                  className={`font-mono text-sm tabular-nums ${
                    rejected
                      ? "text-rose-500 line-through"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {c.window}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {c.reason}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
