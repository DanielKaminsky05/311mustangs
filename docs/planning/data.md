# Data Scope for Barebones MVP

This document narrows the hackathon MVP to the minimum viable set of Toronto Open Data sources needed to prove the full data-to-agent-to-scheduling pipeline.

## MVP dataset table

| Dataset | What the data is used for | How the demo version should use this data |
|---|---|---|
| **311 Service Requests - Customer Initiated** | Core historical 311 corpus for request classification, ranking priors, duplicate/near-duplicate detection, and seeding existing operations. | Run a one-time DGX Spark data pipeline that normalizes the 190k+ rows into SQLite, creates structured request text from fields like `service_request_type`, `division`, `section`, `ward`, `status`, and intersection hints, generates local embeddings, and builds a vector index. Use `New` / `In Progress` low-priority request rows to seed the initial operation DAG. Because this dataset is broad and lacks full free-text/lat-lon, the MVP should only support selected service lanes and route everything else to `HUMAN_REVIEW`. |
| **Noise Exemption Permits** | Category-specific evidence source for noise complaint auto-resolution or escalation. | Normalize permits into `open_data_records` with `source='noise_exemption_permits'`, permit type, address, ward, issue/end dates, hours, and conditions. For an incoming noise complaint, the engine checks active permit records by address/ward/date/time. If a valid permit is found, return `AUTO_RESOLVE`; if no permit is found, return `HUMAN_REVIEW` or bylaw escalation. In the graph, connect the request to a permit evidence node with `COVERED_BY_PERMIT`. |
| **Utility Cut Permits** | Scheduling constraint source for low-priority operations. Prevents dispatching crews into active construction/utility zones. | Normalize permits into `open_data_records` with `source='utility_cut_permits'`, permit number, status, date window, ward, district, street segment/display description, client, and installation type. When the scheduler considers inserting a new operation into the existing DAG, the graph engine checks date/ward/street overlap against active utility cut permits. If conflict exists, create a graph edge from the operation to the permit with `BLOCKED_BY_UTILITY_CUT` or apply a route/insertion penalty. This is the clearest data-driven scheduling constraint for the demo. |

## Datasets intentionally excluded from MVP

| Dataset | Reason excluded from barebones MVP | Later use |
|---|---|---|
| **Watermain Breaks** | Has excellent WGS84 coordinates, but the available dataset ends in 2016. It is risky to present it as active known-issue data in the MVP. | Use later for historical infrastructure-risk scoring or seeded demo incidents clearly marked as synthetic/active demo state. |
| **Solid Waste Collection Schedule** | Clean deterministic table, but it needs a calendar/zone lookup layer that is not present in the file. This adds product-specific finesse for a narrow payoff. | Use later for missed-garbage auto-resolution if the submission flow can collect or infer collection calendar codes like `Tuesday1`. |

## MVP data thesis

The MVP should prove that real Toronto Open Data changes runtime decisions:

```text
311 historical records -> embedding/ranking/deduplication
Noise permits          -> auto-resolution evidence
Utility cut permits    -> scheduling/DAG constraints
```

This is enough to satisfy the product story without overbuilding the data layer.

## One-time DGX Spark data pipeline

Yes: run a one-time data preparation pipeline on the DGX Spark before the demo.

The pipeline should be rerunnable and deterministic:

```text
docs/data/*
  -> normalize raw CSV/DBF-derived records
  -> write SQLite tables
  -> generate structured text for embeddings
  -> compute local embeddings on DGX Spark
  -> build vector index
  -> seed existing operations
  -> build initial operation dependency edges
  -> write audit/data-quality summary
```

Recommended script stages:

```text
scripts/data/01_ingest_open_data.py
scripts/data/02_normalize_records.py
scripts/data/03_build_embeddings.py
scripts/data/04_seed_operations.py
scripts/data/05_build_demo_cases.py
```

For hackathon speed, these may be implemented as one script first, but the logical stages should remain visible in code and docs.

## SQLite tables needed for the MVP

Minimum durable tables:

```text
service_requests
open_data_records
request_embeddings
triage_decisions
operations
operation_dependencies
schedule_assignments
audit_logs
```

Optional but useful:

```text
demo_cases
data_pipeline_runs
```

## Runtime graph design

SQLite remains the source of truth. The graph is materialized in application code at runtime.

### Node types

```text
service_request
historical_311_record
noise_permit
utility_cut_permit
operation
crew
schedule_assignment
triage_decision
```

### Edge types

```text
SIMILAR_TO
DUPLICATE_OF
COVERED_BY_PERMIT
CONFLICTS_WITH_PERMIT
BLOCKED_BY_UTILITY_CUT
PRODUCES_OPERATION
ASSIGNED_TO
SCHEDULED_BEFORE
DEPENDS_ON
```

### How the graph should be built

At startup or before each schedule recompute:

1. Load active/in-progress `operations` from SQLite.
2. Load `operation_dependencies` edges.
3. Load active utility cut permit records for the relevant date window.
4. Create conflict edges from operations to utility cut permits when ward/street/date overlap is detected.
5. Validate the graph:
   - no cycles in operation dependency edges;
   - no operation scheduled inside a blocked window without human approval;
   - no unsupported category is auto-scheduled;
   - all auto-scheduled operations have evidence and audit logs.
6. Run ranked insertion or optimization.
7. Persist the new schedule assignments and audit trail.

## Barebones request pipeline

```text
Incoming request
  -> normalize request
  -> classify supported lane
  -> embed structured request text
  -> find similar 311 records
  -> compute deterministic ranking scores
  -> check category-specific open data
  -> choose triage decision
  -> optionally create operation
  -> materialize operation graph
  -> rank schedule insertion
  -> persist decision, schedule, and audit evidence
```

## Supported MVP lanes

The MVP should only support two lanes.

### Lane 1: Noise complaints

Input examples:

```text
Construction noise near 227 Gerrard St E at 2 AM.
Amplified sound complaint near a permitted event address.
```

Data used:

```text
311 Service Requests + Noise Exemption Permits
```

Possible outcomes:

```text
AUTO_RESOLVE    -> active permit found
HUMAN_REVIEW    -> no permit found or confidence too low
DUPLICATE       -> similar active 311 request found
```

Graph evidence:

```text
request -> SIMILAR_TO -> historical_311_record
request -> COVERED_BY_PERMIT -> noise_permit
triage_decision -> cites -> permit/date/address evidence
```

### Lane 2: Low-priority right-of-way / cleanup operations

Input examples:

```text
Graffiti on public sign.
Damaged/faded street sign.
Minor debris cleanup.
Non-urgent road/right-of-way issue.
```

Data used:

```text
311 Service Requests + Utility Cut Permits
```

Possible outcomes:

```text
DUPLICATE       -> similar active 311 request found
AUTO_SCHEDULE   -> low risk, supported category, no hard conflict
HUMAN_REVIEW    -> unsupported category, high public safety score, or conflict requires approval
```

Graph evidence:

```text
request -> SIMILAR_TO -> historical_311_record
request -> PRODUCES_OPERATION -> operation
operation -> BLOCKED_BY_UTILITY_CUT -> utility_cut_permit
operation -> SCHEDULED_BEFORE -> next_operation
operation -> ASSIGNED_TO -> crew
```

## Ranking/scoring scope

The engine should use deterministic scores. The agent should not invent these.

Suggested scores:

```text
duplicate_score
historical_similarity_score
category_supported_score
public_safety_score
noise_permit_match_score
utility_cut_conflict_score
schedule_insertion_score
confidence_score
```

Example decision policy:

```text
if unsupported_category:
    HUMAN_REVIEW
elif public_safety_score >= threshold:
    HUMAN_REVIEW
elif duplicate_score >= threshold:
    DUPLICATE
elif noise_permit_match_score >= threshold:
    AUTO_RESOLVE
elif category_supported and utility_cut_conflict_score < threshold:
    AUTO_SCHEDULE
else:
    HUMAN_REVIEW
```

## Scheduler MVP

For 36 hours, use ranked insertion before attempting full global optimization.

The scheduler should compare possible insertion points in the current operation DAG:

```text
schedule_insertion_score =
  priority_reward
  + geographic_or_ward_batching_bonus
  + same_crew_type_bonus
  - utility_cut_conflict_penalty
  - route_disruption_penalty
  - lateness_penalty
```

The demo should show:

1. current scheduled operations;
2. incoming low-priority request;
3. detected similar records and utility-cut constraints;
4. rejected insertion point because of conflict;
5. selected insertion point;
6. updated DAG/schedule;
7. audit explanation.

If cuOpt is available and working, it can replace ranked insertion later. The interface should remain pluggable.

## Agent role

The agent is an orchestration and explanation layer over audited tools.

The agent may:

```text
submit request to triage tool
ask for similar 311 records
ask for permit/conflict evidence
ask graph engine for valid insertion options
ask scheduler to recompute/rank insertion
explain the final decision to operator/citizen
request human approval
```

The agent must not:

```text
assign priority from free-form reasoning
invent constraints
update schedules without tool output
silently dispatch high-risk work
claim global optimality without optimizer evidence
```

## DGX Spark story

The DGX Spark should be used for at least the embedding/vector pipeline, and ideally later for scheduling optimization.

Minimum claim:

```text
DGX Spark locally embeds and indexes 190k+ 311 service request records, enabling privacy-preserving duplicate detection and historical analog retrieval without external APIs.
```

Stronger claim if time allows:

```text
DGX Spark also accelerates schedule recomputation/optimization, allowing the operation DAG to be updated interactively as new 311 requests arrive.
```

## Demo success criteria

The demo should prove these facts:

1. Real Toronto data was ingested into SQLite.
2. 311 records were embedded/indexed locally.
3. Similar historical requests affect duplicate/ranking decisions.
4. Noise permits can auto-resolve a noise complaint.
5. Utility cut permits can block or penalize a scheduling insertion.
6. The operation DAG updates after a valid schedule insertion.
7. Every decision has evidence and an audit log.
