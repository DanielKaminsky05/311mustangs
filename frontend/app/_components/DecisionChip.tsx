import type {
  CategoryDecision,
  DuplicateDecision,
  Route,
  UrgencyDecision,
} from "../_server/types";
import { Check, AlertTriangle, AlertOctagon, Workflow, MinusCircle } from "lucide-react";

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

function kindFor(
  signal: string,
  value: string,
): Kind {
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

export function DecisionChip({
  signal,
  value,
  size = "md",
}: {
  signal: "category" | "duplicate" | "urgency" | "route";
  value: CategoryDecision | DuplicateDecision | UrgencyDecision | Route;
  size?: "sm" | "md";
}) {
  if (signal === "route") {
    return (
      <span
        className={[
          "inline-flex items-center gap-1.5 border rounded-sm",
          KIND_CLASS.neutral,
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        ].join(" ")}
      >
        <Workflow size={size === "sm" ? 10 : 12} aria-hidden />
        <span className="font-mono uppercase tracking-wide">{value}</span>
      </span>
    );
  }
  const kind = kindFor(signal, value);
  const Icon = ICON[kind];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 border rounded-sm font-mono uppercase tracking-wide",
        KIND_CLASS[kind],
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
      ].join(" ")}
    >
      <Icon size={size === "sm" ? 10 : 12} aria-hidden />
      <span>{value}</span>
    </span>
  );
}

export function HardRouteBadge({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-[color:var(--color-decision-stop)]/40 bg-[color:var(--color-decision-stop)]/10 text-[color:var(--color-decision-stop)] text-[11px] font-mono uppercase tracking-wide rounded-sm">
      <AlertOctagon size={12} aria-hidden />
      <span>HARD-ROUTE: {flags.join(", ")}</span>
    </span>
  );
}
