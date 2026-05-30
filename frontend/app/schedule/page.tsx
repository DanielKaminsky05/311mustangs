import { getOperations, getScheduleAssignments } from "../_server/data";
import { Panel, PageHeader } from "../_components/Panel";
import { Breadcrumbs } from "../_components/Breadcrumbs";
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

  const opColumns: Column<Operation>[] = [
    {
      key: "operation_id",
      header: "operation_id",
      cell: (o) => <span className="font-mono">{o.operation_id}</span>,
      width: "8rem",
    },
    { key: "category", header: "category" },
    { key: "ward", header: "ward" },
    { key: "intersection", header: "intersection" },
    {
      key: "status",
      header: "status",
      cell: (o) => (
        <span className={`font-mono text-xs ${STATUS_CLASS[o.status]}`}>
          {o.status}
        </span>
      ),
    },
    {
      key: "scheduled_for",
      header: "scheduled_for",
      cell: (o) => (
        <span className="font-mono text-xs">{o.scheduled_for}</span>
      ),
    },
  ];

  const asColumns: Column<ScheduleAssignment>[] = [
    {
      key: "ticket_id",
      header: "ticket_id",
      cell: (a) => (
        <a
          href={`/requests/${a.ticket_id}`}
          className="font-mono text-civic-blue-deep hover:underline"
        >
          {a.ticket_id}
        </a>
      ),
      width: "8rem",
    },
    { key: "category", header: "category" },
    {
      key: "proposed_slot",
      header: "proposed_slot",
      cell: (a) => (
        <span className="font-mono text-xs">{a.proposed_slot}</span>
      ),
    },
    {
      key: "rank",
      header: "rank",
      cell: (a) => <span className="font-mono text-xs">#{a.rank}</span>,
      width: "4rem",
    },
    {
      key: "batches_with",
      header: "batches_with",
      cell: (a) =>
        a.batches_with ? (
          <span className="font-mono text-xs">
            {a.batches_with}{" "}
            <span className="text-ink-faint">
              ({opById.get(a.batches_with)?.intersection ?? "—"})
            </span>
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "explanation",
      header: "explanation",
      cell: (a) => (
        <span className="text-xs text-ink-muted line-clamp-2" title={a.explanation}>
          {a.explanation}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={<Breadcrumbs items={[{ label: "Schedule" }]} />}
        title="Schedule"
        intro="Active operations and the ranked queue of low-urgency tickets the scheduling agent has proposed inserting. The agent batches by ward, service_request_type, and intersection — its proposals show up here before an operator approves them."
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
