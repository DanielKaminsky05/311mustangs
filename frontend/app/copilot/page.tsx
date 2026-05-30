import { ChatPanel } from "../_components/ChatPanel";

export default function CopilotPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Operator copilot
        </h1>
        <p className="text-sm text-zinc-500">
          Grounded in audit logs and DGX retrieval. It explains decisions over
          persisted evidence — it never produces scores or invents constraints.
        </p>
      </header>
      <ChatPanel />
    </div>
  );
}
