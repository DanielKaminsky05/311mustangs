"use client";

import { useActionState, useMemo, useState } from "react";
import { submitRequest, type SubmitState } from "../_actions/submitRequest";
import type { DemoCase, SafetyAnswers } from "../_server/types";
import { SafetyAnswersGridForm } from "../_components/HazardFlagGrid";
import { UploadZone } from "../_components/UploadZone";
import { Send, AlertOctagon } from "lucide-react";
import { Button } from "../_components/Button";

type FormDefaults = {
  case_id: string;
  description: string;
  location_raw_text: string;
  intersection_street_1: string;
  intersection_street_2: string;
  postal_code_or_fsa: string;
  ward: string;
  observed_at: string;
  safety_answers: Partial<SafetyAnswers>;
};

const DEFAULT_CLOCK = "2026-01-15T20:00";

const EMPTY: FormDefaults = {
  case_id: "",
  description: "",
  location_raw_text: "",
  intersection_street_1: "",
  intersection_street_2: "",
  postal_code_or_fsa: "",
  ward: "",
  observed_at: DEFAULT_CLOCK,
  safety_answers: {},
};

function demoToDefaults(c: DemoCase): FormDefaults {
  return {
    case_id: c.case_id,
    description: c.intake_payload.description,
    location_raw_text: c.intake_payload.location.raw_text,
    intersection_street_1:
      c.intake_payload.location.intersection_street_1 ?? "",
    intersection_street_2:
      c.intake_payload.location.intersection_street_2 ?? "",
    postal_code_or_fsa: c.intake_payload.location.postal_code_or_fsa ?? "",
    ward: c.intake_payload.location.ward ?? "",
    observed_at: c.intake_payload.observed_at.slice(0, 16),
    safety_answers: c.intake_payload.safety_answers,
  };
}

export function SubmitForm({ demoCases }: { demoCases: DemoCase[] }) {
  const [defaults, setDefaults] = useState<FormDefaults>(EMPTY);
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(
    submitRequest,
    {},
  );
  const invalid = useMemo(
    () => new Set(state.NEEDS_MORE_INFO ?? []),
    [state.NEEDS_MORE_INFO],
  );

  return (
    <form
      // Form key forces full re-mount when a demo case is loaded so all the
      // defaultValue inputs pick up new values without controlled state.
      key={defaults.case_id || "empty"}
      action={formAction}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="case_id" defaultValue={defaults.case_id} />

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="demo-case"
          className="text-xs uppercase tracking-wide text-ink-faint"
        >
          Demo case
        </label>
        <select
          id="demo-case"
          className="text-sm border border-border rounded-[3px] px-2 py-1 bg-surface"
          defaultValue=""
          onChange={(e) => {
            const c = demoCases.find((d) => d.case_id === e.target.value);
            setDefaults(c ? demoToDefaults(c) : EMPTY);
          }}
        >
          <option value="">— pick a scripted case —</option>
          {demoCases.map((c) => (
            <option key={c.case_id} value={c.case_id}>
              {c.title}
            </option>
          ))}
        </select>
        {defaults.case_id && (
          <span className="text-[11px] font-mono text-ink-muted truncate">
            {demoCases.find((c) => c.case_id === defaults.case_id)?.blurb}
          </span>
        )}
      </div>

      {invalid.size > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 px-3 py-2 border border-[color:var(--color-decision-warn)]/40 bg-[color:var(--color-decision-warn)]/10 text-[color:var(--color-decision-warn)] rounded-[3px] text-sm"
        >
          <AlertOctagon size={14} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Please complete the highlighted fields</p>
            <p className="font-mono text-xs">missing: {[...invalid].join(", ")}</p>
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="description"
          className="block text-xs uppercase tracking-wide text-ink-faint mb-1"
        >
          Description · required
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults.description}
          aria-invalid={invalid.has("description") || undefined}
          aria-describedby={invalid.has("description") ? "err-description" : undefined}
          className={[
            "w-full border rounded-[3px] px-3 py-2 text-sm bg-surface text-ink",
            invalid.has("description")
              ? "border-[color:var(--color-decision-stop)]"
              : "border-border",
          ].join(" ")}
          placeholder="What is the issue? What did the citizen describe?"
        />
        {invalid.has("description") && (
          <p id="err-description" className="text-xs text-[color:var(--color-decision-stop)] mt-1">
            Required — minimum 3 characters.
          </p>
        )}
      </div>

      <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <legend className="text-xs uppercase tracking-wide text-ink-faint mb-1 col-span-full">
          Location
        </legend>
        <Field
          name="location_raw_text"
          label="raw_text · required"
          defaultValue={defaults.location_raw_text}
          invalid={invalid.has("location.raw_text")}
          className="col-span-full"
        />
        <Field
          name="intersection_street_1"
          label="intersection_street_1"
          defaultValue={defaults.intersection_street_1}
        />
        <Field
          name="intersection_street_2"
          label="intersection_street_2"
          defaultValue={defaults.intersection_street_2}
        />
        <Field
          name="postal_code_or_fsa"
          label="postal_code_or_fsa"
          defaultValue={defaults.postal_code_or_fsa}
        />
        <Field name="ward" label="ward" defaultValue={defaults.ward} />
      </fieldset>

      <Field
        name="observed_at"
        label="observed_at · required"
        type="datetime-local"
        defaultValue={defaults.observed_at}
        invalid={invalid.has("observed_at")}
      />

      <SafetyAnswersGridForm
        defaults={defaults.safety_answers}
        invalid={invalid}
      />

      <div>
        <label className="block text-xs uppercase tracking-wide text-ink-faint mb-1">
          Attachments
        </label>
        <UploadZone />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" variant="amber" disabled={pending}>
          <Send size={14} aria-hidden />
          {pending ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  invalid,
  type = "text",
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  invalid?: boolean;
  type?: string;
  className?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-xs uppercase tracking-wide text-ink-faint mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={invalid || undefined}
        className={[
          "w-full border rounded-[3px] px-3 py-2 text-sm bg-surface text-ink",
          invalid
            ? "border-[color:var(--color-decision-stop)]"
            : "border-border",
        ].join(" ")}
      />
    </div>
  );
}
