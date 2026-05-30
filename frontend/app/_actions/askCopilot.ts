"use server";

import { getCopilotScripts } from "../_server/data";

export type CopilotReply = {
  text: string;
  audit_refs: string[];
  matched_key?: string;
};

const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/\bduplicate\b|dup\b/i, "duplicate"],
  [/\burgenc(y|e)\b|score\b/i, "urgency"],
  [/\bcategor(y|ies)\b|classif/i, "category"],
  [/\bschedule\b|insert|batch/i, "schedule"],
  [/\broute(d)?\b|workflow\b|human review\b/i, "route"],
];

export async function askCopilot(
  ticket_id: string,
  question: string,
): Promise<CopilotReply | null> {
  const scripts = await getCopilotScripts();
  const ticketScripts = scripts[ticket_id];
  if (!ticketScripts) return null;

  for (const [pattern, key] of KEYWORD_MAP) {
    if (pattern.test(question) && ticketScripts[key]) {
      return { ...ticketScripts[key], matched_key: key };
    }
  }
  // Fallback: pick the first available scripted topic so the panel always shows
  // a cited explanation rather than a generic apology.
  const firstKey = Object.keys(ticketScripts)[0];
  if (firstKey) return { ...ticketScripts[firstKey], matched_key: firstKey };
  return null;
}
