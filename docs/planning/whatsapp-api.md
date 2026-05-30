# WhatsApp API and 311 embedding data pipeline

This document defines the WhatsApp/NemoClaw intake payload, the backend-normalized ticket shape, and how those records map to concrete data pipeline responsibilities.

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

## WhatsApp to backend ticket submission contract

The WhatsApp/NemoClaw agent submits an **intake payload**, not a backend decision record. The agent collects facts and explicit user answers only. It must not classify final category, urgency, duplicate status, routing, or scheduling.

The backend owns:

```text
ticket_id generation
reported_at timestamping
location normalization
conversion of safety_answers into canonical hazard/risk signals
category inference
duplicate detection
urgency scoring
routing
```

### Intake request payload

```json
{
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
  "safety_answers": {
    "injury": "no",
    "active_danger": "no",
    "blocking_road": "no",
    "blocking_sidewalk": "no",
    "flooding": "no",
    "sewage_or_water_issue": "no",
    "traffic_signal_issue": "no"
  },
  "media_refs": []
}
```

Allowed `safety_answers` values:

```text
yes       # user explicitly answered yes, or directly stated the condition
no        # user explicitly answered no
unknown   # not answered, unclear, or not safe for the agent to infer
```

`yes` must be grounded in the user's explicit answer or direct statement. For example, "the traffic lights are completely out" can become `traffic_signal_issue=yes`; vague language should remain `unknown` until the agent asks a follow-up.

Minimum required fields for the intake endpoint:

```text
description
location.raw_text or at least one structured location field
observed_at, if the user can provide it; otherwise backend may use reported_at
safety_answers object with all expected keys, allowing unknown values
```

### Endpoint proposal

Because WhatsApp delivery is webhook-oriented, separate two concepts:

```text
External WhatsApp provider webhook     # raw Meta/WhatsApp message events, if we receive them directly
Structured WhatsApp ticket webhook     # NemoClaw/intake agent has already gathered enough info and submits a ticket
```

This document defines the **structured ticket webhook**, not the raw Meta WhatsApp webhook payload.

Use this endpoint for the WhatsApp/NemoClaw agent to submit a completed structured ticket:

```http
POST /api/v1/webhooks/whatsapp/ticket-submissions
Content-Type: application/json
```

Webhook request body:

```json
{
  "event_id": "wa-ticket-submission-000001",
  "event_type": "ticket.submitted",
  "event_version": "2026-05-30",
  "sent_at": "2026-01-15T20:01:02Z",
  "channel": {
    "provider": "whatsapp",
    "conversation_id": "whatsapp-conversation-abc",
    "sender_id_hash": "sha256:...",
    "message_ids": ["wamid...."]
  },
  "ticket": {
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
    "safety_answers": {
      "injury": "no",
      "active_danger": "no",
      "blocking_road": "no",
      "blocking_sidewalk": "no",
      "flooding": "no",
      "sewage_or_water_issue": "no",
      "traffic_signal_issue": "no"
    },
    "media_refs": []
  }
}
```

Webhook-level fields are for delivery, idempotency, traceability, and user/session correlation. The nested `ticket` object is the intake request payload that flows into validation and normalization.

The endpoint must reject backend-owned fields inside `ticket`, such as `ticket_id`, `reported_at`, `hazard_flags`, `category_candidates`, `urgency_score`, `duplicate_decision`, or `route`.

If this backend later receives raw Meta WhatsApp events directly, add separate endpoints such as:

```http
GET  /api/v1/webhooks/whatsapp       # provider challenge/verification
POST /api/v1/webhooks/whatsapp       # raw provider message events
```

Those raw webhook endpoints should verify provider signatures and pass messages to the intake agent. They should not call the ranking pipeline until the structured ticket webhook above is submitted.

MVP response behavior:

```text
201 Created     -> ticket accepted, canonicalized, pipeline completed, evidence_pack returned
200 OK          -> NEEDS_MORE_INFO business response for agent follow-up
400 Bad Request -> malformed JSON or unsupported shape
422 Unprocessable Entity -> invalid enum/value types after JSON parsing
500/503         -> backend or DGX/vector service unavailable
```

Successful response shape:

```json
{
  "status": "ACCEPTED",
  "ticket_id": "ticket-123",
  "canonical_ticket": {},
  "evidence_pack": {}
}
```

Follow-up response shape:

```json
{
  "status": "NEEDS_MORE_INFO",
  "missing_fields": ["location"],
  "follow_up_prompts": [
    {
      "field": "location",
      "prompt": "Where is the issue? A nearby intersection, address, or postal area is enough."
    }
  ]
}
```

If pipeline execution is later made asynchronous, keep this webhook path for submission but return `202 Accepted` with `ticket_id` and a status URL such as `/api/v1/tickets/{ticket_id}`.

Webhook implementation requirements:

```text
validate event_id is globally unique for idempotency
persist channel conversation/message references for audit, but avoid raw phone numbers; use hashes or internal IDs
authenticate the NemoClaw/WhatsApp agent caller, e.g. HMAC signature or service token
return the same ticket/evidence result for repeated event_id deliveries
```

### Backend-normalized canonical ticket schema

After validation, the backend converts the intake payload into this canonical shape for persistence and pipeline use.

```json
{
  "ticket_id": "ticket-123",
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
  "safety_answers": {
    "injury": "no",
    "active_danger": "no",
    "blocking_road": "no",
    "blocking_sidewalk": "no",
    "flooding": "no",
    "sewage_or_water_issue": "no",
    "traffic_signal_issue": "no"
  },
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

`hazard_flags` are backend-normalized tri-state values derived from explicit `safety_answers`:

```text
yes     -> true
no      -> false
unknown -> null
```

The WhatsApp agent does not submit `hazard_flags`; it submits `safety_answers`.

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
  "postal_code_or_fsa": null,
  "intersection_street_1": "Leslie St",
  "intersection_street_2": "Finch Ave E",
  "ward": "Don Valley North (17)",
  "service_request_type": "Clean up Debris on Road",
  "division": "Transportation Services",
  "section": "Road Operations",
  "location_type": "intersection",
  "is_active": false,
  "structured_text": "Service request type: Clean up Debris on Road. Division: Transportation Services. Section: Road Operations. Status: Completed. Ward: Don Valley North (17). Intersection: Leslie St and Finch Ave E."
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

### Live request embedding/query record

Produced from the backend-normalized canonical ticket. Store both the original `safety_answers` and the backend-normalized `hazard_flags` for audit, but keep embedding text focused on positive/unknown risk signals rather than serializing every false flag.

The historical SR2026 rows do **not** include citizen complaint prose. To avoid weak retrieval, the live path uses two query texts:

```text
category_query_text   # raw citizen description + location + safety signals; used against category_taxonomy.index
retrieval_query_text  # built after category inference; adds top inferred category labels before searching historical/active indexes
```

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
  "reported_at": "2026-01-15T20:01:00",
  "safety_answers": {
    "injury": "no",
    "active_danger": "no",
    "blocking_road": "no",
    "blocking_sidewalk": "no",
    "flooding": "no",
    "sewage_or_water_issue": "no",
    "traffic_signal_issue": "no"
  },
  "hazard_flags": {
    "injury": false,
    "active_danger": false,
    "blocking_road": false,
    "blocking_sidewalk": false,
    "flooding": false,
    "sewage_or_water_issue": false,
    "traffic_signal_issue": false
  },
  "category_query_text": "Reported issue: There is graffiti on a stop sign near Wychwood and Tyrrel. Location: Wychwood Ave and Tyrrel Ave. Postal area: M6G. Safety signals reported: none.",
  "retrieval_query_text": "Reported issue: There is graffiti on a stop sign near Wychwood and Tyrrel. Inferred category candidates: Traffic or Street Name Sign - Graffiti Complaint; Road - Graffiti Complaint. Division candidates: Transportation Services. Section candidates: TMC; Road Operations. Location: Wychwood Ave and Tyrrel Ave. Postal area: M6G. Safety signals reported: none."
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
postal_code_or_fsa             # uppercase FSA, null when source value is "Intersection"
ward_number                    # parsed from values like "Don Valley North (17)"
is_active                      # status in [New, In Progress]
category_key                   # normalized service_request_type/division/section
structured_text
```

Example `location_type` and postal logic:

```text
if intersection_street_1 and intersection_street_2 are present -> location_type=intersection
else if first_3_chars_of_postal_code is present and not "Intersection" -> location_type=fsa
else -> location_type=unknown

if first_3_chars_of_postal_code == "Intersection" -> postal_code_or_fsa=null
else -> postal_code_or_fsa=uppercase(first_3_chars_of_postal_code)
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

This taxonomy is the primary category inference target for live requests. Category taxonomy text should include synonyms or aliases when obvious from historical labels or rules, because live citizen wording may differ from service-request names. Example: a citizen may say "traffic lights are out" while the taxonomy label is "Traffic Signal Repair".

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

The live embedding call must use the same `embedding_model` and `embedding_dim` as the target index. If the loaded model/dimension does not match the index manifest, fail closed rather than returning misleading neighbors.

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

### Stage 1: validate incoming intake payload

Input:

```text
WhatsApp intake request payload
```

Required checks:

```text
description is non-empty
location has raw_text or at least one structured location field
observed_at can be parsed if supplied; otherwise backend will set reported_at
safety_answers object exists
safety_answers includes all expected keys
safety answer values are yes/no/unknown
media_refs, if supplied, reference server-known attachment IDs
```

If required fields are missing, return:

```text
NEEDS_MORE_INFO
```

with specific missing fields or follow-up prompts for the intake agent. `unknown` safety answers are valid values and should not be silently coerced to `no`. The backend may still return `NEEDS_MORE_INFO` when description keywords imply a possible hard-route condition but the corresponding safety answer is missing rather than `unknown`.

Backend normalization then creates:

```text
ticket_id
reported_at
normalized location fields, including order-insensitive intersection tokens, normalized FSA, and parsed ward_number when possible
canonical hazard_flags derived from safety_answers
canonical ticket record
```

### Stage 2: build initial category query text

Input fields from the canonical ticket:

```text
description
location.raw_text
intersection_street_1
intersection_street_2
postal_code_or_fsa
ward
positive or unknown safety signals from safety_answers/hazard_flags
```

Output:

```text
live_request.category_query_text
```

Use this initial text for category inference. Do not embed raw JSON; do not serialize every false safety flag into the text.

Do **not** use `category_query_text` as the only query against historical/active service request indexes. Historical SR2026 rows lack full complaint descriptions, so direct description-to-history retrieval can miss matches unless the query is augmented with inferred category labels.

### Stage 3: category inference

Input:

```text
live_request.category_query_text embedding
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

### Stage 4: build category-augmented retrieval query

After category inference, build a second deterministic query text for historical and active duplicate retrieval.

Input:

```text
canonical ticket fields
category_candidates top K service_request_type/division/section labels
category_confidence/category_margin
positive or unknown safety signals
normalized location fields
```

Output:

```text
live_request.retrieval_query_text
```

Example:

```text
Reported issue: There is graffiti on a stop sign near Wychwood and Tyrrel.
Inferred category candidates: Traffic or Street Name Sign - Graffiti Complaint; Road - Graffiti Complaint.
Division candidates: Transportation Services.
Section candidates: TMC; Road Operations.
Location: Wychwood Ave and Tyrrel Ave. Postal area: M6G.
Safety signals reported: none.
```

Purpose:

```text
bridge the schema gap between live citizen prose and historical rows that only contain service_request_type/division/section/location metadata
improve historical similarity retrieval
improve active duplicate candidate recall
keep category uncertainty visible by including top K labels, not only the top label
```

If category inference is `UNCERTAIN_CATEGORY`, still build `retrieval_query_text` using the top K candidates, but lower duplicate confidence thresholds should not be met without strong location metadata.

### Stage 5: historical similarity retrieval

Input:

```text
live_request.retrieval_query_text embedding
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

### Stage 6: active duplicate candidate retrieval

Input:

```text
live_request.retrieval_query_text embedding
service_requests_active.index
```

Active records should include historical rows with source `status in ["New", "In Progress"]` and any live tickets that remain operationally active. For MVP, treat accepted live tickets as active duplicate candidates until they are explicitly closed, marked duplicate, or removed from the demo active queue.

Candidate rows are restricted to:

```text
historical rows: status in ["New", "In Progress"]
live tickets: active_ticket_state in ["ACCEPTED", "IN_REVIEW", "SCHEDULED"] for MVP
```

After vector retrieval, apply metadata filters/boosts over normalized fields:

```text
same or similar inferred service_request_type/category candidate distribution
same intersection pair, compared order-insensitively after street-name normalization
same FSA/postal area
same ward_number when available
recent creation_date/reported_at
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

Retrieval caveat:

```text
A high vector similarity alone is not enough for DUPLICATE.
DUPLICATE requires active status plus strong normalized location evidence and same/similar category.
If location is only ward/FSA or category is uncertain, cap the decision at POSSIBLE_DUPLICATE.
```

### Stage 7: urgency scoring

Urgency is deterministic and auditable. It is not trained directly from SR2026 labels.

Inputs:

```text
category_candidates with confidence weights
backend-normalized hazard_flags derived from explicit safety_answers
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
safety_answers.injury=yes -> hazard_flags.injury=true -> HIGH_URGENCY_HUMAN_REVIEW
safety_answers.active_danger=yes -> hazard_flags.active_danger=true -> HIGH_URGENCY_HUMAN_REVIEW
safety_answers.traffic_signal_issue=yes -> hazard_flags.traffic_signal_issue=true -> HIGH_URGENCY_HUMAN_REVIEW
```

Suggested thresholds:

```text
urgency_score >= 0.75       -> HIGH_URGENCY_HUMAN_REVIEW
0.45 <= urgency_score < .75 -> MEDIUM_REVIEW_OR_QUEUE
urgency_score < 0.45        -> LOW_URGENCY_SCHEDULING
```

### Stage 8: routing output

Final live output should be an evidence pack.

```json
{
  "ticket_id": "ticket-123",
  "normalized_ticket": {},
  "category_query_text": "Reported issue: ...",
  "retrieval_query_text": "Reported issue: ... Inferred category candidates: ...",
  "embedding_ref": {
    "embedding_model": "...",
    "embedding_dim": 1024,
    "structured_text_hash": "..."
  },
  "category_candidates": [],
  "category_confidence": 0.57,
  "category_margin": 0.27,
  "category_decision": "SUGGESTED_CATEGORY",
  "nearest_historical_records": [],
  "active_duplicate_candidates": [],
  "duplicate_score": 0.12,
  "duplicate_decision": "NOT_DUPLICATE",
  "urgency_score": 0.22,
  "urgency_decision": "LOW_URGENCY_SCHEDULING",
  "score_breakdown": {
    "category_base_score": 0.15,
    "hazard_boost_total": 0.0,
    "keyword_boost_total": 0.07,
    "penalty_total": 0.0,
    "hard_routes_triggered": []
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
| Active duplicate index build | Yes | Refresh periodically or incrementally after new active tickets |
| Incoming JSON validation | No | Yes |
| Live category query text | No | Yes |
| Live category query embedding | No | Yes |
| Category inference search | No | Yes |
| Category-augmented retrieval query text | No | Yes |
| Retrieval query embedding | No | Yes |
| Historical evidence search | No | Yes |
| Active duplicate search | No | Yes |
| Duplicate metadata filtering | No | Yes |
| Urgency rules scoring | No | Yes |
| Routing/evidence pack | No | Yes |
| Persist live ticket/evidence and update active duplicate artifacts | No | Yes |

## Minimal implementation order

1. Write the historical cleaner and structured-text builder.
2. Build category taxonomy table from `service_request_type`, `division`, and `section`.
3. Generate category taxonomy embeddings and search first.
4. Generate all historical and active indexes.
5. Implement live ticket validation and category-query text creation.
6. Implement category inference with top-K uncertainty.
7. Implement category-augmented retrieval-query text creation.
8. Implement historical and active duplicate retrieval with metadata filtering.
9. Implement `urgent.yaml` weighted scoring.
10. Persist canonical tickets, evidence packs, and pipeline reports.
11. Add live-ticket active duplicate refresh/incremental index update.
