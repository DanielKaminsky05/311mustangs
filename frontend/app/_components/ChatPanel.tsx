"use client";

import { useState } from "react";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

// Canned, evidence-grounded answers (the real copilot answers over audit logs +
// DGX retrieval via the local LLM — it explains decisions, never invents scores).
const SUGGESTED: { q: string; a: string }[] = [
  {
    q: "Why was SR-2026-004417 marked duplicate?",
    a: "It scored duplicate_score 0.97 against active request SR-2026-004411 — same category (Graffiti - Street Sign) and location tokens (Wychwood Ave / Tyrrel Ave). That request is already In Progress and scheduled, so no new operation was created (audit_b2d0).",
  },
  {
    q: "Why was the first schedule insertion rejected?",
    a: "Candidate A (2026-01-15 14:00) was BLOCKED_BY_UTILITY_CUT — permit 1021444006 is active on Wychwood Ave through 2026-01-15. Candidate B (2026-01-16 10:00) was accepted because the utility-cut window had ended (audit_a1c9).",
  },
  {
    q: "What evidence requires human approval?",
    a: "Two items are gated: SR-2026-004420 (noise) because the noise permit lookup lane is deferred for the MVP and confidence is 0.49; and SR-2026-004388 (pothole) because public_safety_score is 0.92 — high-risk roadway hazards never auto-schedule.",
  },
  {
    q: "Which permit resolved the noise complaint?",
    a: "None yet — noise auto-resolution is DEFERRED until the MVP permit-evidence path is wired. SR-2026-004420 was routed to HUMAN_REVIEW rather than AUTO_RESOLVE for that reason.",
  },
];

export function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "I answer over audit logs and DGX retrieval results. Ask why a decision was made — I won't invent scores or constraints.",
    },
  ]);
  const [input, setInput] = useState("");

  function ask(question: string) {
    const match = SUGGESTED.find((s) => s.q === question);
    const answer =
      match?.a ??
      "I can only ground answers in persisted evidence. The closest audited decisions involve the Wychwood graffiti schedule, the SR-2026-004417 duplicate, and the two human-review items. Ask about one of those and I'll cite the audit log.";
    setMessages((m) => [
      ...m,
      { role: "user", text: question },
      { role: "assistant", text: answer },
    ]);
    setInput("");
  }

  return (
    <div className="flex h-[32rem] flex-col rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button
              key={s.q}
              onClick={() => ask(s.q)}
              className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {s.q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) ask(input.trim());
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask why a decision was made…"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
