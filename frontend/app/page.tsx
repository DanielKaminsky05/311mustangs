import Link from "next/link";
import Image from "next/image";
import {
  getApprovalsQueue,
  getEvidencePacks,
  getRecentTickets,
} from "./_server/data";
import { Panel, PageHeader } from "./_components/Panel";
import { PageUtilityButtons } from "./_components/PageUtilityButtons";
import { DataTable, type Column } from "./_components/DataTable";
import { DecisionChip, HardRouteBadge } from "./_components/DecisionChip";
import { EmptyState } from "./_components/EmptyState";
import { ArrowRight } from "lucide-react";
import type { CanonicalTicket, EvidencePack } from "./_server/types";
import { columnLabels, translateFiringReason } from "./_lib/translations";

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
      header: columnLabels.ticket_id,
      cell: (r) => <span className="font-mono">{r.ticket_id}</span>,
      width: "8rem",
    },
    {
      key: "reported_at",
      header: columnLabels.reported_at,
      cell: (r) => (
        <span className="font-mono text-xs text-ink-muted">{r.reported_at}</span>
      ),
      width: "14rem",
    },
    {
      key: "description",
      header: columnLabels.description,
      cell: (r) => (
        <span className="text-ink line-clamp-1" title={r.description}>
          {r.description}
        </span>
      ),
    },
    {
      key: "category",
      header: columnLabels.category,
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
      header: columnLabels.duplicate,
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
      header: columnLabels.urgency,
      cell: (r) =>
        r.evidence ? (
          <div className="flex flex-col gap-1 items-start">
            <DecisionChip
              signal="urgency"
              value={r.evidence.urgency_decision}
              size="sm"
            />
            {r.evidence.score_breakdown.hard_routes_triggered.length > 0 && (
              <HardRouteBadge flags={r.evidence.score_breakdown.hard_routes_triggered} />
            )}
          </div>
        ) : null,
    },
    {
      key: "route",
      header: columnLabels.route,
      cell: (r) =>
        r.evidence ? (
          <DecisionChip signal="route" value={r.evidence.route} size="sm" />
        ) : null,
    },
  ];

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Operator dashboard"
        actions={<PageUtilityButtons />}
        hero={
          <div className="overflow-hidden rounded-[3px] border border-border">
            <Image
              src="/toronto-hero.jpg"
              alt="Nathan Phillips Square with the Toronto sign"
              width={1680}
              height={440}
              priority
              className="w-full h-auto block"
              sizes="(min-width: 1280px) 1280px, 100vw"
            />
          </div>
        }
        intro="The most recent requests and what needs your attention. Click a row to see what the system found and decide what to do next."
      />

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
                    <span className="text-[11px] text-ink-faint truncate max-w-[280px]" title={a.firing_reason}>
                      {translateFiringReason(a.firing_reason)}
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
