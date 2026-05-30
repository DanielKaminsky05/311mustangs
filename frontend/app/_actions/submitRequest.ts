"use server";

import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { bindSessionToRequest } from "../_server/uploads";
import {
  SAFETY_KEYS,
  type SafetyAnswer,
  type SafetyAnswers,
} from "../_server/types";

const SESSION_COOKIE = "311_session";

/**
 * Demo-case → target evidence-pack mapping. Picking a demo case in the form
 * sets a hidden case_id; submitRequest routes to the corresponding ticket so
 * the evidence pack is coherent without needing a live backend.
 */
const CASE_TO_TICKET: Record<string, string> = {
  "demo-graffiti-possible-dup": "tkt-001",
  "demo-traffic-signal-hard-route": "tkt-003",
  "demo-pothole-blocking": "tkt-002",
  "demo-vague-uncertain": "tkt-006",
};

/** Fallback fuzzy match for free-form submissions without a demo case picked. */
function inferTargetTicket(
  description: string,
  answers: SafetyAnswers,
): string {
  const d = description.toLowerCase();
  if (answers.traffic_signal_issue === "yes" || answers.active_danger === "yes")
    return "tkt-003";
  if (answers.flooding === "yes" || answers.sewage_or_water_issue === "yes")
    return "tkt-004";
  if (answers.blocking_road === "yes") return "tkt-002";
  if (d.includes("graffiti")) return "tkt-001";
  if (d.includes("pothole") || d.includes("road damage")) return "tkt-002";
  if (d.includes("flood") || d.includes("sewage")) return "tkt-004";
  if (d.includes("traffic light") || d.includes("signal")) return "tkt-003";
  return "tkt-006"; // vague / uncertain category fallback
}

export type SubmitErrors = {
  NEEDS_MORE_INFO?: string[];
  message?: string;
};

export type SubmitState = SubmitErrors & { ok?: boolean };

function isSafetyAnswer(v: unknown): v is SafetyAnswer {
  return v === "yes" || v === "no" || v === "unknown";
}

export async function submitRequest(
  _prevState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const description = String(formData.get("description") ?? "").trim();
  const raw_text = String(formData.get("location_raw_text") ?? "").trim();
  const observed_at = String(formData.get("observed_at") ?? "").trim();
  const case_id = String(formData.get("case_id") ?? "");

  const missing: string[] = [];
  if (description.length < 3) missing.push("description");
  if (raw_text.length < 3) missing.push("location.raw_text");
  if (!observed_at) missing.push("observed_at");

  const answers = {} as SafetyAnswers;
  for (const key of SAFETY_KEYS) {
    const raw = formData.get(`safety_${key}`);
    if (isSafetyAnswer(raw)) {
      (answers as Record<string, SafetyAnswer>)[key] = raw;
    } else {
      missing.push(`safety_answers.${key}`);
    }
  }

  if (missing.length > 0) {
    return { NEEDS_MORE_INFO: missing };
  }

  const target =
    CASE_TO_TICKET[case_id] ?? inferTargetTicket(description, answers);

  const cookieStore = await cookies();
  const session_id = cookieStore.get(SESSION_COOKIE)?.value;
  if (session_id) {
    try {
      await bindSessionToRequest(session_id, target);
    } catch {
      /* best-effort: file moves may race in dev */
    }
    cookieStore.delete(SESSION_COOKIE);
  }

  updateTag("fixtures");
  redirect(`/requests/${target}`);
}
