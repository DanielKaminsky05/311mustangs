import Link from "next/link";
import {
  SERVICE_REQUESTS,
  formatTime,
  type DecisionLabel,
} from "./lib/mock-data";
import { DecisionBadge } from "./_components/DecisionBadge";

function counts() {
  const c: Partial<Record<DecisionLabel, number>> = {};
  for (const r of SERVICE_REQUESTS) {
    c[r.decision.label] = (c[r.decision.label] ?? 0) + 1;
  }
  return c;
}

export default function DashboardPage() {
  const c = counts();
  const stats = [
    { label: "Live requests", value: SERVICE_REQUESTS.length },
    { label: "Auto-handled", value: (c.AUTO_SCHEDULE ?? 0) + (c.DUPLICATE ?? 0) },
    {
      label: "Awaiting human",
      value: (c.HUMAN_REVIEW ?? 0) + (c.AUTO_SCHEDULE_PENDING_APPROVAL ?? 0),
    },
    { label: "Duplicates caught", value: c.DUPLICATE ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Resolution dashboard
          </h1>
          <p className="text-sm text-zinc-500">
            Triage outcomes grounded in DGX retrieval over 193k+ historical 311
            records.
          </p>
        </div>
        <Link
          href="/submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + Submit request
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-xs text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
          Incoming requests
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {SERVICE_REQUESTS.map((r) => (
            <li key={r.id}>
              <Link
                href={`/requests/${r.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-400">
                      {r.id}
                    </span>
                    <span className="text-xs text-zinc-400">·</span>
                    <span className="text-xs text-zinc-400">{r.channel}</span>
                    {r.attachments.length > 0 && (
                      <span className="text-xs text-zinc-400">
                        · 📎 {r.attachments.length}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-zinc-800 dark:text-zinc-200">
                    {r.description}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {r.service_request_type} · {r.location}
                  </p>
                </div>
                <span className="hidden text-xs text-zinc-400 sm:block">
                  {formatTime(r.submitted_at)}
                </span>
                <DecisionBadge label={r.decision.label} size="sm" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
