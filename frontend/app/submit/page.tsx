import { SubmitForm } from "../_components/SubmitForm";

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Submit a request
        </h1>
        <p className="text-sm text-zinc-500">
          Drive a request through the DGX triage path — attach photos or a permit
          PDF, or load a scripted demo case.
        </p>
      </header>
      <SubmitForm />
    </div>
  );
}
