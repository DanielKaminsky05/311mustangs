import { Panel } from "../_components/Panel";
import { SubmitForm } from "./SubmitForm";
import { getDemoCases } from "../_server/data";

export const metadata = { title: "New request · 311 Mustangs" };

export default async function SubmitPage() {
  const demoCases = await getDemoCases();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
        <p className="text-sm text-ink-muted max-w-prose mt-1">
          This form mirrors the canonical ticket the WhatsApp intake agent
          produces. The backend infers <code className="font-mono">service_request_type</code>{" "}
          from category taxonomy — it&apos;s not collected here. Hazard flags
          are required because three of them are hard-route triggers for
          immediate human review.
        </p>
      </header>

      <Panel title="Canonical ticket">
        <SubmitForm demoCases={demoCases} />
      </Panel>
    </div>
  );
}
