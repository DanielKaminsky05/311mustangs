import {
  SAFETY_KEYS,
  HARD_ROUTE_KEYS,
  type HazardFlags,
  type SafetyAnswers,
} from "../_server/types";
import { AlertOctagon, Check, X, HelpCircle } from "lucide-react";

const LABELS: Record<keyof SafetyAnswers, string> = {
  injury: "Anyone hurt?",
  active_danger: "Active danger to people nearby?",
  blocking_road: "Blocking the road?",
  blocking_sidewalk: "Blocking the sidewalk?",
  flooding: "Flooding?",
  sewage_or_water_issue: "Sewage or water issue?",
  traffic_signal_issue: "Traffic signal problem?",
};

const HARD_ROUTE_SET = new Set<string>(HARD_ROUTE_KEYS);

/**
 * Intake form: collects citizen-stated `safety_answers` as yes / no / not sure.
 * Per whatsapp-api.md §"WhatsApp to backend ticket submission contract", the
 * frontend submits `safety_answers`, not `hazard_flags`. Backend derives flags.
 */
export function SafetyAnswersGridForm({
  defaults,
  invalid,
}: {
  defaults?: Partial<SafetyAnswers>;
  invalid?: Set<string>;
}) {
  return (
    <fieldset className="grid grid-cols-1 gap-2">
      <legend className="text-xs uppercase tracking-wide text-ink-faint mb-1">
        Safety questions · all required
      </legend>
      <p className="text-xs text-ink-muted mb-2">
        Answer based on what the citizen actually said. &quot;Not sure&quot; is
        fine — never guess on a safety question.
      </p>
      {SAFETY_KEYS.map((key) => {
        const dflt = defaults?.[key];
        const isHardRoute = HARD_ROUTE_SET.has(key);
        const fieldName = `safety_${key}`;
        const isInvalid = invalid?.has(`safety_answers.${key}`);
        return (
          <div
            key={key}
            aria-invalid={isInvalid || undefined}
            className={[
              "flex flex-wrap items-center justify-between gap-3 px-3 py-2 border rounded-[3px] bg-surface",
              isInvalid
                ? "border-[color:var(--color-decision-stop)]"
                : "border-border",
            ].join(" ")}
          >
            <div className="min-w-0">
              <span className="text-sm text-ink">{LABELS[key]}</span>
              {isHardRoute && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-mono uppercase text-[color:var(--color-decision-stop)]">
                  <AlertOctagon size={10} aria-hidden /> sends to human review
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs font-medium">
              {(
                [
                  { v: "yes", label: "Yes" },
                  { v: "no", label: "No" },
                  { v: "unknown", label: "Not sure" },
                ] as const
              ).map(({ v, label }) => (
                <label
                  key={v}
                  className="cursor-pointer inline-flex items-center gap-1 px-3 py-1 border border-border rounded-[3px] bg-surface-alt has-[input:checked]:bg-civic-blue-soft has-[input:checked]:border-civic-blue has-[input:checked]:text-civic-blue-deep"
                >
                  <input
                    type="radio"
                    name={fieldName}
                    value={v}
                    defaultChecked={
                      dflt === undefined ? v === "unknown" : dflt === v
                    }
                    className="sr-only"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

/**
 * Read-only view on the triage page. Shows the citizen's own answer (what
 * they said) alongside the backend-derived hazard flag (how the system read
 * it). Highlights any hard-route triggers.
 */
export function SafetyAnswersReadout({
  answers,
  flags,
  fired,
}: {
  answers: SafetyAnswers;
  flags: HazardFlags;
  fired: (keyof SafetyAnswers)[];
}) {
  const firedSet = new Set<string>(fired);
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {SAFETY_KEYS.map((key) => {
        const ans = answers[key];
        const isFired = firedSet.has(key);
        const isHardRoute = HARD_ROUTE_SET.has(key);

        const ansLabel =
          ans === "yes" ? "Yes" : ans === "no" ? "No" : "Not sure";
        const AnsIcon = ans === "yes" ? Check : ans === "no" ? X : HelpCircle;
        const cls = isFired
          ? "border-[color:var(--color-decision-stop)] bg-[color:var(--color-decision-stop)]/10"
          : ans === "yes"
            ? "border-[color:var(--color-decision-warn)]/40 bg-[color:var(--color-decision-warn)]/10"
            : ans === "unknown"
              ? "border-border-strong bg-surface-alt"
              : "border-border bg-surface";

        const flagLabel =
          flags[key] === true
            ? "true"
            : flags[key] === false
              ? "false"
              : "null";

        return (
          <li
            key={key}
            className={["px-3 py-2 border rounded-[3px]", cls].join(" ")}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-ink">{LABELS[key]}</span>
              {isHardRoute && isFired && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-[color:var(--color-decision-stop)]">
                  <AlertOctagon size={10} aria-hidden /> sent to review
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-ink-muted">
                <AnsIcon size={12} aria-hidden /> Citizen said{" "}
                <span className="text-ink font-medium">{ansLabel}</span>
              </span>
              <span className="text-ink-faint font-mono">
                hazard_flags.{key}={flagLabel}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
