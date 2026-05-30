"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, UserRound, Edit3 } from "lucide-react";
import {
  approveDecision,
  type ApprovalAction,
  type ApprovalResult,
} from "../_actions/approveDecision";
import type { CategoryCandidate } from "../_server/types";

export function ApprovalActions({
  ticket_id,
  candidates,
}: {
  ticket_id: string;
  candidates: CategoryCandidate[];
}) {
  const [pending, startTransition] = useTransition();
  const [showOverride, setShowOverride] = useState(false);
  const [result, setResult] = useState<ApprovalResult | null>(null);

  const run = (action: ApprovalAction) =>
    startTransition(async () => {
      const r = await approveDecision(ticket_id, action);
      setResult(r);
    });

  if (result?.ok) {
    return (
      <p className="text-xs font-mono text-[color:var(--color-decision-ok)]">
        status → {result.status}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("approve")}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-[color:var(--color-decision-ok)]/40 bg-[color:var(--color-decision-ok)]/10 text-[color:var(--color-decision-ok)] rounded-sm hover:bg-[color:var(--color-decision-ok)]/20 disabled:opacity-60"
        >
          <CheckCircle2 size={12} aria-hidden /> Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowOverride((v) => !v)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border bg-surface-alt text-ink-muted rounded-sm hover:bg-civic-blue-soft hover:text-civic-blue-deep disabled:opacity-60"
        >
          <Edit3 size={12} aria-hidden /> Override category
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("send_to_human")}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-[color:var(--color-decision-stop)]/40 bg-[color:var(--color-decision-stop)]/10 text-[color:var(--color-decision-stop)] rounded-sm hover:bg-[color:var(--color-decision-stop)]/20 disabled:opacity-60"
        >
          <UserRound size={12} aria-hidden /> Send to human review
        </button>
      </div>
      {showOverride && (
        <div className="flex flex-col gap-1 w-full max-w-md">
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">
            Pick a category from the top-K — free text isn&apos;t allowed.
          </p>
          {candidates.map((c) => (
            <button
              key={c.service_request_type}
              type="button"
              disabled={pending}
              onClick={() => run("override_category")}
              className="text-left text-xs border border-border rounded-sm px-2 py-1 hover:bg-civic-blue-soft hover:border-civic-blue"
            >
              <span className="text-ink">{c.service_request_type}</span>{" "}
              <span className="text-ink-faint font-mono">
                (conf {c.confidence.toFixed(2)})
              </span>
            </button>
          ))}
        </div>
      )}
      {result && !result.ok && (
        <p className="text-xs text-[color:var(--color-decision-stop)]">
          {result.message}
        </p>
      )}
    </div>
  );
}
