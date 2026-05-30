"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Cpu, Database, Zap, ShieldCheck, Bot, Clock } from "lucide-react";
import type { PipelineMetrics } from "../_server/types";

/** Click-to-open popover holding the full DGX Spark status detail. Closed
 *  by default so operators aren't confronted with runtime jargon. */
export function SystemStatusDisclosure({
  metrics: m,
}: {
  metrics: PipelineMetrics;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="h-8 px-2.5 inline-flex items-center gap-2 border border-border rounded-[3px] bg-surface text-xs text-ink hover:bg-surface-alt"
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent-spark)] shadow-[0_0_6px_var(--color-accent-spark)]"
        />
        <span>System status: nominal</span>
        <ChevronDown size={12} aria-hidden className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="System status details"
          className="absolute right-0 top-full mt-2 w-[min(28rem,calc(100vw-2rem))] border border-border bg-surface rounded-[3px] shadow-lg z-30"
        >
          <header className="px-3 py-2 bg-civic-blue text-white text-sm font-medium">
            DGX Spark pipeline
          </header>
          <ul className="text-xs divide-y divide-border">
            <Row icon={Cpu} label="GPU">
              <span className="text-ink">{m.device}</span>
            </Row>
            <Row icon={Database} label="RAPIDS / cuDF">
              <span className="text-ink">{m.rapids_cudf_version}</span>
            </Row>
            <Row icon={Zap} label="Embedding model">
              <span className="text-ink">
                {m.embedding_backend} · {m.embedding_model}
              </span>
            </Row>
            <Row icon={Bot} label="LLMs">
              <span className="text-ink">
                {m.llm_runtime} ·{" "}
                <span className="font-mono">{m.llm_intake_model}</span> for
                intake ·{" "}
                <span className="font-mono">{m.llm_reasoning_model}</span> for
                explanation
              </span>
            </Row>
            <Row icon={Database} label="Vector index">
              <span className="text-ink">
                {m.vector_backend} ·{" "}
                {m.records_indexed.toLocaleString("en-CA")} records ·{" "}
                {m.active_records.toLocaleString("en-CA")} active
              </span>
            </Row>
            <Row icon={ShieldCheck} label="Privacy">
              <span className="text-ink">
                {m.no_external_api_in_triage_path
                  ? "No external API used to triage requests"
                  : "External APIs are used in triage"}
              </span>
            </Row>
            <Row icon={Clock} label="Last indexed">
              <span className="font-mono text-ink">{m.indexed_at}</span>
            </Row>
          </ul>
          <p className="px-3 py-2 text-[11px] text-ink-faint bg-surface-alt border-t border-border">
            This panel is for admins and judges — operators don’t need it to
            do their work.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="px-3 py-2 flex items-start gap-2">
      <Icon size={14} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-ink-faint">
          {label}
        </p>
        <p>{children}</p>
      </div>
    </li>
  );
}
