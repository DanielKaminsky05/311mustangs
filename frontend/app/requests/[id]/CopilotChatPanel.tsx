"use client";

import { useState, useTransition } from "react";
import { Bot, Send, FileSearch } from "lucide-react";
import { askCopilot, type CopilotReply } from "../../_actions/askCopilot";

type Msg =
  | { kind: "user"; text: string }
  | ({ kind: "bot" } & CopilotReply);

const SUGGESTIONS = [
  "Why does this look like a possible duplicate?",
  "Why is the urgency the way it is?",
  "How was the category chosen?",
  "Why is this being sent where it is?",
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
            text: `I can only explain what the system did for this request. Try asking about: ${availableTopics.join(", ")}.`,
            audit_refs: [],
          },
        ]);
      }
    });
  };

  return (
    <aside
      aria-label="Ask about this request"
      className="border border-border rounded-[3px] bg-surface flex flex-col h-fit overflow-hidden"
    >
      <header className="flex items-center gap-2 px-3 py-2 bg-civic-blue text-white">
        <Bot size={14} aria-hidden />
        <h2 className="text-sm font-medium tracking-tight">Ask about this request</h2>
      </header>

      <div className="flex-1 max-h-[60vh] overflow-y-auto p-3 flex flex-col gap-3 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-ink-muted">
            Type a question, or pick one below. Every answer cites the step
            the system actually did, so you can verify it.
          </p>
        )}
        {messages.map((m, i) =>
          m.kind === "user" ? (
            <div
              key={i}
              className="self-end max-w-[85%] bg-civic-blue text-white px-3 py-2 rounded-[3px] text-sm"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={i}
              className="self-start max-w-[95%] bg-surface-alt border border-border px-3 py-2 rounded-[3px]"
            >
              <p className="text-sm text-ink whitespace-pre-wrap">{m.text}</p>
              {m.audit_refs.length > 0 && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-muted">
                  <FileSearch size={10} aria-hidden />
                  <span className="text-ink-faint">Citation:</span>
                  {m.audit_refs.map((ref) => (
                    <a
                      key={ref}
                      href={`#${ref}`}
                      className="font-mono px-1 py-0.5 border border-border rounded-[3px] bg-surface hover:bg-civic-blue-soft hover:text-civic-blue-deep no-underline"
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
            className="text-[11px] px-2 py-1 border border-border rounded-[3px] bg-surface-alt text-ink-muted hover:bg-civic-blue-soft hover:text-civic-blue-deep disabled:opacity-50"
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
          aria-label="Ask a question about this request"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this request…"
          className="flex-1 bg-surface border border-border rounded-[3px] px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="inline-flex items-center gap-1 bg-civic-blue text-white text-xs font-medium px-3 py-1.5 rounded-[3px] hover:bg-civic-blue-deep disabled:opacity-60"
        >
          <Send size={12} aria-hidden />
          Ask
        </button>
      </form>
    </aside>
  );
}
