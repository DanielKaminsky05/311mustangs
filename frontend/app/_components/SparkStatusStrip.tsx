import { SPARK_METRICS } from "@/app/lib/mock-data";

/**
 * NVIDIA / DGX Spark judging-proof strip (docs/planning/frontend.md §8).
 * Renders the metrics that would come from data_pipeline_runs.metrics_json.
 */
export function SparkStatusStrip() {
  const m = SPARK_METRICS;
  const items: { label: string; value: string }[] = [
    { label: "RAPIDS", value: m.rapids_version },
    { label: "Embeddings", value: `${m.embedding_backend} · ${m.embedding_model}` },
    { label: "Vector search", value: m.vector_backend },
    { label: "Agent LLM", value: m.llm_backend },
    { label: "Indexed 311", value: m.records_indexed.toLocaleString("en-CA") },
    { label: "Open-data rows", value: m.open_data_rows.toLocaleString("en-CA") },
  ];

  return (
    <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
          <span
            className={`inline-block size-2 rounded-full ${
              m.gpu_enabled ? "bg-emerald-500" : "bg-rose-500"
            } animate-pulse`}
          />
          gpu_enabled={String(m.gpu_enabled)}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">{m.device_name}</span>
        {items.map((it) => (
          <span key={it.label} className="text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-400 dark:text-zinc-600">{it.label}:</span>{" "}
            <span className="font-mono text-zinc-700 dark:text-zinc-300">
              {it.value}
            </span>
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {m.external_api_used ? "external API in use" : "no external API · all local"}
        </span>
      </div>
    </div>
  );
}
