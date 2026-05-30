import { Cpu, Database, Zap, ShieldCheck, Clock, Bot } from "lucide-react";
import { getPipelineMetrics } from "../_server/data";

function Pill({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <li
      aria-label={ariaLabel}
      className="flex items-center gap-2 px-3 py-2 border-r border-border last:border-r-0"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent-spark)] shadow-[0_0_6px_var(--color-accent-spark)]"
      />
      {children}
    </li>
  );
}

export async function StatusStrip() {
  const m = await getPipelineMetrics();
  const indexed = m.records_indexed.toLocaleString("en-CA");
  const active = m.active_records.toLocaleString("en-CA");
  return (
    <div className="shrink-0 bg-surface border-b border-border">
      <ul
        aria-label="DGX Spark pipeline status"
        className="mx-auto w-full max-w-screen-2xl flex flex-wrap text-[12px] font-mono text-ink-muted"
      >
        <Pill ariaLabel="GPU">
          <Cpu size={14} className="text-ink-faint" aria-hidden />
          <span>
            <span className="text-ink">gpu_enabled</span>=
            <span className="text-decision-ok">true</span> · {m.device}
          </span>
        </Pill>
        <Pill ariaLabel="RAPIDS">
          <Database size={14} className="text-ink-faint" aria-hidden />
          <span>RAPIDS cuDF {m.rapids_cudf_version}</span>
        </Pill>
        <Pill ariaLabel="Embedding model">
          <Zap size={14} className="text-ink-faint" aria-hidden />
          <span>
            Embed: {m.embedding_backend} · {m.embedding_model}
          </span>
        </Pill>
        <Pill ariaLabel="LLM runtime">
          <Bot size={14} className="text-ink-faint" aria-hidden />
          <span>
            LLM: {m.llm_runtime} · {m.llm_intake_model} ·{" "}
            {m.llm_reasoning_model}
          </span>
        </Pill>
        <Pill ariaLabel="Vector backend">
          <Database size={14} className="text-ink-faint" aria-hidden />
          <span>
            Index: {m.vector_backend} · 311 records: {indexed} · active:{" "}
            {active}
          </span>
        </Pill>
        <Pill ariaLabel="Local-only inference">
          <ShieldCheck size={14} className="text-ink-faint" aria-hidden />
          <span>
            {m.no_external_api_in_triage_path
              ? "No external API in triage path"
              : "External APIs in triage path"}
          </span>
        </Pill>
        <Pill ariaLabel="Indexed at">
          <Clock size={14} className="text-ink-faint" aria-hidden />
          <span>indexed_at {m.indexed_at}</span>
        </Pill>
      </ul>
    </div>
  );
}

export function StatusStripSkeleton() {
  return (
    <div className="shrink-0 bg-surface border-b border-border">
      <div className="mx-auto w-full max-w-screen-2xl h-10 px-3 flex items-center text-[12px] font-mono text-ink-faint">
        loading DGX Spark metrics…
      </div>
    </div>
  );
}
