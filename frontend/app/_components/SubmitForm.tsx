"use client";

import { useState } from "react";
import {
  DECISION_META,
  DEMO_CASES,
  SERVICE_REQUESTS,
  type DemoCase,
  type TriageDecision,
} from "@/app/lib/mock-data";
import { UploadZone, type UploadedFile } from "./UploadZone";
import { DecisionBadge } from "./DecisionBadge";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { EvidenceList } from "./EvidenceList";
import { ScheduleView } from "./ScheduleView";

// Each scripted demo case reuses an existing mock decision for a realistic result.
const CASE_TO_REQUEST: Record<string, string> = {
  "wychwood-graffiti": "SR-2026-004411",
  "wychwood-duplicate": "SR-2026-004417",
  "delisle-noise": "SR-2026-004420",
  "bathurst-pothole": "SR-2026-004388",
};

function decisionForCase(key: string): TriageDecision | undefined {
  const reqId = CASE_TO_REQUEST[key];
  return SERVICE_REQUESTS.find((r) => r.id === reqId)?.decision;
}

const EMPTY = { description: "", type: "", location: "", ward: "" };

export function SubmitForm() {
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  const [result, setResult] = useState<TriageDecision | null>(null);
  const [activeCase, setActiveCase] = useState<string | null>(null);

  function loadCase(c: DemoCase) {
    setForm({
      description: c.description,
      type: c.service_request_type,
      location: c.location,
      ward: c.ward,
    });
    setActiveCase(c.key);
    setResult(null);
    setPhase("idle");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("processing");
    setResult(null);
    // Simulate the DGX embed → search → score round-trip.
    setTimeout(() => {
      const decision =
        (activeCase ? decisionForCase(activeCase) : undefined) ??
        synthDecision(form);
      setResult(decision);
      setPhase("done");
    }, 1100);
  }

  function reset() {
    setForm(EMPTY);
    setFiles([]);
    setActiveCase(null);
    setResult(null);
    setPhase("idle");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Description">
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the issue a resident is reporting…"
            className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service request type">
            <input
              required
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              placeholder="e.g. Graffiti - Street Sign"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Field>
          <Field label="Ward (optional)">
            <input
              value={form.ward}
              onChange={(e) => setForm({ ...form, ward: e.target.value })}
              placeholder="e.g. Ward 12"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Field>
        </div>

        <Field label="Location / intersection hint">
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. Wychwood Ave near Tyrrel Ave"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>

        <Field label="Attachments">
          <UploadZone files={files} onChange={setFiles} />
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={phase === "processing"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {phase === "processing" ? "Running triage…" : "Submit & triage"}
          </button>
          {phase !== "idle" && (
            <button
              type="button"
              onClick={reset}
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      <div className="space-y-5">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="mb-1 text-sm font-semibold">Scripted demo cases</h3>
          <p className="mb-3 text-xs text-zinc-500">
            Load a fixture aligned to the demo clock (2026-01-15 20:00).
          </p>
          <div className="space-y-1.5">
            {DEMO_CASES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => loadCase(c)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  activeCase === c.key
                    ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <DecisionBadge label={c.expected} size="sm" />
              </button>
            ))}
          </div>
        </div>

        {phase === "processing" && (
          <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-2 animate-pulse rounded-full bg-sky-500" />
              Embedding request → cuVS search → deterministic scoring…
            </span>
          </div>
        )}

        {phase === "done" && result && <ResultCard decision={result} />}
      </div>
    </div>
  );
}

function ResultCard({ decision }: { decision: TriageDecision }) {
  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <DecisionBadge label={decision.label} />
        <span className="text-xs text-zinc-400">triage result</span>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {decision.summary || DECISION_META[decision.label].blurb}
      </p>
      <ScoreBreakdown scores={decision.scores} />
      {decision.schedule && <ScheduleView candidates={decision.schedule} />}
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          Evidence
        </summary>
        <div className="mt-3">
          <EvidenceList
            records={decision.nearest}
            structuredText={decision.structured_text}
            auditLogId={decision.audit_log_id}
          />
        </div>
      </details>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Deterministic-ish fallback for free-form submissions (mock heuristic). */
function synthDecision(form: typeof EMPTY): TriageDecision {
  const text = `${form.type} ${form.description}`.toLowerCase();
  const highRisk = /pothole|traffic|gas|fire|flood|hazard|injur/.test(text);
  const label = highRisk ? "HUMAN_REVIEW" : "AUTO_SCHEDULE";
  return {
    label,
    summary: highRisk
      ? "Elevated public-safety signal — routed to a human operator. No auto-schedule for high-risk lanes."
      : "Supported low-risk lane with historical analogs — inserted into the ward cleanup queue.",
    scores: {
      duplicate_score: 0.14,
      historical_similarity_score: 0.77,
      category_supported_score: highRisk ? 0.55 : 0.88,
      public_safety_score: highRisk ? 0.89 : 0.21,
      schedule_insertion_score: highRisk ? 0.0 : 0.8,
      confidence_score: highRisk ? 0.72 : 0.86,
    },
    structured_text: `${form.type.toLowerCase()} | ${form.location.toLowerCase()} | ${form.ward.toLowerCase()} | status new`,
    audit_log_id: `audit_${Math.random().toString(36).slice(2, 6)}`,
    nearest: SERVICE_REQUESTS[0].decision.nearest.slice(0, 2),
    schedule: highRisk
      ? undefined
      : [
          {
            label: "Candidate A",
            window: "2026-01-16 09:00 — 11:00",
            status: "accepted",
            reason: "No conflicts; nearest open slot on the ward cleanup route.",
          },
        ],
  };
}
