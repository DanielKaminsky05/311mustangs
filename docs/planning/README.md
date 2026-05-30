# Resolution Engine Planning Notes


## Context 

The 311 service is fundamentally bottlenecked by the fact that humans need to review a massive incoming stream of service requests and go through a bueraucratic process to be able to deploy actual operations to resolve this. This creates 2 problems:

1. human review is slow and bottlenecked 
2. operation decisions may not be optimal because the human may brainstorm locally optimal solutions but fail at a globally efficient solution that does not stall the city's daily normal operations (ie. road fix schedulings may sound coherent on its own but paralyze an entire traffic route)

This folder is a working dump of sanity-check feedback and implementation directions for the 311 Mustangs resolution engine concept.

The goal is to keep the idea space broad while separating concerns enough that each area can be iterated independently.

## implementation priority

The immediate implementation priority is to satisfy the hackathon's strongest judging requirements first: a working, NVIDIA-backed DGX Spark data and inference pipeline. The multi-layer graph, Redis materialized DAG, and polished scheduling story are now **nice-to-have bonus features**, not the critical path.

### Critical path

Focus first on the 311 Service Requests dataset and the DGX Spark retrieval/ranking pipeline:

```text
311 Service Requests
  -> RAPIDS/cuDF ingestion + profiling on DGX Spark
  -> deterministic structured_text construction
  -> DGX-local embedding generation
  -> GPU vector index/search, preferably cuVS or FAISS-GPU
  -> live request embed-and-search
  -> deterministic dedupe/ranking scores
  -> DGX-local agent LLM explanation over audited tool outputs
```

This path gives the clearest systems-engineering and NVIDIA-stack story. It uses real city-scale data, runs locally, avoids external API dependency for core inference, and directly supports the product's most important behavior: ranking, duplicate detection, and grounded operator explanation.

### Deprioritized for now

Do not block the core DGX work on:

```text
Redis graph/DAG implementation
multi-layer spatial graph context engineering
full backend API schema
frontend/dashboard polish
cuOpt route optimization
true geospatial crew dispatch
```

A rough scheduling stub is enough for the first demo. Treat it as **ranked queue insertion**, not global optimization:

```text
group active low-priority 311 records by ward, service_request_type, section, and available street/intersection tokens
insert a new low-priority request into the closest matching batch
persist/display the ranked insertion and explanation
```

### Personal implementation scope

The owner of the DGX/data path should build:

```text
scripts/data/build_311_index.py
scripts/dgx/embed_311.py
scripts/dgx/serve_embed_search.py
scripts/demo/run_311_dedupe_cases.py
var/311mustangs.sqlite
var/service_requests_all.faiss or var/service_requests_all.cuvs
var/service_requests_active.faiss or var/service_requests_active.cuvs
var/data_pipeline_report.md
```

Teammates can continue backend API and frontend/dashboard work against these artifacts. Once the 311 DGX path works, noise permits and utility cuts can be reintroduced as simple evidence lookups. The graph/DAG layer should only be revisited after the NVIDIA-backed embedding, retrieval, ranking, and agent inference loop is working end-to-end.

### Pitch discipline

Lead with:

> DGX Spark powers a local 311 resolution engine: RAPIDS processes Toronto Open Data, NVIDIA-backed embeddings index 190k+ service requests, GPU vector search grounds every new request in historical analogs, and a local agent explains audited ranking/deduplication decisions.

Do not lead with:

> We built a globally optimal geospatial scheduling DAG.

That claim is higher risk because the current 311 data has only coarse location fields. The graph/scheduling layer can still help the demo stand out, but it should not distract from the higher-return DGX Spark core.

## Component notes

- [Proposal](./proposal.md) — overall solution framing and component responsibilities
- [Data](./data.md) — dataset scope, pipeline artifacts, and data handoff contracts
- [Backend](./backend.md) — backend runtime design, Redis/SQLite notes, and API draft
- [Agents](./agents.md) — multi-agent architecture, NemoClaw/OpenClaw/LangGraph integration, and shared DGX vLLM serving plan
- [DGX Spark / NVIDIA stack](./spark-usage.md) — current NVIDIA ecosystem usage and judging-aligned implementation priorities
- [Criteria](./criteria.md) — hackathon judging rubric
- [NVIDIA suggestions archive](./nvidia-suggestion.md) — older NVIDIA planning notes; use as reference only
