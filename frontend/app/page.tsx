import Link from "next/link";
import {
  getApprovalsQueue,
  getEvidencePacks,
  getRecentTickets,
} from "./_server/data";
import { Panel } from "./_components/Panel";
import { DataTable, type Column } from "./_components/DataTable";
import { DecisionChip, HardRouteBadge } from "./_components/DecisionChip";
import { EmptyState } from "./_components/EmptyState";
import { ArrowRight } from "lucide-react";
import type { CanonicalTicket, EvidencePack } from "./_server/types";

type Row = {
  ticket_id: string;
  reported_at: string;
  description: string;
  evidence: EvidencePack | null;
};

export default async function DashboardPage() {
  const [tickets, evidence, approvals] = await Promise.all([
    getRecentTickets(),
    getEvidencePacks(),
    getApprovalsQueue(),
  ]);
  const byTicket = new Map(evidence.map((e) => [e.ticket_id, e]));
  const rows: Row[] = tickets.map((t: CanonicalTicket) => ({
    ticket_id: t.ticket_id,
    reported_at: t.reported_at,
    description: t.description,
    evidence: byTicket.get(t.ticket_id) ?? null,
  }));

  const columns: Column<Row>[] = [
    {
      key: "ticket_id",
      header: "ticket_id",
      cell: (r) => <span className="font-mono">{r.ticket_id}</span>,
      width: "8rem",
    },
    {
      key: "reported_at",
      header: "reported_at",
      cell: (r) => (
        <span className="font-mono text-xs text-ink-muted">{r.reported_at}</span>
      ),
      width: "14rem",
    },
    {
      key: "description",
      header: "description",
      cell: (r) => (
        <span className="text-ink line-clamp-1" title={r.description}>
          {r.description}
        </span>
      ),
    },
    {
      key: "category",
      header: "category",
      cell: (r) =>
        r.evidence ? (
          <DecisionChip
            signal="category"
            value={r.evidence.category_decision}
            size="sm"
          />
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "duplicate",
      header: "duplicate",
      cell: (r) =>
        r.evidence ? (
          <DecisionChip
            signal="duplicate"
            value={r.evidence.duplicate_decision}
            size="sm"
          />
        ) : null,
    },
    {
      key: "urgency",
      header: "urgency",
      cell: (r) =>
        r.evidence ? (
          <div className="flex flex-col gap-1">
            <DecisionChip
              signal="urgency"
              value={r.evidence.urgency_decision}
              size="sm"
            />
            {r.evidence.hard_route_flags.length > 0 && (
              <HardRouteBadge flags={r.evidence.hard_route_flags} />
            )}
          </div>
        ) : null,
    },
    {
      key: "route",
      header: "route",
      cell: (r) =>
        r.evidence ? (
          <DecisionChip signal="route" value={r.evidence.route} size="sm" />
        ) : null,
    },
  ];

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Operator dashboard</h1>
        <p className="text-sm text-ink-muted mt-1 max-w-prose">
          Recent triage decisions and the queue of items needing human action.
          Every score and decision shown on this surface is computed in the
          backend; the agent explains, it never decides.
        </p>
      </header>

      <Panel
        title="Recent triage decisions"
        subtitle={`${tickets.length} most recent · click a row to inspect.`}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.ticket_id}
          rowHref={(r) => `/requests/${r.ticket_id}`}
        />
      </Panel>

      <Panel
        title="Pending operator action"
        subtitle={`${pendingCount} item${pendingCount === 1 ? "" : "s"} awaiting review.`}
        actions={
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1 text-xs text-civic-blue-deep hover:underline"
          >
            Open queue <ArrowRight size={12} aria-hidden />
          </Link>
        }
      >
        {approvals.length === 0 ? (
          <EmptyState title="No pending items." />
        ) : (
          <ul className="flex flex-col gap-2">
            {approvals
              .filter((a) => a.status === "pending")
              .slice(0, 5)
              .map((a) => (
                <li
                  key={a.ticket_id}
                  className="border border-border rounded-sm px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/requests/${a.ticket_id}`}
                      className="font-mono text-sm text-civic-blue-deep hover:underline"
                    >
                      {a.ticket_id}
                    </Link>
                    <p className="text-xs text-ink-muted truncate">
                      {a.ticket.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <DecisionChip
                      signal="urgency"
                      value={a.evidence.urgency_decision}
                      size="sm"
                    />
                    <span className="text-[11px] font-mono text-ink-faint truncate max-w-[260px]">
                      {a.firing_reason}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
