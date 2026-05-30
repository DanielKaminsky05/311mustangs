import { getApprovalsQueue } from "../_server/data";
import { Panel, PageHeader } from "../_components/Panel";
import { PageUtilityButtons } from "../_components/PageUtilityButtons";
import { Breadcrumbs } from "../_components/Breadcrumbs";
import { DecisionChip, HardRouteBadge } from "../_components/DecisionChip";
import { EmptyState } from "../_components/EmptyState";
import { ApprovalActions } from "./ApprovalActions";
import Link from "next/link";
import { translateFiringReason } from "../_lib/translations";
import { formatPercent, formatTimestamp, pluralize } from "../_lib/format";

export const metadata = { title: "Approvals · 311 Mustangs" };

export default async function ApprovalsPage() {
  const queue = await getApprovalsQueue();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={<Breadcrumbs items={[{ label: "Approvals" }]} />}
        actions={<PageUtilityButtons />}
        title="Approvals queue"
        intro="Requests the system flagged for you to look at — usually because of a safety issue, a medium-urgency call, or because the category was unclear. Approving sends the request to the suggested next step; you can override or hand it off."
      />

      <Panel title={`${queue.length} ${pluralize(queue.length, "item")}`}>
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
                    <p className="text-[11px] text-ink-faint mt-1 tabular-nums">
                      Reported{" "}
                      <span title={row.ticket.reported_at}>
                        {formatTimestamp(row.ticket.reported_at)}
                      </span>{" "}
                      · status{" "}
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
                    {row.evidence.score_breakdown.hard_routes_triggered.length > 0 && (
                      <HardRouteBadge flags={row.evidence.score_breakdown.hard_routes_triggered} />
                    )}
                  </div>
                </div>
                <div className="px-3 py-2 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  <div className="text-xs text-ink-muted">
                    <p className="uppercase tracking-wide text-ink-faint">
                      Why flagged
                    </p>
                    <p
                      className="text-ink mt-0.5"
                      title={row.firing_reason}
                    >
                      {translateFiringReason(row.firing_reason)}
                    </p>
                    <p className="mt-2 uppercase tracking-wide text-ink-faint">
                      Suggested category
                    </p>
                    <p className="text-ink mt-0.5">
                      {row.evidence.category_candidates[0]?.service_request_type}{" "}
                      <span className="text-ink-faint tabular-nums">
                        (
                        {formatPercent(
                          row.evidence.category_candidates[0]?.confidence ?? 0,
                        )}{" "}
                        confidence)
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
                      <p className="text-xs text-ink-muted">
                        {row.status === "approved"
                          ? "Approved"
                          : row.status === "overridden"
                            ? "Category overridden"
                            : "Sent to a human reviewer"}{" "}
                        by {row.decided_by} ·{" "}
                        <span title={row.decided_at ?? undefined}>
                          {formatTimestamp(row.decided_at)}
                        </span>
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
