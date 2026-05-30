"use client";

import { useState, useTransition } from "react";
import { Bot, Send, FileSearch } from "lucide-react";
import { askCopilot, type CopilotReply } from "../../_actions/askCopilot";

type Msg =
  | { kind: "user"; text: string }
  | ({ kind: "bot" } & CopilotReply);

const SUGGESTIONS = [
  "Why was this marked POSSIBLE_DUPLICATE?",
  "Why is the urgency score what it is?",
  "How was the category chosen?",
  "Why was this routed where it was?",
];

export function CopilotChatPanel({
  ticket_id,
  availableTopics,
}: {
  ticket_id: string;
  availableTopics: string[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  const ask = (question: string) => {
    if (!question.trim()) return;
    setMessages((m) => [...m, { kind: "user", text: question }]);
    setInput("");
    startTransition(async () => {
      const reply = await askCopilot(ticket_id, question);
      if (reply && reply.audit_refs.length > 0) {
        setMessages((m) => [...m, { kind: "bot", ...reply }]);
      } else {
        setMessages((m) => [
          ...m,
          {
            kind: "bot",
            text: `I can only explain audited decisions for this ticket. Try one of: ${availableTopics.join(", ")}.`,
            audit_refs: [],
          },
        ]);
      }
    });
  };

  return (
    <aside
      aria-label="Operator copilot"
      className="border border-border rounded-[3px] bg-surface flex flex-col h-fit overflow-hidden"
    >
      <header className="flex items-center gap-2 px-3 py-2 bg-civic-blue text-white">
        <Bot size={14} aria-hidden />
        <h2 className="text-sm font-medium tracking-tight">Operator copilot</h2>
        <span className="ml-auto text-[10px] uppercase font-mono text-white/80">
          explains · never decides
        </span>
      </header>

      <div className="flex-1 max-h-[60vh] overflow-y-auto p-3 flex flex-col gap-3 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-ink-muted">
            The copilot reads from the audit trail for this ticket. Pick a
            question or type your own — every answer cites an audit_ref.
          </p>
        )}
        {messages.map((m, i) =>
          m.kind === "user" ? (
            <div
              key={i}
              className="self-end max-w-[85%] bg-civic-blue text-white px-3 py-2 rounded-sm text-sm"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={i}
              className="self-start max-w-[95%] bg-surface-alt border border-border px-3 py-2 rounded-sm"
            >
              <p className="text-sm text-ink whitespace-pre-wrap">{m.text}</p>
              {m.audit_refs.length > 0 && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-muted">
                  <FileSearch size={10} aria-hidden />
                  {m.audit_refs.map((ref) => (
                    <a
                      key={ref}
                      href={`#${ref}`}
                      className="font-mono px-1 py-0.5 border border-border rounded-sm bg-surface hover:bg-civic-blue-soft hover:text-civic-blue-deep"
                    >
                      {ref}
                    </a>
                  ))}
                </p>
              )}
            </div>
          ),
        )}
      </div>

      <div className="border-t border-border p-2 flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            disabled={pending}
            className="text-[11px] px-2 py-1 border border-border rounded-sm bg-surface-alt text-ink-muted hover:bg-civic-blue-soft hover:text-civic-blue-deep disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-border p-2"
      >
        <input
          aria-label="Ask the copilot"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this ticket…"
          className="flex-1 bg-surface border border-border rounded-sm px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="inline-flex items-center gap-1 bg-civic-blue text-white text-xs font-semibold px-3 py-1.5 rounded-sm hover:bg-civic-blue-deep disabled:opacity-60"
        >
          <Send size={12} aria-hidden />
          Ask
        </button>
      </form>
    </aside>
  );
}
