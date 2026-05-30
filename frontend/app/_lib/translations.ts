/**
 * Single source of truth for operator-facing plain-English labels.
 *
 * Rule: every enum from the backend gets a plain label here. Components
 * render the label and pass the original enum on `title=` so engineers can
 * still see what the backend said. If you find yourself rendering a raw
 * enum, add the row here instead.
 */

import type {
  CategoryDecision,
  DuplicateDecision,
  Route,
  SafetyAnswers,
  UrgencyDecision,
} from "../_server/types";

export type Translation = {
  label: string;
  /** Tone hint for sub-copy under the chip. */
  hint?: string;
};

export const categoryLabels: Record<CategoryDecision, Translation> = {
  SUGGESTED_CATEGORY: {
    label: "Suggested category",
    hint: "The system is confident about the type of request",
  },
  UNCERTAIN_CATEGORY: {
    label: "Category unclear",
    hint: "Pick the right one before sending",
  },
};

export const duplicateLabels: Record<DuplicateDecision, Translation> = {
  DUPLICATE: {
    label: "Duplicate of an open request",
    hint: "Already being handled — merge or close",
  },
  POSSIBLE_DUPLICATE: {
    label: "Looks like a possible duplicate",
    hint: "Check the open request before sending",
  },
  NOT_DUPLICATE: {
    label: "Not a duplicate",
  },
};

export const urgencyLabels: Record<UrgencyDecision, Translation> = {
  HIGH_URGENCY_HUMAN_REVIEW: {
    label: "High urgency — needs you now",
    hint: "Person, safety, or hazard signal — review immediately",
  },
  MEDIUM_REVIEW_OR_QUEUE: {
    label: "Medium — please review",
    hint: "Worth a look before it gets queued",
  },
  LOW_URGENCY_SCHEDULING: {
    label: "Low urgency — can be scheduled",
    hint: "Safe to batch with similar work",
  },
};

export const routeLabels: Record<Route, Translation> = {
  SCHEDULING_AGENT: {
    label: "Route: auto-scheduling",
    hint: "Batched with similar operations",
  },
  HUMAN_WORKFLOW: {
    label: "Route: human review",
    hint: "An operator needs to handle this",
  },
  DUPLICATE_WORKFLOW: {
    label: "Route: duplicate merge",
    hint: "Will be merged onto the original request",
  },
};

export const hardRouteLabels: Record<keyof SafetyAnswers, string> = {
  injury: "Injury reported",
  active_danger: "Active danger to people nearby",
  blocking_road: "Blocking the road",
  blocking_sidewalk: "Blocking the sidewalk",
  flooding: "Flooding",
  sewage_or_water_issue: "Sewage / water issue",
  traffic_signal_issue: "Traffic signal problem",
};

/**
 * Operator-friendly column labels for the dashboard / approvals / schedule
 * data tables. Keys mirror the existing DataTable `key` props.
 */
export const columnLabels: Record<string, string> = {
  ticket_id: "Request",
  reported_at: "Reported",
  observed_at: "When seen",
  description: "Issue",
  category: "Category",
  duplicate: "Duplicate?",
  urgency: "Urgency",
  route: "Next step",
  status: "Status",
  scheduled_for: "Scheduled for",
  proposed_slot: "Suggested slot",
  batches_with: "Batches with",
  explanation: "Why",
  rank: "Priority",
  firing_reason: "Why flagged",
  operation_id: "Operation",
  ward: "Ward",
  intersection: "Intersection",
};

/** Translate a similarity / confidence number into a verbal band. */
export function describeStrength(score: number): {
  band: "Strong" | "Moderate" | "Weak";
  className: string;
} {
  if (score >= 0.75)
    return { band: "Strong", className: "text-[color:var(--color-decision-ok)]" };
  if (score >= 0.5)
    return {
      band: "Moderate",
      className: "text-[color:var(--color-decision-warn)]",
    };
  return { band: "Weak", className: "text-ink-muted" };
}

/**
 * Translate a fixture-style firing reason like
 *   "HARD-ROUTE: traffic_signal_issue, active_danger"
 *   "blocking_road=true; urgency_decision=MEDIUM_REVIEW_OR_QUEUE"
 *   "category_confidence=0.41 below threshold; UNCERTAIN_CATEGORY"
 * into a single plain-English sentence.
 */
export function translateFiringReason(raw: string): string {
  // Hard-route lists like "HARD-ROUTE: traffic_signal_issue, active_danger"
  if (raw.startsWith("HARD-ROUTE:")) {
    const flags = raw
      .replace(/^HARD-ROUTE:\s*/, "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((k) => hardRouteLabels[k as keyof SafetyAnswers] ?? k);
    return `Flagged because: ${flags.join(", ")}.`;
  }
  // Common explicit reasons
  if (/blocking_road=true/.test(raw)) {
    return "Citizen said it is blocking the road — needs operator review.";
  }
  if (/category_confidence/.test(raw)) {
    return "The system isn't sure which category fits — pick one before sending.";
  }
  if (/flooding/.test(raw) || /sewage/.test(raw)) {
    return "Flooding or sewage reported — urgent crew dispatch needed.";
  }
  // Fall through: at least de-snake_case it.
  return raw
    .replace(/_/g, " ")
    .replace(/=/g, " is ")
    .replace(/;/g, "; ")
    .replace(/\b(yes|no|true|false)\b/gi, (m) => m.toLowerCase());
}
