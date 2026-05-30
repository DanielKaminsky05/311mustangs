import { getApprovalsQueue } from "../_server/data";
import { Panel } from "../_components/Panel";
import { DecisionChip, HardRouteBadge } from "../_components/DecisionChip";
import { EmptyState } from "../_components/EmptyState";
import { ApprovalActions } from "./ApprovalActions";
import Link from "next/link";

export const metadata = { title: "Approvals · 311 Mustangs" };

export default async function ApprovalsPage() {
  const queue = await getApprovalsQueue();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Approvals queue</h1>
        <p className="text-sm text-ink-muted mt-1 max-w-prose">
          Items the system flagged for an operator: hard-routes, medium-urgency
          requests, and uncertain categories. Approving never overrides the
          backend score; it confirms the route the pipeline already produced.
        </p>
      </header>

      <Panel title={`${queue.length} item${queue.length === 1 ? "" : "s"}`}>
        {queue.length === 0 ? (
          <EmptyState title="Queue is empty." />
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((row) => (
              <li
                key={row.ticket_id}
                className="border border-border rounded-sm bg-surface-alt/30"
              >
                <div className="px-3 py-2 border-b border-border flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/requests/${row.ticket_id}`}
                      className="font-mono text-sm text-civic-blue-deep hover:underline"
                    >
                      {row.ticket_id}
                    </Link>
                    <p className="text-sm text-ink mt-0.5 truncate max-w-prose">
                      {row.ticket.description}
                    </p>
                    <p className="text-[11px] font-mono text-ink-faint mt-1">
                      reported_at {row.ticket.reported_at} · status{" "}
                      <span
                        className={
                          row.status === "pending"
                            ? "text-[color:var(--color-decision-warn)]"
                            : "text-[color:var(--color-decision-ok)]"
                        }
                      >
                        {row.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <DecisionChip
                      signal="urgency"
                      value={row.evidence.urgency_decision}
                      size="sm"
                    />
                    {row.evidence.hard_route_flags.length > 0 && (
                      <HardRouteBadge flags={row.evidence.hard_route_flags} />
                    )}
                  </div>
                </div>
                <div className="px-3 py-2 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  <div className="text-xs text-ink-muted">
                    <p className="uppercase tracking-wide text-ink-faint">
                      Firing reason
                    </p>
                    <p className="font-mono text-ink mt-0.5">
                      {row.firing_reason}
                    </p>
                    <p className="mt-2 uppercase tracking-wide text-ink-faint">
                      Top category candidate
                    </p>
                    <p className="text-ink mt-0.5">
                      {row.evidence.category_candidates[0]?.service_request_type}{" "}
                      <span className="text-ink-faint font-mono">
                        (conf{" "}
                        {row.evidence.category_candidates[0]?.confidence.toFixed(
                          2,
                        )}
                        )
                      </span>
                    </p>
                  </div>
                  <div className="md:justify-self-end">
                    {row.status === "pending" ? (
                      <ApprovalActions
                        ticket_id={row.ticket_id}
                        candidates={row.evidence.category_candidates}
                      />
                    ) : (
                      <p className="text-xs font-mono text-ink-muted">
                        decided by {row.decided_by} at {row.decided_at}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
