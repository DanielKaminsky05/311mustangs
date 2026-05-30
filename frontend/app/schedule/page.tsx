import Link from "next/link";
import { getOperations, getScheduleAssignments } from "../_server/data";
import { Panel, PageHeader } from "../_components/Panel";
import { PageUtilityButtons } from "../_components/PageUtilityButtons";
import { Breadcrumbs } from "../_components/Breadcrumbs";
import { columnLabels } from "../_lib/translations";
import { formatTimestamp } from "../_lib/format";
import { DataTable, type Column } from "../_components/DataTable";
import { EmptyState } from "../_components/EmptyState";
import type { Operation, ScheduleAssignment } from "../_server/types";

export const metadata = { title: "Schedule · 311 Mustangs" };

const STATUS_CLASS: Record<Operation["status"], string> = {
  scheduled: "text-[color:var(--color-decision-neutral)]",
  in_progress: "text-[color:var(--color-decision-warn)]",
  completed: "text-[color:var(--color-decision-ok)]",
};

export default async function SchedulePage() {
  const [operations, assignments] = await Promise.all([
    getOperations(),
    getScheduleAssignments(),
  ]);
  const opById = new Map(operations.map((o) => [o.operation_id, o]));

  const STATUS_LABEL: Record<Operation["status"], string> = {
    scheduled: "Scheduled",
    in_progress: "In progress",
    completed: "Completed",
  };

  const opColumns: Column<Operation>[] = [
    {
      key: "operation_id",
      header: columnLabels.operation_id,
      cell: (o) => <span className="font-mono">{o.operation_id}</span>,
      width: "8rem",
    },
    { key: "category", header: columnLabels.category },
    { key: "ward", header: columnLabels.ward },
    { key: "intersection", header: columnLabels.intersection },
    {
      key: "status",
      header: columnLabels.status,
      cell: (o) => (
        <span className={`text-xs ${STATUS_CLASS[o.status]}`}>
          {STATUS_LABEL[o.status]}
        </span>
      ),
    },
    {
      key: "scheduled_for",
      header: columnLabels.scheduled_for,
      cell: (o) => (
        <span className="text-xs tabular-nums" title={o.scheduled_for}>
          {formatTimestamp(o.scheduled_for)}
        </span>
      ),
    },
  ];

  const asColumns: Column<ScheduleAssignment>[] = [
    {
      key: "ticket_id",
      header: columnLabels.ticket_id,
      cell: (a) => (
        <Link
          href={`/requests/${a.ticket_id}`}
          className="font-mono text-civic-blue hover:text-civic-blue-deep no-underline"
        >
          {a.ticket_id}
        </Link>
      ),
      width: "8rem",
    },
    { key: "category", header: columnLabels.category },
    {
      key: "proposed_slot",
      header: columnLabels.proposed_slot,
      cell: (a) => (
        <span className="text-xs tabular-nums" title={a.proposed_slot}>
          {formatTimestamp(a.proposed_slot)}
        </span>
      ),
    },
    {
      key: "rank",
      header: columnLabels.rank,
      cell: (a) => <span className="text-xs">#{a.rank}</span>,
      width: "4rem",
    },
    {
      key: "batches_with",
      header: columnLabels.batches_with,
      cell: (a) =>
        a.batches_with ? (
          <span className="text-xs">
            {opById.get(a.batches_with)?.intersection ?? a.batches_with}{" "}
            <span className="text-ink-faint font-mono">
              ({a.batches_with})
            </span>
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "explanation",
      header: columnLabels.explanation,
      cell: (a) => (
        <span className="text-xs text-ink-muted line-clamp-3" title={a.explanation}>
          {a.explanation}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={<Breadcrumbs items={[{ label: "Schedule" }]} />}
        actions={<PageUtilityButtons />}
        title="Schedule"
        intro="Crews that are already scheduled, and the new low-urgency requests the system has suggested batching with them. Open a row to see why two requests were grouped together."
      />

      <Panel title="Active operations">
        {operations.length === 0 ? (
          <EmptyState title="No operations." />
        ) : (
          <DataTable
            columns={opColumns}
            rows={operations}
            rowKey={(o) => o.operation_id}
          />
        )}
      </Panel>

      <Panel
        title="Pending insertions"
        subtitle="LOW_URGENCY_SCHEDULING-routed tickets the agent has placed."
      >
        {assignments.length === 0 ? (
          <EmptyState title="No pending insertions." />
        ) : (
          <DataTable
            columns={asColumns}
            rows={assignments}
            rowKey={(a) => a.assignment_id}
          />
        )}
      </Panel>
    </div>
  );
}
