# 311 embedding data pipeline

This document maps the WhatsApp/NemoClaw agent flow in [`agents.md`](./agents.md) to concrete data pipeline responsibilities.

The pipeline has two execution modes:

1. **One-time artifact build**: clean historical 311 data, create structured text, generate embeddings, and build vector indexes.
2. **Live request path**: validate an incoming ticket, embed it, retrieve category/similarity/duplicate evidence, and compute deterministic scores.

## Source data reality

The available 311 historical service request data is narrow but useful.

Raw SR2026 columns:

```text
Creation Date
Status
First 3 Chars of Postal Code
Intersection Street 1
Intersection Street 2
Ward
Service Request Type
Division
Section
```

Normalized column names:

```text
creation_date
status
first_3_chars_of_postal_code
intersection_street_1
intersection_street_2
ward
service_request_type
division
section
```

Important constraints:

```text
no full citizen complaint text
no latitude / longitude
no true urgency label
no confirmed duplicate label
no resolution-time/SLA label
```

Therefore:

```text
category inference uses service_request_type/division/section taxonomy
urgency uses transparent weighted rules, not learned labels
duplicate detection uses vector search for candidates + metadata filtering for confirmation
```

## Canonical backend ticket schema

The live pipeline should not depend on frontend-specific payload details. The WhatsApp/NemoClaw agent sends a payload that the backend normalizes into this canonical shape.

```json
{
  "ticket_id": "generated-or-client-id",
  "source": "whatsapp",
  "description": "There is graffiti on a stop sign near Wychwood and Tyrrel.",
  "location": {
    "raw_text": "Wychwood Ave and Tyrrel Ave",
    "intersection_street_1": "Wychwood Ave",
    "intersection_street_2": "Tyrrel Ave",
    "postal_code_or_fsa": "M6G",
    "ward": null,
    "latitude": null,
    "longitude": null
  },
  "observed_at": "2026-01-15T20:00:00",
  "reported_at": "2026-01-15T20:01:00",
  "hazard_flags": {
    "injury": false,
    "active_danger": false,
    "blocking_road": false,
    "blocking_sidewalk": false,
    "flooding": false,
    "sewage_or_water_issue": false,
    "traffic_signal_issue": false
  },
  "media_refs": [],
  "metadata": {}
}
```

Minimum required fields for the embedding/scoring pipeline:

```text
description
location.raw_text or at least one structured location field
observed_at or reported_at
hazard_flags, allowing true/false/unknown values
```

## Embedding record schemas

The pipeline should store normalized JSON and embed deterministic text. Do not embed raw JSON directly.

### Historical service request embedding record

Produced from each historical SR2026 row.

```json
{
  "record_id": "sr2026-000001",
  "source": "toronto_311_service_requests",
  "source_file": "SR2026.csv",
  "creation_date": "2026-01-01T00:27:38",
  "status": "Completed",
  "first_3_chars_of_postal_code": "Intersection",
  "intersection_street_1": "Leslie St",
  "intersection_street_2": "Finch Ave E",
  "ward": "Don Valley North (17)",
  "service_request_type": "Clean up Debris on Road",
  "division": "Transportation Services",
  "section": "Road Operations",
  "location_type": "intersection",
  "is_active": false,
  "structured_text": "Service request type: Clean up Debris on Road. Division: Transportation Services. Section: Road Operations. Status: Completed. Ward: Don Valley North (17). Postal area: Intersection. Intersection: Leslie St and Finch Ave E."
}
```

### Category taxonomy embedding record

Produced from unique historical category triples.

```json
{
  "category_id": "transportation-services__road-operations__road-pothole-road-damage",
  "service_request_type": "Road Pothole / Road Damage",
  "division": "Transportation Services",
  "section": "Road Operations",
  "historical_count": 17347,
  "active_count": 1486,
  "structured_text": "Service request category: Road Pothole / Road Damage. Division: Transportation Services. Section: Road Operations."
}
```

### Live request embedding record

Produced from the backend canonical ticket.

```json
{
  "ticket_id": "ticket-123",
  "source": "whatsapp",
  "description": "There is graffiti on a stop sign near Wychwood and Tyrrel.",
  "location_raw_text": "Wychwood Ave and Tyrrel Ave",
  "intersection_street_1": "Wychwood Ave",
  "intersection_street_2": "Tyrrel Ave",
  "postal_code_or_fsa": "M6G",
  "ward": null,
  "observed_at": "2026-01-15T20:00:00",
  "hazard_flags": {
    "injury": false,
    "active_danger": false,
    "blocking_road": false,
    "blocking_sidewalk": false,
    "flooding": false,
    "sewage_or_water_issue": false,
    "traffic_signal_issue": false
  },
  "structured_text": "Reported issue: There is graffiti on a stop sign near Wychwood and Tyrrel. Location: Wychwood Ave and Tyrrel Ave. Postal area: M6G. Hazards: injury=false; active_danger=false; blocking_road=false; blocking_sidewalk=false; flooding=false; sewage_or_water_issue=false; traffic_signal_issue=false."
}
```

## Historical columns by pipeline use

| Historical column | Used by category inference | Used by duplicate detection | Used by urgency scoring | Used by scheduling/batching | Notes |
|---|---:|---:|---:|---:|---|
| `creation_date` | No | Yes | Weak | Yes | Recency filter/boost for duplicates and active workload context. |
| `status` | No | Yes | Weak | Yes | `New`/`In Progress` define active duplicate index. Not a true urgency label. |
| `first_3_chars_of_postal_code` | No | Yes | No | Yes | Coarse location. Useful when no intersection exists. |
| `intersection_street_1` | No | Yes | No | Yes | Strong duplicate/location signal when present. |
| `intersection_street_2` | No | Yes | No | Yes | Strong duplicate/location signal when present. |
| `ward` | Weak | Yes | No | Yes | Good for batching and location priors; not enough alone for duplicates. |
| `service_request_type` | Yes | Yes | Yes | Yes | Strongest category and urgency-rule input. |
| `division` | Yes | Yes | Yes | Yes | Department/routing category. |
| `section` | Yes | Yes | Yes | Yes | More specific operational routing category. |

## One-time artifact build

This code should run before the demo and whenever the historical data changes.

### Stage 1: load and repair source CSV

Input:

```text
docs/data/service-requests/SR2026.csv
```

Expected behavior:

```text
read CSV
repair known unquoted comma issue in Division values
normalize column names
trim whitespace
convert blank strings to nulls where useful
parse creation_date
assign stable record_id
```

Known repair requirement:

```text
Rows with Division like "Environment, Climate & Forestry" may parse as extra CSV fields.
Repair by preserving the first 7 fields, joining middle extra fields as Division, and preserving Section as the final field.
```

Outputs:

```text
normalized service request table
column/null/profile metrics
CSV repair counts
```

### Stage 2: derive normalized fields

Input columns:

```text
creation_date
status
first_3_chars_of_postal_code
intersection_street_1
intersection_street_2
ward
service_request_type
division
section
```

Derived fields:

```text
record_id
creation_date_parsed
ward_number
location_type                  # intersection, fsa, unknown
is_active                      # status in [New, In Progress]
category_key                   # normalized service_request_type/division/section
structured_text
```

Example `location_type` logic:

```text
if intersection_street_1 and intersection_street_2 are present -> intersection
else if first_3_chars_of_postal_code is present and not "Intersection" -> fsa
else -> unknown
```

### Stage 3: build category taxonomy

Input:

```text
normalized service request records
```

Group by:

```text
service_request_type
division
section
```

Output fields:

```text
category_id
service_request_type
division
section
historical_count
active_count
structured_text
```

This taxonomy is the primary category inference target for live requests.

### Stage 4: generate embeddings

Inputs:

```text
historical service request structured_text
category taxonomy structured_text
active service request structured_text
```

Expected embedding artifacts:

```text
category_taxonomy embeddings
all historical service request embeddings
active service request embeddings
```

Preferred DGX/NVIDIA path:

```text
RAPIDS/cuDF for ingestion/profile on DGX Spark
NVIDIA NIM or NeMo embedding model for embedding generation
cuVS preferred, FAISS-GPU acceptable for vector indexes
```

### Stage 5: build vector indexes

Create three indexes:

```text
category_taxonomy.index        # unique category triples
service_requests_all.index     # all historical rows
service_requests_active.index  # status New/In Progress only
```

Each vector position must map back to a durable ID:

```text
index_name
index_position
record_id or category_id
embedding_model
embedding_dim
structured_text_hash
```

### Stage 6: persist artifacts and report

Suggested outputs:

```text
var/311mustangs.sqlite
var/category_taxonomy.faiss or .cuvs
var/service_requests_all.faiss or .cuvs
var/service_requests_active.faiss or .cuvs
var/data_pipeline_report.md
```

Report should include:

```text
source files
row counts
category counts
active row counts
CSV repaired row counts
null/blank counts
embedding counts
index counts
GPU enabled flag
NVIDIA device name
RAPIDS/cuDF version
embedding backend/model
vector backend
warnings
```

## Live usage code path

This code runs for each incoming WhatsApp/backend ticket.

### Stage 1: validate incoming ticket

Input:

```text
backend canonical ticket JSON
```

Required checks:

```text
description is non-empty
location has raw_text or structured location fields
observed_at/reported_at can be parsed
hazard_flags object exists
hazard flag values are boolean or unknown/null
```

If required fields are missing, return:

```text
NEEDS_MORE_INFO
```

with specific missing fields for the intake agent.

### Stage 2: build live structured text

Input fields:

```text
description
location.raw_text
intersection_street_1
intersection_street_2
postal_code_or_fsa
ward
hazard_flags
```

Output:

```text
live_request.structured_text
```

This text is the query embedding for all three indexes.

### Stage 3: category inference

Input:

```text
live_request.structured_text embedding
category_taxonomy.index
```

Process:

```text
retrieve top K category taxonomy neighbors
normalize similarities into confidence weights
compute top confidence and top-vs-second margin
```

Output:

```json
{
  "category_candidates": [
    {
      "service_request_type": "Road Pothole / Road Damage",
      "division": "Transportation Services",
      "section": "Road Operations",
      "similarity": 0.82,
      "confidence": 0.57
    }
  ],
  "category_confidence": 0.57,
  "category_margin": 0.27,
  "category_decision": "SUGGESTED_CATEGORY"
}
```

Suggested decision logic:

```text
top confidence high + clear margin -> SUGGESTED_CATEGORY
low confidence or small margin -> UNCERTAIN_CATEGORY
```

### Stage 4: historical similarity retrieval

Input:

```text
live_request.structured_text embedding
service_requests_all.index
```

Uses historical fields:

```text
service_request_type
division
section
ward
first_3_chars_of_postal_code
intersection_street_1
intersection_street_2
creation_date
status
```

Output:

```text
nearest historical records with IDs, similarities, category fields, location fields, and statuses
```

Purpose:

```text
evidence for reviewer/operator
category prior context
workload context
```

### Stage 5: active duplicate candidate retrieval

Input:

```text
live_request.structured_text embedding
service_requests_active.index
```

Candidate rows are restricted to:

```text
status in ["New", "In Progress"]
```

After vector retrieval, apply metadata filters/boosts:

```text
same or similar inferred service_request_type
same intersection_street_1 and intersection_street_2
same FSA/postal area
same ward
recent creation_date
high embedding similarity
```

Output:

```json
{
  "duplicate_decision": "POSSIBLE_DUPLICATE",
  "duplicate_score": 0.61,
  "active_duplicate_candidates": []
}
```

Decision levels:

```text
DUPLICATE             # strong category + active + strong location match
POSSIBLE_DUPLICATE    # similar active record but weak/coarse location
NOT_DUPLICATE         # no strong active evidence
```

### Stage 6: urgency scoring

Urgency is deterministic and auditable. It is not trained directly from SR2026 labels.

Inputs:

```text
category_candidates with confidence weights
hazard_flags
keyword/rule matches from description
optional duplicate/workload context
urgent.yaml ruleset
```

Expected `urgent.yaml` concepts:

```text
category_base_scores
hazard_boosts
keyword_boosts
deprioritize_keywords
hard_routes
thresholds
```

Example formula:

```text
category_base_score = sum(category_confidence_i * base_score(category_i))
rules_score = category_base_score + hazard_boosts + keyword_boosts - penalties
urgency_score = clamp(rules_score, 0.0, 1.0)
```

Hard route examples:

```text
injury=true -> HIGH_URGENCY_HUMAN_REVIEW
active_danger=true -> HIGH_URGENCY_HUMAN_REVIEW
traffic_signal_issue=true -> HIGH_URGENCY_HUMAN_REVIEW
```

Suggested thresholds:

```text
urgency_score >= 0.75       -> HIGH_URGENCY_HUMAN_REVIEW
0.45 <= urgency_score < .75 -> MEDIUM_REVIEW_OR_QUEUE
urgency_score < 0.45        -> LOW_URGENCY_SCHEDULING
```

### Stage 7: routing output

Final live output should be an evidence pack.

```json
{
  "ticket_id": "ticket-123",
  "category_candidates": [],
  "nearest_historical_records": [],
  "active_duplicate_candidates": [],
  "category_decision": "SUGGESTED_CATEGORY",
  "duplicate_decision": "NOT_DUPLICATE",
  "urgency_score": 0.22,
  "urgency_decision": "LOW_URGENCY_SCHEDULING",
  "score_breakdown": {
    "category_base_score": 0.15,
    "hazard_boost_total": 0.0,
    "keyword_boost_total": 0.07,
    "penalty_total": 0.0
  },
  "route": "SCHEDULING_AGENT",
  "audit_refs": []
}
```

Routing:

```text
HIGH_URGENCY_HUMAN_REVIEW -> human workflow with suggested category/division/section
MEDIUM_REVIEW_OR_QUEUE    -> human or operator queue depending product choice
LOW_URGENCY_SCHEDULING    -> scheduling/reasoning agent
DUPLICATE                 -> duplicate workflow unless hard-route hazard overrides
```

## One-time script vs live code summary

| Component | One-time artifact build | Live request path |
|---|---:|---:|
| CSV repair and historical normalization | Yes | No |
| Historical row structured text | Yes | No |
| Category taxonomy extraction | Yes | No |
| Historical embeddings | Yes | No |
| Category taxonomy embeddings | Yes | No |
| Active duplicate index build | Yes | Refresh periodically or incrementally |
| Incoming JSON validation | No | Yes |
| Live request structured text | No | Yes |
| Live request embedding | No | Yes |
| Category inference search | No | Yes |
| Historical evidence search | No | Yes |
| Active duplicate search | No | Yes |
| Duplicate metadata filtering | No | Yes |
| Urgency rules scoring | No | Yes |
| Routing/evidence pack | No | Yes |

## Minimal implementation order

1. Write the historical cleaner and structured-text builder.
2. Build category taxonomy table from `service_request_type`, `division`, and `section`.
3. Generate category taxonomy embeddings and search first.
4. Generate all historical and active indexes.
5. Implement live ticket validation and structured-text creation.
6. Implement category inference with top-K uncertainty.
7. Implement duplicate candidate retrieval plus metadata filtering.
8. Implement `urgent.yaml` weighted scoring.
9. Persist evidence packs and pipeline reports.
