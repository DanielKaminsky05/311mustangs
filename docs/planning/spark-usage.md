# DGX Spark / NVIDIA Stack Usage Plan

This document defines how the MVP should use DGX Spark in a way that directly matches the judging criteria in [`criteria.md`](./criteria.md), especially **NVIDIA Ecosystem & Spark Utility**.

For dataset scope, normalized outputs, and demo data contracts, read [`data.md`](./data.md).

## Brutally honest positioning

The DGX Spark should not be pitched as "we ran a chatbot on a GPU." That is too generic.

The winning story should be:

```text
DGX Spark is the local AI/data engine that turns raw Toronto Open Data into a resident retrieval and reasoning substrate:
RAPIDS/cuDF cleans and profiles the datasets, NVIDIA-backed embeddings index the 311 corpus, GPU vector search grounds each request in historical analogs, and a local LLM explains audited tool outputs without external APIs.
```

## NVIDIA-aligned MVP stack

Use this stack order for the judging build.

| Layer | Required / preferred choice | Why it helps the criteria |
|---|---|---|
| Dataframe pipeline | **RAPIDS/cuDF required for judging run** | Directly satisfies a major NVIDIA library/tool requirement and makes raw-data processing part of the Spark story. |
| Embedding inference | **NVIDIA NIM or NeMo embedding model preferred**; CUDA embedding fallback acceptable for development only | Makes embedding inference a real NVIDIA AI workload, not just generic Python. |
| Vector search | **cuVS preferred** or **FAISS-GPU acceptable** | Shows GPU retrieval over the 311 corpus and supports the privacy/latency story. |
| Agent LLM inference | **NIM / TensorRT-LLM / NeMo-family local model preferred** | Useful if the agent is tool-grounded and explains audited evidence. Weak if it is just chat. |
| Scheduling optimization | **cuOpt stretch only** | Strongest extra Spark utility if it works quickly; otherwise keep deterministic ranked insertion on the backend. |

## Core decisions

1. Use a **hybrid DGX Spark plan**:
   - **Pre-demo Spark pipeline** builds SQLite-ready records, embeddings, vector index, seeded operations, and data-quality/audit artifacts.
   - **Live demo Spark runtime** embeds each new request and searches the resident 311 index.
2. Make **RAPIDS/cuDF + GPU embedding/search** the minimum credible NVIDIA path.
3. Use the local agent LLM only after deterministic backend tools return evidence. The LLM explains and orchestrates; it does not rank priority or invent constraints.
4. Treat live chat as an operator copilot, not the main DGX story.
5. Do **not** silently fall back to CPU for the submitted judging run. Development fallback is acceptable only if logs expose `gpu_enabled=false`; the judging run should use `--require-gpu`.

## What each DGX use case is worth

| DGX use case | Use it? | Judging value |
|---|---:|---|
| **1. Embedding inference + vector search** | Yes, centerpiece | Strong. Tied to raw city data, privacy, latency, duplicate detection, and historical grounding. |
| **2. Agent LLM inference** | Yes, but tool-grounded | Medium-to-strong if local and NVIDIA-backed. The agent must call audited tools and explain their outputs. |
| **3. Live chat with same model / separate KV cache** | Only as supporting UX | Weak alone. A separate KV cache is an implementation detail, not a winning Spark story. Pitch it as resident local operator sessions over audited evidence. |

## Minimum credible Spark story

```text
DGX Spark locally processes Toronto Open Data with RAPIDS/cuDF, embeds and indexes 190k+ 311 service request records with an NVIDIA-backed embedding/vector-search path, and performs live request retrieval without external APIs. Citizen text and city operations data stay local, while the dev server only receives audited nearest-record IDs, scores, and evidence references.
```

This should be demoed live: submit a request, call DGX embed-and-search, return nearest historical 311 records, and show how those records affect duplicate/ranking decisions.

## Stronger Spark story if time allows

```text
The same DGX Spark also serves the local tool-calling agent LLM and optionally cuOpt scheduling. The model, vector index, and active operator sessions remain resident locally, allowing the system to explain and update operational decisions without sending city/citizen data to external APIs.
```

Use **cuOpt** only if integration is quick. Otherwise, deterministic ranked insertion is acceptable and cuOpt remains the planned optimizer interface.

## One-time pipeline vs live runtime usage

Do **both**, with different purposes:

- **One-time Spark pipeline**: proves raw-data processing and creates durable demo artifacts.
- **Live Spark runtime calls**: prove the Spark is not just an offline preprocessing box.

Minimum judging path:

```text
RAPIDS/cuDF ingestion/profile on DGX Spark
  + NIM/NeMo or CUDA embedding build for 190k+ 311 records
  + cuVS or FAISS-GPU vector index
  + live request embedding/search against that index
  + deterministic permit/schedule logic on backend
```

Stronger path:

```text
RAPIDS/cuDF pipeline
  + NIM/NeMo embeddings
  + cuVS vector search
  + local NIM/TensorRT-LLM agent for explanations/tool orchestration
  + cuOpt schedule recompute if feasible
```

## Fallback ladder

Use this to avoid overclaiming during implementation.

| Capability | Best judging choice | Acceptable MVP fallback | Development-only fallback |
|---|---|---|---|
| Data pipeline | RAPIDS/cuDF | pandas only if explicitly logged as fallback | pandas with no GPU claim |
| Embeddings | NIM/NeMo embedding model | CUDA sentence-transformer/local embedding model | CPU embeddings |
| Vector search | cuVS | FAISS-GPU | CPU FAISS / sqlite vector search |
| Agent LLM | NIM/TensorRT-LLM/NeMo local model | local CUDA LLM server | external API or CPU model |
| Scheduling | cuOpt | deterministic ranked insertion | manual/static schedule |

For judging, avoid development-only fallbacks unless the UI/report clearly marks them as fallback and does not claim NVIDIA stack credit for that layer.

## Spark-backed implementation runbook

Run the artifact builder on the DGX Spark for the judging/demo state:

```bash
python scripts/data/build_demo_db.py \
  --raw-dir docs/data \
  --out-db var/311mustangs.sqlite \
  --out-index var/service_requests.cuvs \
  --out-report var/data_pipeline_report.md \
  --demo-clock 2026-01-15T20:00:00 \
  --require-gpu \
  --require-rapids
```

If cuVS is not available, use an explicit fallback path and name the artifact accordingly:

```bash
python scripts/data/build_demo_db.py \
  --raw-dir docs/data \
  --out-db var/311mustangs.sqlite \
  --out-index var/service_requests.faiss \
  --out-report var/data_pipeline_report.md \
  --demo-clock 2026-01-15T20:00:00 \
  --require-gpu \
  --vector-backend faiss-gpu
```

Then run live demo cases through the same backend path:

```bash
python scripts/demo/run_demo_cases.py \
  --db var/311mustangs.sqlite \
  --index var/service_requests.cuvs \
  --demo-clock 2026-01-15T20:00:00 \
  --require-gpu
```

## Runtime paths that must touch DGX artifacts

At minimum, the live request path should call the DGX for:

```text
embed_request(normalized_request) -> vector or vector_ref
search_311_index(vector/vector_ref, category filters) -> nearest record ids + scores
```

Then the backend can continue with deterministic logic:

```text
match_noise_permit(request, demo_clock) -> permit evidence or none
match_utility_cut(operation, proposed_window) -> conflict evidence or none
score_triage(request, similar, open_data_evidence) -> deterministic scores
rank_or_optimize_schedule(operation, constraints) -> candidate insertions
persist_decision_and_audit(...) -> durable records
```

Optional DGX LLM path:

```text
explain_decision_with_local_llm(decision_id, evidence_pack) -> operator/citizen explanation
```

The explanation prompt must include already-computed scores, evidence IDs, and constraints. The LLM should never be the authority for priority or scheduling validity.

## Live chat / KV cache stance

Using the same local model for the backend agent and live operator chat is fine, but do not center the pitch on "different KV caches." Judges care about system utility, not KV cache trivia.

Better framing:

```text
The DGX Spark keeps the local model, embeddings service, and 311 vector index resident. Multiple operator/agent sessions can reuse the same local model service while maintaining separate conversation state. Every chat answer is grounded in SQLite audit evidence and DGX retrieval results.
```

Live chat should answer questions like:

```text
Why was this request marked duplicate?
Which permit resolved this noise complaint?
Why was the first schedule insertion rejected?
What evidence requires human approval?
```

## Judging proof checklist

The demo/report should visibly show:

```text
gpu_enabled=true
NVIDIA device name
RAPIDS/cuDF version
embedding backend: NIM, NeMo, or explicit CUDA fallback
embedding model name
vector-search backend: cuVS, FAISS-GPU, or explicit fallback
311 records embedded/indexed count
open-data row counts by dataset
nearest-neighbor evidence for a live request
local LLM backend, if used
no external API dependency for triage/explanation, if true
```

Persist these in `data_pipeline_runs.metrics_json`, `var/data_pipeline_report.md`, and/or audit logs.

## Criteria alignment

| Criteria area | NVIDIA-aligned implementation choice | Demo proof to show judges |
|---|---|---|
| **Technical completeness** | Raw data becomes SQLite records, embeddings, vector index, decisions, graph edges, schedule assignments, and audit logs. | Run one scripted case and one live request end-to-end. |
| **Technical depth** | RAPIDS/cuDF ingestion, GPU retrieval, deterministic scoring, permit evidence, utility-cut constraints, graph validation, and audit logs. | Show report + evidence panel + rejected/accepted schedule insertion. |
| **NVIDIA stack** | RAPIDS/cuDF required; NIM/NeMo embeddings preferred; cuVS/FAISS-GPU vector search; local NIM/TensorRT-LLM agent optional. | Show library/backend names in the report and UI/debug panel. |
| **Spark story** | Local privacy-preserving data processing + retrieval + local model serving over city/citizen data. | Submit request live and show DGX retrieval/evidence without external API. |
| **Value/impact** | Similar 311 retrieval reduces duplicates; permits resolve noise; utility cuts prevent bad dispatches. | Show before/after: with evidence the request is deduped, resolved, or rescheduled. |

## Time-boxed Spark priorities

1. **First priority:** RAPIDS/cuDF ingestion/profile and a report proving it ran on GPU.
2. **Second priority:** DGX embedding + GPU vector index build for the 311 corpus.
3. **Third priority:** live request embed-and-search against the resident index.
4. **Fourth priority:** local NVIDIA-backed LLM explanation over audited evidence, if easy.
5. **Stretch:** cuOpt schedule optimization.

Cut anything that does not help these proof points: **NVIDIA library usage, local Spark utility, real open-data evidence, live retrieval impact, and auditable decisions**.
