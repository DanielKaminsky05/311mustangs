"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { submitRequest, type SubmitState } from "../_actions/submitRequest";
import type { DemoCase, SafetyAnswers } from "../_server/types";
import { SafetyAnswersGridForm } from "../_components/HazardFlagGrid";
import { UploadZone } from "../_components/UploadZone";
import { Send, AlertOctagon } from "lucide-react";
import { Button } from "../_components/Button";
import { nowForDatetimeLocalInput } from "../_lib/format";

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

const EMPTY_DEFAULTS = (observed_at: string): FormDefaults => ({
  case_id: "",
  description: "",
  location_raw_text: "",
  intersection_street_1: "",
  intersection_street_2: "",
  postal_code_or_fsa: "",
  ward: "",
  observed_at,
  safety_answers: {},
});

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
  // Initial render must match between server and client — use a stable seed
  // and hydrate the real "now" timestamp in an effect after mount.
  const [defaults, setDefaults] = useState<FormDefaults>(() =>
    EMPTY_DEFAULTS(""),
  );
  useEffect(() => {
    setDefaults((d) =>
      d.case_id || d.observed_at ? d : EMPTY_DEFAULTS(nowForDatetimeLocalInput()),
    );
  }, []);

  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);

  const [state, formAction, pending] = useActionState<SubmitState, FormData>(
    submitRequest,
    {},
  );
  const invalid = useMemo(
    () => new Set(state.NEEDS_MORE_INFO ?? []),
    [state.NEEDS_MORE_INFO],
  );

  // Focus the first invalid field whenever a new NEEDS_MORE_INFO comes back.
  useEffect(() => {
    if (invalid.size === 0 || !formRef.current) return;
    const first = formRef.current.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    first?.focus();
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [invalid]);

  // Warn before navigating away with unsaved input.
  useEffect(() => {
    if (!dirty || pending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, pending]);

  return (
    <form
      ref={formRef}
      // Form key forces full re-mount when a demo case is loaded so all the
      // defaultValue inputs pick up new values without controlled state.
      key={defaults.case_id || "empty"}
      action={formAction}
      onInput={() => setDirty(true)}
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
          className="text-sm border border-border rounded-[3px] px-2 py-1 bg-surface text-ink"
          style={{
            backgroundColor: "var(--color-surface)",
            color: "var(--color-ink)",
          }}
          defaultValue=""
          onChange={(e) => {
            const c = demoCases.find((d) => d.case_id === e.target.value);
            setDefaults(
              c ? demoToDefaults(c) : EMPTY_DEFAULTS(nowForDatetimeLocalInput()),
            );
            setDirty(false);
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
          aria-live="polite"
          className="flex items-start gap-2 px-3 py-2 border border-[color:var(--color-decision-warn)]/40 bg-[color:var(--color-decision-warn)]/10 text-[color:var(--color-decision-warn)] rounded-[3px] text-sm"
        >
          <AlertOctagon size={14} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Please complete the highlighted fields</p>
            <p className="text-xs">
              Missing: {[...invalid].map(humanizeField).join(", ")}.
            </p>
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-ink mb-1"
        >
          What’s the issue?{" "}
          <span className="text-ink-faint font-normal">· required</span>
        </label>
        <p className="text-xs text-ink-muted mb-2">
          In a sentence or two — what did the resident describe?
        </p>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults.description}
          autoComplete="off"
          aria-invalid={invalid.has("description") || undefined}
          aria-describedby={
            invalid.has("description") ? "err-description" : undefined
          }
          className={[
            "w-full border rounded-[3px] px-3 py-2 text-sm bg-surface text-ink",
            invalid.has("description")
              ? "border-[color:var(--color-decision-stop)]"
              : "border-border",
          ].join(" ")}
          placeholder="e.g. There is graffiti on the stop sign at Wychwood and Tyrrel…"
        />
        {invalid.has("description") && (
          <p
            id="err-description"
            className="text-xs text-[color:var(--color-decision-stop)] mt-1"
          >
            Please write at least a few words.
          </p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink mb-1">
          Where did it happen?
        </legend>
        <p className="text-xs text-ink-muted mb-2">
          A nearby intersection, postal area, or ward — anything specific
          enough for a crew to find it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            name="location_raw_text"
            label="What the resident said"
            hint="required · their own wording is fine"
            defaultValue={defaults.location_raw_text}
            invalid={invalid.has("location.raw_text")}
            placeholder="e.g. by the bus stop on Wychwood near Tyrrel…"
            autoComplete="off"
            className="col-span-full"
          />
          <Field
            name="intersection_street_1"
            label="Nearest street"
            defaultValue={defaults.intersection_street_1}
            placeholder="e.g. Wychwood Ave"
            autoComplete="address-line1"
          />
          <Field
            name="intersection_street_2"
            label="Cross street"
            defaultValue={defaults.intersection_street_2}
            placeholder="e.g. Tyrrel Ave"
            autoComplete="address-line2"
          />
          <Field
            name="postal_code_or_fsa"
            label="Postal area (FSA)"
            defaultValue={defaults.postal_code_or_fsa}
            placeholder="e.g. M6G"
            autoComplete="postal-code"
            inputMode="text"
            spellCheck={false}
          />
          <Field
            name="ward"
            label="Ward"
            defaultValue={defaults.ward}
            placeholder="e.g. Toronto-St. Paul’s (12)"
            autoComplete="off"
          />
        </div>
      </fieldset>

      <Field
        name="observed_at"
        label="When did the resident notice it?"
        hint="required"
        type="datetime-local"
        defaultValue={defaults.observed_at}
        invalid={invalid.has("observed_at")}
        autoComplete="off"
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

const FIELD_LABEL: Record<string, string> = {
  description: "Description",
  "location.raw_text": "Location",
  observed_at: "When seen",
  "safety_answers.injury": "Injury",
  "safety_answers.active_danger": "Active danger",
  "safety_answers.blocking_road": "Blocking road",
  "safety_answers.blocking_sidewalk": "Blocking sidewalk",
  "safety_answers.flooding": "Flooding",
  "safety_answers.sewage_or_water_issue": "Sewage / water",
  "safety_answers.traffic_signal_issue": "Traffic signal",
};
function humanizeField(key: string): string {
  return FIELD_LABEL[key] ?? key;
}

function Field({
  name,
  label,
  hint,
  defaultValue,
  invalid,
  type = "text",
  className,
  placeholder,
  autoComplete,
  inputMode,
  spellCheck,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  invalid?: boolean;
  type?: string;
  className?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "search" | "email" | "url";
  spellCheck?: boolean;
}) {
  const id = `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">
        {label}
        {hint && (
          <span className="text-ink-faint font-normal"> · {hint}</span>
        )}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={invalid || undefined}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={spellCheck}
        placeholder={placeholder}
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
