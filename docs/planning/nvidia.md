# NVIDIA / DGX Spark Planning Notes

## Main feedback

The project needs a clear DGX Spark story. Do not frame the DGX as just a box running a web server.

Strong framing:

> DGX Spark powers local, privacy-preserving, GPU-accelerated 311 resolution: embedding, similarity search, open-data processing, and schedule optimization run locally against city-scale data.

The NVIDIA component should be visible in the architecture and pitch.

## Best NVIDIA routes

### 1. cuOpt for scheduling

This is probably the strongest fit if available.

Use cuOpt to formulate low-priority 311 dispatch as a vehicle routing / crew scheduling problem.

Why it matters:

- directly maps to city operations
- demonstrates optimization, not just chat
- creates a strong before/after comparison
- gives a concrete reason to use GPU acceleration

Pitch:

> We use NVIDIA cuOpt to recompute crew routes as new 311 requests arrive, minimizing travel time and schedule lateness while respecting crew shifts, skills, time windows, and road-work conflicts.

### 2. RAPIDS for data processing

Use RAPIDS if cuOpt is too heavy or unavailable.

Potential uses:

- cuDF for loading/filtering/joining Toronto Open Data
- cuML for clustering service requests geographically/semantically
- cuGraph for graph analytics if dependency/network logic becomes important

Pitch:

> RAPIDS lets us process and join large city datasets locally on the GPU, making it possible to refresh request clusters and operational constraints interactively.

### 3. Local embeddings / vector search

Use local embedding models on the DGX Spark for:

- semantic deduplication
- historical analog retrieval
- category matching
- request clustering

Possible stack:

- NVIDIA NIM embeddings if available
- NeMo models if available
- local sentence-transformer if NIM/NeMo setup is too slow
- FAISS/cuVS for vector search if available

Pitch:

> Citizen reports can contain sensitive information, so embeddings and similarity search run locally instead of sending request text to an external API.

### 4. Local LLM for explanation

A local LLM is useful, but should not be the core technical claim.

Use it for:

- operator summaries
- citizen-facing responses
- explanation formatting
- natural language interface over tools

Avoid making it responsible for priority/scheduling decisions.

## Recommended DGX stack priority

Ideal stack:

```text
RAPIDS/cuDF       → open-data ingestion and joins
NIM/NeMo/embedder → local request embeddings
FAISS/cuVS        → vector nearest-neighbor search
cuOpt             → schedule/route optimization
Local LLM         → explanation and operator assistant
```

If time is tight, pick one strong NVIDIA component and make it undeniable.

Best single choice:

```text
cuOpt for optimized crew scheduling
```

Second best:

```text
RAPIDS + local embeddings for dedupe and clustering
```

## DGX Spark story

Judges need to understand why this machine matters.

Good talking points:

- local inference avoids sending citizen reports to external APIs
- large unified memory can keep embeddings, records, and model context resident
- GPU acceleration enables repeated schedule recomputation as requests stream in
- city-scale data joins and clustering can be done interactively
- optimization can be compared against naive FIFO/manual dispatch

Avoid weak talking points:

- “We hosted the backend on DGX.”
- “We called an external LLM API from the app.”
- “We used AI to analyze requests” without specifying what ran locally.

## Performance/impact metrics to capture

Try to produce at least a few numbers for the demo.

Useful metrics:

- duplicate requests avoided
- auto-resolved percentage in sample batch
- average schedule travel distance reduction vs FIFO
- schedule recompute time
- number of historical 311 records embedded/searched
- number of open-data records processed
- nearest-neighbor latency
- route optimization latency

Example demo claim:

```text
On a sample batch of 500 service requests, the engine identified 18% duplicates,
auto-resolved 7% against known city records, and reduced low-priority crew travel
by 31% compared with FIFO dispatch.
```

Even if the dataset is small, show methodology and baseline comparison.

## Open Data grounding

Toronto Open Data should be part of the actual runtime path, not just mentioned in slides.

Minimum credible grounding:

- ingest 311 historical requests
- match incoming request against historical/open records
- ingest at least one constraint/known-issue dataset
- use that dataset to affect triage or scheduling

Best supporting datasets:

- 311 Service Requests — historical request patterns and dedupe corpus
- Watermain Breaks — known flooding/water issue detection
- Noise Exemption Permits — auto-resolution/escalation for noise complaints
- Utility Cut Permits — scheduling conflict/avoidance
- Road Resurfacing — road-work constraints
- Solid Waste Schedule — missed pickup auto-resolution if geocoding works

## cuOpt formulation idea

If using cuOpt, formulate as:

- vehicles = city crews
- locations = low-priority operations
- depot = crew start/end location
- time windows = shift/SLA windows
- service times = estimated operation duration
- costs = travel time/distance plus conflict penalties
- capacities/skills = crew capabilities if supported directly or pre-filtered before solve

Compare against:

- FIFO assignment
- nearest-neighbor greedy routing
- optimized cuOpt route

This gives a clean performance story.

## Fallback if cuOpt is not available

Use OR-Tools or a custom heuristic for scheduling, but still keep NVIDIA usage through RAPIDS/local embeddings.

Be transparent:

> The production path would use cuOpt; this demo uses RAPIDS GPU preprocessing and local embeddings, with a pluggable scheduler interface.

But if possible, get at least one cuOpt demo path working.

## What not to do

Do not spend all the time fine-tuning a huge model unless the rest of the system already works.

Fine-tuning is risky for 30 hours and harder to explain than a working optimization/data pipeline.

Better:

- local embedding model
- vector search
- scoring engine
- optimizer
- evidence logs

That looks like systems engineering.
