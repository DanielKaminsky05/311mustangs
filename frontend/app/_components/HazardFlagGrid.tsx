import {
  HAZARD_FLAG_KEYS,
  HARD_ROUTE_FLAG_KEYS,
  type HazardFlags,
} from "../_server/types";
import { AlertOctagon, Circle, MinusCircle, Check } from "lucide-react";

const LABELS: Record<keyof HazardFlags, string> = {
  injury: "Injury",
  active_danger: "Active danger",
  blocking_road: "Blocking road",
  blocking_sidewalk: "Blocking sidewalk",
  flooding: "Flooding",
  sewage_or_water_issue: "Sewage / water issue",
  traffic_signal_issue: "Traffic signal issue",
};

const HARD_ROUTE_SET = new Set<string>(HARD_ROUTE_FLAG_KEYS);

export function HazardFlagGridForm({
  defaults,
  invalid,
}: {
  defaults?: Partial<HazardFlags>;
  invalid?: Set<string>;
}) {
  return (
    <fieldset className="grid grid-cols-1 gap-2">
      <legend className="text-xs uppercase tracking-wide text-ink-faint mb-1">
        Hazard flags · all required (yes / no / unknown)
      </legend>
      {HAZARD_FLAG_KEYS.map((key) => {
        const dflt = defaults?.[key];
        const isHardRoute = HARD_ROUTE_SET.has(key);
        const fieldName = `hazard_${key}`;
        const isInvalid = invalid?.has(`hazard_flags.${key}`);
        return (
          <div
            key={key}
            aria-invalid={isInvalid || undefined}
            className={[
              "flex flex-wrap items-center justify-between gap-3 px-3 py-2 border rounded-sm bg-surface",
              isInvalid ? "border-[color:var(--color-decision-stop)]" : "border-border",
            ].join(" ")}
          >
            <div className="min-w-0">
              <span className="text-sm text-ink">{LABELS[key]}</span>
              {isHardRoute && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-mono uppercase text-[color:var(--color-decision-stop)]">
                  <AlertOctagon size={10} aria-hidden /> hard-route
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs font-mono">
              {(["true", "false", "unknown"] as const).map((opt) => (
                <label
                  key={opt}
                  className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 border border-border rounded-sm bg-surface-alt has-[input:checked]:bg-civic-blue-soft has-[input:checked]:border-civic-blue has-[input:checked]:text-civic-blue-deep"
                >
                  <input
                    type="radio"
                    name={fieldName}
                    value={opt}
                    defaultChecked={
                      opt === "true"
                        ? dflt === true
                        : opt === "false"
                          ? dflt === false
                          : dflt === undefined || dflt === null
                    }
                    className="sr-only"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

export function HazardFlagGridReadonly({
  flags,
  fired,
}: {
  flags: HazardFlags;
  fired: (keyof HazardFlags)[];
}) {
  const firedSet = new Set<string>(fired);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {HAZARD_FLAG_KEYS.map((key) => {
        const v = flags[key];
        const isFired = firedSet.has(key);
        const Icon = v === true ? Check : v === false ? MinusCircle : Circle;
        const cls =
          v === true
            ? isFired
              ? "border-[color:var(--color-decision-stop)] bg-[color:var(--color-decision-stop)]/10 text-[color:var(--color-decision-stop)]"
              : "border-[color:var(--color-decision-warn)]/40 bg-[color:var(--color-decision-warn)]/10 text-[color:var(--color-decision-warn)]"
            : v === false
              ? "border-border bg-surface text-ink-muted"
              : "border-border-strong bg-surface-alt text-ink-faint italic";
        return (
          <li
            key={key}
            className={[
              "inline-flex items-center gap-1 px-2 py-0.5 border rounded-sm text-[11px] font-mono",
              cls,
            ].join(" ")}
          >
            <Icon size={10} aria-hidden />
            <span>{key}</span>
            <span className="text-ink-faint">=</span>
            <span>{v === null ? "unknown" : String(v)}</span>
          </li>
        );
      })}
    </ul>
  );
}
