import { getPendingApprovals } from "../lib/mock-data";
import { ApprovalQueue } from "../_components/ApprovalQueue";

export default function ApprovalsPage() {
  const requests = getPendingApprovals();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Human-in-the-loop approvals
        </h1>
        <p className="text-sm text-zinc-500">
          Items gated for operator sign-off: pending-approval schedules and
          high-risk requests routed to human review.
        </p>
      </header>
      <ApprovalQueue requests={requests} />
    </div>
  );
}
