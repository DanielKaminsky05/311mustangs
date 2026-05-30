import { Panel, PageHeader } from "../_components/Panel";
import { Breadcrumbs } from "../_components/Breadcrumbs";
import { SubmitForm } from "./SubmitForm";
import { getDemoCases } from "../_server/data";

export const metadata = { title: "New request · 311 Mustangs" };

export default async function SubmitPage() {
  const demoCases = await getDemoCases();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={<Breadcrumbs items={[{ label: "New request" }]} />}
        title="New request"
        intro={
          <>
            This form mirrors the canonical ticket the WhatsApp intake agent
            produces. The backend infers{" "}
            <code className="font-mono text-sm">service_request_type</code>{" "}
            from category taxonomy — it isn&apos;t collected here. Hazard
            flags are required because three of them are hard-route triggers
            for immediate human review.
          </>
        }
      />

      <Panel title="Canonical ticket">
        <SubmitForm demoCases={demoCases} />
      </Panel>
    </div>
  );
}
