# Backend Planning Notes

## Main feedback

The backend should be the center of the project. Treat everything else as a wrapper around the resolution engine.

The backend should own:

- Toronto Open Data ingestion
- request storage
- embedding generation/storage
- duplicate detection
- open-data matching
- deterministic priority/scoring
- scheduling/optimization
- audit/evidence logging
- API for frontend and agent tools

## Recommended architecture

```text
API layer
  ↓
Resolution engine
  ├── data normalizer
  ├── embedding service
  ├── vector search
  ├── open-data matcher
  ├── scoring engine
  ├── scheduler/optimizer
  └── explanation/evidence builder
  ↓
SQLite + vector index
```

## Storage recommendation

Use SQLite for the proof of concept.

Do not use a graph database unless there is already strong familiarity with one. A DAG can be represented with relational tables and processed in application code.

Use a vector index separately if needed:

- FAISS
- LanceDB
- Chroma
- Qdrant
- sqlite-vec

For a hackathon MVP, SQLite + FAISS/LanceDB is enough.

## Suggested core tables

```text
service_requests
open_data_records
request_embeddings
triage_decisions
operations
operation_dependencies
crews
schedule_assignments
audit_logs
```

The audit log matters because it makes the engine explainable.

Example audit event:

```text
Request 184 marked DUPLICATE because nearest active request was 73m away,
semantic similarity was 0.91, category matched pothole, and original request is open.
```

## Triage outcomes

Use a small set of clear outcomes:

```text
AUTO_RESOLVE
DUPLICATE
HUMAN_REVIEW
AUTO_SCHEDULE
```

Possible logic:

```text
if public_safety_score is high:
    HUMAN_REVIEW
elif known_issue_score is high:
    AUTO_RESOLVE
elif duplicate_score is high:
    DUPLICATE
elif priority_score is low and confidence is high:
    AUTO_SCHEDULE
else:
    HUMAN_REVIEW
```

## Scoring engine

Avoid opaque LLM priority decisions. Use explicit scores.

Useful scores:

- urgency score
- public safety score
- duplicate score
- known issue score
- permit conflict score
- confidence score
- scheduling suitability score

Example duplicate score:

```text
duplicate_score =
  0.45 * semantic_similarity
+ 0.35 * location_proximity
+ 0.15 * category_match
+ 0.05 * recency
```

Example priority factors:

- category severity
- safety keywords
- proximity to sensitive locations
- number of similar reports nearby
- historical closure time
- active city work nearby
- time of day

## Dataset matching

Prioritize depth over breadth.

Most useful datasets:

1. 311 Service Requests — main historical/request corpus
2. Watermain Breaks — known issue / auto-resolution / priority boost
3. Utility Cut Permits or Road Resurfacing — scheduling constraints
4. Noise Exemption Permits — clean auto-resolution demo
5. Solid Waste Collection Schedule — useful but may be harder to geocode

The backend should normalize each dataset into common fields where possible:

```text
source
record_id
category
status
start_time
end_time
address
latitude
longitude
geometry
metadata_json
```

## Scheduling model

For MVP, model low-priority operations as crew routing/scheduling.

Operation fields:

- location
- category
- estimated duration
- priority
- required crew type
- earliest start
- latest finish
- conflict flags
- dependencies

Crew fields:

- depot/start location
- shift start/end
- skills
- max jobs/day

Objective should be explicit:

```text
minimize:
  travel time
+ SLA lateness
+ road/permit conflict penalties
+ duplicate dispatch penalties
- priority completion reward
- geographic batching bonus
```

Hard constraints:

- crew skill match
- shift windows
- dependencies
- blocked/invalid operating windows

## Graph/DAG answer

Use pure SQLite for data representation and application code for graph logic.

Represent dependencies with:

```text
operation_dependencies(before_operation_id, after_operation_id, dependency_type)
```

Then topologically sort or validate in code before scheduling.

This is easier to ship than a graph database and still gives a credible DAG story.

## APIs to expose

Minimal useful endpoints:

```http
POST /requests
GET /requests
GET /requests/:id
GET /requests/:id/decision
POST /schedule/recompute
GET /schedule
POST /schedule/:id/approve
POST /schedule/:id/reject
```

Optional agent/tool endpoints:

```http
POST /engine/triage
POST /engine/explain
POST /engine/recompute-with-constraints
GET /engine/evidence/:requestId
```

## Implementation risk notes

Cut first if time is tight:

- complex graph database
- fine-tuning
- many datasets
- full async job system
- fully autonomous scheduling approval

Keep:

- durable requests
- deterministic triage
- evidence output
- vector search
- one working scheduling path
