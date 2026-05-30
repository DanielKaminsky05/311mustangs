import type {
  CategoryDecision,
  DuplicateDecision,
  Route,
  UrgencyDecision,
} from "../_server/types";
import {
  Check,
  AlertTriangle,
  AlertOctagon,
  Workflow,
  MinusCircle,
} from "lucide-react";
import {
  categoryLabels,
  duplicateLabels,
  hardRouteLabels,
  routeLabels,
  urgencyLabels,
} from "../_lib/translations";

type Kind = "ok" | "warn" | "stop" | "neutral";

const KIND_CLASS: Record<Kind, string> = {
  ok: "bg-[color:var(--color-decision-ok)]/10 text-[color:var(--color-decision-ok)] border-[color:var(--color-decision-ok)]/30",
  warn: "bg-[color:var(--color-decision-warn)]/10 text-[color:var(--color-decision-warn)] border-[color:var(--color-decision-warn)]/30",
  stop: "bg-[color:var(--color-decision-stop)]/10 text-[color:var(--color-decision-stop)] border-[color:var(--color-decision-stop)]/30",
  neutral:
    "bg-surface-alt text-[color:var(--color-decision-neutral)] border-border-strong",
};

const ICON: Record<Kind, React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  ok: Check,
  warn: AlertTriangle,
  stop: AlertOctagon,
  neutral: MinusCircle,
};

function kindFor(signal: string, value: string): Kind {
  if (signal === "category") {
    return value === "SUGGESTED_CATEGORY" ? "ok" : "warn";
  }
  if (signal === "duplicate") {
    return value === "DUPLICATE"
      ? "stop"
      : value === "POSSIBLE_DUPLICATE"
        ? "warn"
        : "neutral";
  }
  if (signal === "urgency") {
    return value === "HIGH_URGENCY_HUMAN_REVIEW"
      ? "stop"
      : value === "MEDIUM_REVIEW_OR_QUEUE"
        ? "warn"
        : "ok";
  }
  return "neutral";
}

function labelFor(
  signal: "category" | "duplicate" | "urgency" | "route",
  value: CategoryDecision | DuplicateDecision | UrgencyDecision | Route,
): string {
  if (signal === "category")
    return categoryLabels[value as CategoryDecision].label;
  if (signal === "duplicate")
    return duplicateLabels[value as DuplicateDecision].label;
  if (signal === "urgency")
    return urgencyLabels[value as UrgencyDecision].label;
  return routeLabels[value as Route].label;
}

export function DecisionChip({
  signal,
  value,
  size = "md",
}: {
  signal: "category" | "duplicate" | "urgency" | "route";
  value: CategoryDecision | DuplicateDecision | UrgencyDecision | Route;
  size?: "sm" | "md";
}) {
  const label = labelFor(signal, value);
  if (signal === "route") {
    return (
      <span
        title={`route=${value}`}
        className={[
          "inline-flex items-center gap-1.5 border rounded-[3px]",
          KIND_CLASS.neutral,
          size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        ].join(" ")}
      >
        <Workflow size={size === "sm" ? 12 : 14} aria-hidden />
        <span>{label}</span>
      </span>
    );
  }
  const kind = kindFor(signal, value);
  const Icon = ICON[kind];
  return (
    <span
      title={`${signal}_decision=${value}`}
      className={[
        "inline-flex items-center gap-1.5 border rounded-[3px]",
        KIND_CLASS[kind],
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      ].join(" ")}
    >
      <Icon size={size === "sm" ? 12 : 14} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

export function HardRouteBadge({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;
  const labels = flags.map(
    (k) => hardRouteLabels[k as keyof typeof hardRouteLabels] ?? k,
  );
  return (
    <span
      title={`hard_routes_triggered: ${flags.join(", ")}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-[color:var(--color-decision-stop)]/40 bg-[color:var(--color-decision-stop)]/10 text-[color:var(--color-decision-stop)] text-xs rounded-[3px]"
    >
      <AlertOctagon size={12} aria-hidden />
      <span>Sent to human review · {labels.join(", ")}</span>
    </span>
  );
}
