"use client";

import { useState } from "react";
import Link from "next/link";
import { DECISION_META, type ServiceRequest } from "@/app/lib/mock-data";
import { DecisionBadge } from "./DecisionBadge";

type Resolution = "approved" | "overridden";

export function ApprovalQueue({ requests }: { requests: ServiceRequest[] }) {
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});

  function act(id: string, res: Resolution) {
    setResolved((prev) => ({ ...prev, [id]: res }));
  }

  const pending = requests.filter((r) => !resolved[r.id]);

  return (
    <div className="space-y-3">
      {pending.length === 0 && (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Queue clear — every pending item has been actioned.
        </p>
      )}

      {requests.map((r) => {
        const res = resolved[r.id];
        return (
          <div
            key={r.id}
            className={`rounded-xl border p-4 transition-colors ${
              res
                ? "border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <DecisionBadge label={r.decision.label} size="sm" />
                  <Link
                    href={`/requests/${r.id}`}
                    className="font-mono text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    {r.id}
                  </Link>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-200">
                  {r.description}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {r.location} · {r.ward} · public-safety{" "}
                  <span className="font-mono">
                    {r.decision.scores.public_safety_score.toFixed(2)}
                  </span>{" "}
                  · confidence{" "}
                  <span className="font-mono">
                    {r.decision.scores.confidence_score.toFixed(2)}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {res ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      res === "approved"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                    }`}
                  >
                    {res === "approved" ? "✓ Approved" : "↺ Overridden"}
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => act(r.id, "approved")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => act(r.id, "overridden")}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Override
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="mt-2 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
              {r.decision.summary || DECISION_META[r.decision.label].blurb}
            </p>
          </div>
        );
      })}
    </div>
  );
}
