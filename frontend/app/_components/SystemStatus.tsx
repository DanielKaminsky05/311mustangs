import { getPipelineMetrics } from "../_server/data";
import { SystemStatusDisclosure } from "./SystemStatusDisclosure";

/**
 * Server entry — fetches the pipeline metrics and hands them to the
 * client-only disclosure for the popover toggle.
 */
export async function SystemStatus() {
  const m = await getPipelineMetrics();
  return <SystemStatusDisclosure metrics={m} />;
}

export function SystemStatusSkeleton() {
  return (
    <div
      aria-hidden
      className="h-7 px-2.5 inline-flex items-center gap-2 border border-border rounded-[3px] bg-surface text-xs text-ink-faint"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
      System status
    </div>
  );
}
