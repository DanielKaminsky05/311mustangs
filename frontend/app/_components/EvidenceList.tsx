import type { NearestRecord } from "@/app/lib/mock-data";

const STATUS_TONE: Record<NearestRecord["status"], string> = {
  New: "text-emerald-600 dark:text-emerald-400",
  "In Progress": "text-sky-600 dark:text-sky-400",
  Closed: "text-zinc-500 dark:text-zinc-500",
};

export function EvidenceList({
  records,
  structuredText,
  auditLogId,
}: {
  records: NearestRecord[];
  structuredText: string;
  auditLogId: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Embedded text (structured_text)
        </p>
        <code className="block rounded-md bg-zinc-50 p-2 font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {structuredText}
        </code>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Nearest historical 311 records · DGX vector search
        </p>
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 px-3 py-2.5 text-sm"
            >
              <span className="font-mono text-xs tabular-nums text-zinc-400">
                {r.id}
              </span>
              <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                {r.service_request_type}
                <span className="text-zinc-400"> · {r.location}</span>
              </span>
              <span className={`text-xs ${STATUS_TONE[r.status]}`}>
                {r.status}
              </span>
              <span className="w-12 text-right font-mono text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {r.similarity.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-zinc-400">
        Audit log:{" "}
        <code className="font-mono text-zinc-500 dark:text-zinc-400">
          {auditLogId}
        </code>
      </p>
    </div>
  );
}
