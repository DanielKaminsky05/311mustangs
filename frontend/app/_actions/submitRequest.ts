"use server";

import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { bindSessionToRequest } from "../_server/uploads";
import { HAZARD_FLAG_KEYS, type HazardFlags } from "../_server/types";

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
  hazards: HazardFlags,
): string {
  const d = description.toLowerCase();
  if (hazards.traffic_signal_issue === true || hazards.active_danger === true)
    return "tkt-003";
  if (hazards.flooding === true || hazards.sewage_or_water_issue === true)
    return "tkt-004";
  if (hazards.blocking_road === true) return "tkt-002";
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

  const hazards = {} as HazardFlags;
  for (const key of HAZARD_FLAG_KEYS) {
    const raw = formData.get(`hazard_${key}`);
    if (raw === "true") (hazards as Record<string, unknown>)[key] = true;
    else if (raw === "false") (hazards as Record<string, unknown>)[key] = false;
    else if (raw === "unknown" || raw === null)
      (hazards as Record<string, unknown>)[key] = null;
    else missing.push(`hazard_flags.${key}`);
    if (raw === null) missing.push(`hazard_flags.${key}`);
  }

  if (missing.length > 0) {
    return { NEEDS_MORE_INFO: missing };
  }

  const target =
    CASE_TO_TICKET[case_id] ?? inferTargetTicket(description, hazards);

  // Bind any session-scoped uploads to the target ticket
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
