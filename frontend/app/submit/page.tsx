import { Panel, PageHeader } from "../_components/Panel";
import { PageUtilityButtons } from "../_components/PageUtilityButtons";
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
        actions={<PageUtilityButtons />}
        title="New request"
        intro="Submit a request the same way the WhatsApp intake bot would. You don't pick a category — the system suggests one. The safety questions help route urgent issues to a person right away."
      />

      <Panel title="New request">
        <SubmitForm demoCases={demoCases} />
      </Panel>
    </div>
  );
}
