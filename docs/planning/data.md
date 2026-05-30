# Data Pipeline Plan for Barebones MVP

This document is the **data pipeline proposal**: selected datasets, normalization, durable artifacts, runtime data flow, and demo data fixtures.

For DGX Spark / NVIDIA execution choices, GPU requirements, and judging-story details, read [`spark-usage.md`](./spark-usage.md).

## Final data scope

Immediate implementation is **311-first**. The other two planned evidence datasets are marked **DEFERRED until MVP** for now.

1. **311 Service Requests - Customer Initiated**
2. **Noise Exemption Permits** — **DEFERRED until MVP**
3. **Utility Cut Permits** — **DEFERRED until MVP**

Use the 311 corpus for local embeddings, nearest-neighbor retrieval, deterministic category priors, duplicate detection, and seeded active operations. Do **not** use the MVP timeline for model fine-tuning.

## MVP dataset table

| Dataset | What the data is used for | How the demo version should use this data |
|---|---|---|
| **311 Service Requests - Customer Initiated** | Core historical 311 corpus for request classification, ranking priors, duplicate/near-duplicate detection, and seeding existing operations. | Normalize the 190k+ rows into SQLite, create structured request text from fields like `service_request_type`, `division`, `section`, `ward`, `status`, and intersection hints, generate embeddings, and build a vector index. Use `New` / `In Progress` low-priority request rows to seed the initial operation DAG. Because this dataset is broad and lacks full free-text/lat-lon, the MVP should only support selected service lanes and route everything else to `HUMAN_REVIEW`. |
| **Noise Exemption Permits** — **DEFERRED until MVP** | Category-specific evidence source for noise complaint auto-resolution or escalation. | Deferred for the immediate DGX-first build. Later, normalize permits into `open_data_records` with `source='noise_exemption_permits'`, permit type, address, ward, issue/end dates, hours, and conditions. For an incoming noise complaint, check active permit records by address/ward/date/time. |
| **Utility Cut Permits** — **DEFERRED until MVP** | Scheduling constraint source for low-priority operations. Prevents dispatching crews into active construction/utility zones. | Deferred for the immediate DGX-first build. Later, normalize permits into `open_data_records` with `source='utility_cut_permits'`, permit number, status, date window, ward, district, street segment/display description, client, and installation type. |

## Datasets intentionally excluded from MVP

| Dataset | Reason excluded from barebones MVP | Later use |
|---|---|---|
| **Watermain Breaks** | Has excellent WGS84 coordinates, but the available dataset ends in 2016. It is risky to present it as active known-issue data in the MVP. | Use later for historical infrastructure-risk scoring or seeded demo incidents clearly marked as synthetic/active demo state. |
| **Solid Waste Collection Schedule** | Clean deterministic table, but it needs a calendar/zone lookup layer that is not present in the file. This adds product-specific finesse for a narrow payoff. | Use later for missed-garbage auto-resolution if the submission flow can collect or infer collection calendar codes like `Tuesday1`. |

## MVP data thesis

The MVP should prove that real Toronto Open Data changes runtime decisions:

```text
311 historical records -> embedding/ranking/deduplication
Noise permits          -> auto-resolution evidence (**DEFERRED until MVP**)
Utility cut permits    -> scheduling/DAG constraints (**DEFERRED until MVP**)
```

This is enough to satisfy the product story without overbuilding the data layer.

## NVIDIA-aligned data path

The data pipeline should make the DGX Spark useful in a way judges can see. The backend may store durable records on the dev server, but the data-heavy preparation and live retrieval path should be NVIDIA-backed.

| Data stage | NVIDIA-aligned implementation | Persisted proof/artifact |
|---|---|---|
| Source ingestion and profiling | Load and normalize the 311 Service Requests dataset first with **RAPIDS/cuDF** on the DGX Spark. Noise Exemption Permits and Utility Cut Permits are **DEFERRED until MVP**. | `data_pipeline_runs.metrics_json` should include `rapids_version`, `gpu_enabled`, row counts, null counts, and dropped/unsupported category counts. |
| 311 text construction | Build deterministic `structured_text` fields from normalized 311 columns before embedding. | `service_requests.structured_text` and report samples. |
| Embedding generation | Generate 311 embeddings locally on the DGX Spark, preferably through **NVIDIA NIM/NeMo embeddings**. | `request_embeddings.embedding_model`, `embedding_dim`, `vector_ref`, `index_name`, and embedding count. |
| Vector index build | Build the retrieval index on the DGX Spark with **cuVS** preferred or **FAISS-GPU** acceptable. | Sidecar vector index plus `request_embeddings.index_name/index_position`. |
| Live request retrieval | For each submitted request, call the DGX Spark embed-and-search path against the resident 311 index. | `triage_decisions.evidence_json` should store nearest 311 IDs/scores and DGX backend metadata. |
| Agent evidence pack | Package deterministic scores and nearest 311 records for the local agent LLM. Permit evidence and schedule constraints are **DEFERRED until MVP**. | `audit_logs.evidence_json`; the LLM explains evidence but does not invent scores. |

Detailed library choices, fallback rules, and judging claims live in [`spark-usage.md`](./spark-usage.md).

## Pipeline artifacts

The one-time preparation pipeline is the artifact builder for the demo state:

```text
docs/data/service-requests/SR2026.csv
  -> RAPIDS/cuDF load + profile 311 records on DGX Spark
  -> normalize stable 311 app fields
  -> write SQLite tables
  -> generate structured text for 311 embeddings
  -> run local DGX embedding inference, preferably NIM/NeMo
  -> build GPU vector index, preferably cuVS or FAISS-GPU
  -> seed existing 311-based candidate operations
  -> write audit/data-quality/NVIDIA-stack summary

Noise Exemption Permits and Utility Cut Permits are **DEFERRED until MVP**.
```

Recommended script stages:

```text
scripts/data/01_ingest_open_data.py        # RAPIDS/cuDF 311 loading + profiling
scripts/data/02_normalize_records.py       # stable 311 fields; permit/utility-cut fields **DEFERRED until MVP**
scripts/data/03_embed_and_index_311.py     # DGX embedding inference + cuVS/FAISS-GPU index
scripts/data/04_seed_operations.py         # rough 311-based candidate operations
scripts/data/05_build_demo_cases.py        # 311 dedupe/ranking cases first; permit/utility cases **DEFERRED until MVP**
```

For hackathon speed, these may be implemented as one script first, but the logical stages should remain visible in function names and logs. Spark/GPU-specific run flags and runtime requirements are tracked in [`spark-usage.md`](./spark-usage.md).

### Artifact builder responsibilities

The builder should:

1. create `var/` artifacts and a `data_pipeline_runs` row;
2. load 311 service requests with RAPIDS/cuDF for the judging run; noise permits and utility cut permits are **DEFERRED until MVP**;
3. normalize 311 source columns into stable app fields;
4. write `service_requests` to SQLite;
5. generate `structured_text` for every 311 record;
6. compute embeddings on the DGX Spark and persist embedding metadata/vector-index references;
7. build the vector index on the DGX Spark and store index metadata;
8. seed low-priority `New` / `In Progress` 311 rows as rough candidate operations;
9. seed demo `crews` and baseline `schedule_assignments` only if needed by the dashboard;
10. defer utility-cut conflict edges; Utility Cut Permits are **DEFERRED until MVP**;
11. write row counts, null counts, selected demo records, data-quality warnings, and NVIDIA-stack evidence to `var/data_pipeline_report.md`.

## Backend persistence handoff

The data pipeline writes normalized records and artifact references into backend-owned storage. The actual SQLite schema, Redis graph/cache design, and API contracts live in [`backend.md`](./backend.md).

Pipeline-owned outputs that must be persisted by the backend:

```text
service_requests              -> normalized 311 rows and submitted requests
open_data_records             -> normalized noise permits and utility cut permits (**DEFERRED until MVP**)
request_embeddings            -> embedding metadata and vector-index references
operations                    -> seeded active/in-progress demo operations
operation_dependencies        -> seeded DAG/conflict edges
schedule_assignments          -> baseline demo schedule rows
data_pipeline_runs            -> row counts, timing, warnings, and artifact metadata
demo_cases                    -> fixed scripted demo inputs and expected evidence
```

## Runtime request data flow

```text
Incoming request
  -> normalize request
  -> classify supported data lane
  -> call DGX Spark embed-and-search path
  -> receive similar 311 record ids/scores from vector index
  -> compute deterministic data signals
  -> check category-specific open data (**DEFERRED until MVP** for noise/utility evidence)
  -> choose triage decision
  -> optionally create operation
  -> materialize operation graph
  -> rank schedule insertion
  -> persist decision, schedule, and audit evidence
```

The data layer should expose deterministic signals. Downstream layers should consume these persisted signals rather than recomputing or inventing them.

Suggested data signals:

```text
duplicate_score
historical_similarity_score
category_supported_score
public_safety_score
noise_permit_match_score      # **DEFERRED until MVP**
utility_cut_conflict_score    # **DEFERRED until MVP**
schedule_insertion_score
confidence_score
```

## Data-backed MVP lanes

Immediate DGX-first implementation is 311 dedupe/ranking only. The two open-data evidence lanes below are **DEFERRED until MVP**.

### Lane 1: Noise complaints — **DEFERRED until MVP**

Input examples:

```text
Construction noise near 227 Gerrard St E at 2 AM. (**DEFERRED until MVP**)
Amplified sound complaint near a permitted event address. (**DEFERRED until MVP**)
```

Data used:

```text
311 Service Requests + Noise Exemption Permits (**DEFERRED until MVP**)
```

Possible data-backed outcomes:

```text
AUTO_RESOLVE    -> active permit found (**DEFERRED until MVP**)
HUMAN_REVIEW    -> no permit found or confidence too low (**DEFERRED until MVP**)
DUPLICATE       -> similar active 311 request found
```

Graph evidence:

```text
request -> SIMILAR_TO -> historical_311_record
request -> COVERED_BY_PERMIT -> noise_permit (**DEFERRED until MVP**)
triage_decision -> cites -> permit/date/address evidence (**DEFERRED until MVP**)
```

### Lane 2: Low-priority right-of-way / cleanup operations — Utility Cut evidence **DEFERRED until MVP**

Input examples:

```text
Graffiti on public sign.
Damaged/faded street sign.
Minor debris cleanup.
Non-urgent road/right-of-way issue.
```

Data used:

```text
311 Service Requests + Utility Cut Permits (**DEFERRED until MVP**)
```

Possible data-backed outcomes:

```text
DUPLICATE       -> similar active 311 request found
AUTO_SCHEDULE   -> low risk, supported category, no hard conflict
HUMAN_REVIEW    -> unsupported category, high public safety score, or conflict requires approval
```

Graph evidence:

```text
request -> SIMILAR_TO -> historical_311_record
request -> PRODUCES_OPERATION -> operation
operation -> BLOCKED_BY_UTILITY_CUT -> utility_cut_permit (**DEFERRED until MVP**)
operation -> SCHEDULED_BEFORE -> next_operation
operation -> ASSIGNED_TO -> crew
```

## Graph data materialization

SQLite remains the source of truth. The graph is materialized in application code at runtime from SQLite rows.

### Node types

```text
service_request
historical_311_record
noise_permit              # **DEFERRED until MVP**
utility_cut_permit        # **DEFERRED until MVP**
operation
crew
schedule_assignment
triage_decision
```

### Edge types

```text
SIMILAR_TO
DUPLICATE_OF
COVERED_BY_PERMIT        # **DEFERRED until MVP**
CONFLICTS_WITH_PERMIT    # **DEFERRED until MVP**
BLOCKED_BY_UTILITY_CUT   # **DEFERRED until MVP**
PRODUCES_OPERATION
ASSIGNED_TO
SCHEDULED_BEFORE
DEPENDS_ON
```

### Graph build steps

At startup or before each schedule recompute:

1. Load active/in-progress `operations` from SQLite.
2. Load `operation_dependencies` edges.
3. Load active utility cut permit records for the relevant date window. **DEFERRED until MVP**
4. Create conflict edges from operations to utility cut permits when ward/street/date overlap is detected. **DEFERRED until MVP**
5. Validate graph data:
   - no cycles in operation dependency edges;
   - no operation scheduled inside a blocked window without human approval;
   - no unsupported category is auto-scheduled;
   - all auto-scheduled operations have evidence and audit logs.
6. Persist new schedule assignments and audit trail after ranking/optimization.

## Data-quality and audit outputs

Every pipeline run should produce a report with:

```text
pipeline run id
source file names and timestamps
row counts by dataset
normalized row counts by table
null counts for critical fields
dropped/unsupported category counts
embedding/index counts
seeded operation counts
utility-cut conflict edge counts (**DEFERRED until MVP**)
selected demo record ids
NVIDIA device name and gpu_enabled flag
RAPIDS/cuDF version used for ingestion/profile
embedding backend/model, preferably NIM or NeMo
vector-search backend, preferably cuVS or FAISS-GPU
runtime fallback status, if any
timing per pipeline stage
warnings that affect demo reliability
```

Every runtime decision should persist enough evidence to reconstruct why it happened:

```text
incoming request payload
normalized request text
DGX embed/search backend metadata
nearest 311 record ids and similarity scores
permit/conflict evidence record ids (**DEFERRED until MVP** for noise/utility evidence)
score breakdown
selected decision
schedule candidate ids, if scheduling ran
audit log id
```

## Scripted demo data cases

Use a fixed `demo_clock` so the date windows in the datasets line up. Good default: **2026-01-15 20:00**.

| Case | Input | Expected outcome | Real-data evidence |
|---|---|---|---|
| Noise permit auto-resolution — **DEFERRED until MVP** | `Construction noise at 1 Delisle Ave around 8 PM.` | `AUTO_RESOLVE` or `AUTO_RESOLVE_PENDING_NOTICE` | Noise permit `P455527623`, `1 DELISLE AVE`, active `2025-04-15` to `2026-03-31`; similar 311 noise records. |
| Noise complaint without permit — **DEFERRED until MVP** | `Amplified noise near an address with no matching permit.` | `HUMAN_REVIEW` / bylaw escalation | Similar 311 noise records exist, but no active permit match is found. |
| Utility cut blocks schedule insertion — **DEFERRED until MVP** | `Graffiti / damaged sign cleanup on Wychwood Ave near Tyrrel Ave.` | `AUTO_SCHEDULE_PENDING_APPROVAL`, with first insertion rejected and next safe slot selected | Utility cut permit `1021444006`, `WYCHWOOD AVE (Between TYRREL AVE AND HELENA AVE)`, active through `2026-01-15`. |
| Duplicate low-priority request | Submit the same Wychwood cleanup request again. | `DUPLICATE` | High similarity to the newly created active request/operation plus same category/location tokens. |

For the utility-cut case (**DEFERRED until MVP**), show two candidate insertions:

```text
Candidate A: 2026-01-15 14:00 -> rejected/penalized because BLOCKED_BY_UTILITY_CUT (**DEFERRED until MVP**)
Candidate B: 2026-01-16 10:00 -> accepted because the utility-cut window ended (**DEFERRED until MVP**)
```

## Demo data success criteria

The data pipeline should prove these facts:

1. Real Toronto data was ingested into SQLite.
2. 311 records were embedded/indexed locally.
3. Similar historical requests affect duplicate/ranking decisions.
4. Noise permits can provide evidence for resolving a noise complaint. **DEFERRED until MVP**
5. Utility cut permits can block or penalize a scheduling insertion. **DEFERRED until MVP**
6. The operation DAG data updates after a valid schedule insertion.
7. Every decision has evidence and an audit log.
