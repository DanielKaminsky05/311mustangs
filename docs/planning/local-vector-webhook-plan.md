# Local Vector DB and WhatsApp Text Webhook Plan

Status: current MVP implementation plan. This supersedes the richer WhatsApp intake payload and DGX-first vector plan until the local end-to-end system is working.

## Goal

Get the system running on a local dev server before optimizing the NVIDIA/DGX stack.

The MVP path is:

```text
WhatsApp user
  -> intake agent produces one strict text chunk
  -> backend parses text into SQLite fields
  -> backend embeds that exact text locally
  -> local vector DB searches for similar unresolved requests
  -> backend persists candidates and creates a dashboard review case
```

## Scope decision

### Keep

```text
Raw Twilio webhook route
Structured agent webhook route
HMAC auth for agent -> backend
hashed sender id
message id / event id traceability
backend-owned ticket ids
SQLite as app source of truth
```

### Change now

```text
Structured agent webhook payload becomes text-only.
The ticket payload should not contain images, media_refs, safety answers, hazard flags, urgency, category, route, or duplicate decisions.
The backend should parse and own all stored fields.
```

### Defer

```text
DGX Spark live embed/search
NVIDIA NIM/NeMo embeddings
RAPIDS/cuDF production ingest
Parquet-backed NNS artifacts
cuVS / FAISS-GPU optimization
image/media evidence
safety/urgency scoring
full duplicate-cluster lifecycle
```

## Structured text format

The agent must emit exactly one block that the backend can both parse and embed.

```text
TICKET_TEXT_V1
DESCRIPTION: <one sentence or short paragraph from the citizen report>
INTERSECTION: <street_1> x <street_2>
WARD: <ward name/number or UNKNOWN>
```

Example:

```text
TICKET_TEXT_V1
DESCRIPTION: There is graffiti on a stop sign near Wychwood and Tyrrel.
INTERSECTION: Wychwood Ave x Tyrrel Ave
WARD: UNKNOWN
```

Rules:

- `DESCRIPTION` is required and must be non-empty.
- `INTERSECTION` is required but may be `UNKNOWN`.
- When known, intersection format is exactly `street_1 x street_2` using lowercase `x` surrounded by spaces.
- `WARD` is required but may be `UNKNOWN`.
- Do not include images, media refs, URLs, or attachment metadata.
- Do not include JSON inside the text block.
- This exact text block is the embedding text.

## Agent webhook payload

Use the existing endpoint path unless implementation constraints make a `/text-ticket-submissions` path easier:

```http
POST /api/v1/webhooks/whatsapp/ticket-submissions
Content-Type: application/json
X-Intake-Signature: sha256=<hmac>
```

Payload:

```json
{
  "event_id": "wa_evt_01HY...",
  "event_type": "ticket.submitted",
  "event_version": "local-text-v1",
  "sent_at": "2026-05-30T20:01:02Z",
  "channel": {
    "provider": "whatsapp",
    "conversation_id": "sha256:...",
    "sender_id_hash": "sha256:...",
    "message_ids": ["SM..."]
  },
  "ticket": {
    "source": "whatsapp",
    "structured_text": "TICKET_TEXT_V1\nDESCRIPTION: There is graffiti on a stop sign near Wychwood and Tyrrel.\nINTERSECTION: Wychwood Ave x Tyrrel Ave\nWARD: UNKNOWN"
  }
}
```

Backend response:

```json
{
  "status": "ACCEPTED",
  "event_id": "wa_evt_01HY...",
  "ticket_id": "ticket_01HY...",
  "structured_text_hash": "sha256:...",
  "vector_collection": "tickets_v1",
  "vector_point_id": "ticket_01HY...",
  "review_case_id": "case_01HY..."
}
```

Idempotency rule:

```text
same event_id -> return same ticket_id, vector_point_id, and review_case_id
```

## Backend parsing behavior

Parser output:

```json
{
  "description": "There is graffiti on a stop sign near Wychwood and Tyrrel.",
  "street_1": "Wychwood Ave",
  "street_2": "Tyrrel Ave",
  "intersection_text": "Wychwood Ave x Tyrrel Ave",
  "ward": null
}
```

Parse errors:

- Missing `DESCRIPTION` -> `NEEDS_MORE_INFO` or `422`, depending whether the agent can recover.
- Missing/unknown intersection is allowed for storage, but duplicate confidence should be lower.
- Unknown ward is allowed.
- Extra unrecognized lines should be rejected at first; loosen later only if needed.

## SQLite as source of truth

SQLite stores ticket metadata, parsed fields, dashboard state, and vector refs. The vector DB stores only vectors and payload enough for fast filtering.

### `intake_events`

```text
event_id text primary key
event_type text not null
event_version text
conversation_id text not null
sender_id_hash text not null
message_ids_json text not null
request_json text not null
response_json text
response_status_code integer
created_ticket_id text
received_at datetime not null
```

### `tickets`

```text
id text primary key
source text not null
conversation_id text not null
sender_id_hash text not null
status text not null
reported_at datetime not null

description text not null
street_1 text
street_2 text
intersection_text text
ward text

structured_text text not null
structured_text_hash text not null
embedding_model text
embedding_dim integer
vector_collection text
vector_point_id text

created_at datetime not null
updated_at datetime not null
```

### `service_request_records`

```text
id text primary key
source_dataset text not null
source_record_id text not null
status text
is_unresolved integer not null default 0
opened_at datetime
closed_at datetime
service_request_type text
division text
section text
street_1 text
street_2 text
intersection_text text
ward text
structured_text text not null
structured_text_hash text
vector_collection text
vector_point_id text
raw_record_json text
unique(source_dataset, source_record_id)
```

### `duplicate_candidates`

```text
id text primary key
ticket_id text not null
candidate_type text not null          -- service_request_record | ticket
candidate_id text not null
rank integer not null
similarity_score real not null
status_at_search text
is_unresolved_at_search integer not null default 0
reason_text text
signals_json text
created_at datetime not null
```

### `review_cases`

```text
id text primary key
ticket_id text not null
state text not null                   -- PENDING_REVIEW | APPROVED | REJECTED | CLOSED
issue_summary text not null
duplicate_count integer not null default 0
unresolved_count integer not null default 0
suggestion_text text
confidence real
created_at datetime not null
updated_at datetime not null
```

### `agent_trace_events`

```text
id text primary key
case_id text not null
sequence integer not null
event_type text not null              -- tool_call | observation | reasoning | final
content_text text not null
created_at datetime not null
unique(case_id, sequence)
```

## Local embedding/vector DB plan

### Recommended MVP stack

```text
Embedding: fastembed, model BAAI/bge-small-en-v1.5 or similar small CPU model
Vector DB: Qdrant local/dev-server collection
App DB: SQLite
```

Collections:

```text
tickets_v1             -- live WhatsApp ticket text chunks
service_records_v1     -- historical/scattered dataset text chunks
```

Vector point IDs:

```text
tickets_v1 point id = ticket_id
service_records_v1 point id = service_request_records.id
```

Vector payload:

```json
{
  "sqlite_id": "ticket_01HY...",
  "kind": "ticket",
  "structured_text_hash": "sha256:...",
  "status": "ACCEPTED",
  "is_unresolved": true,
  "intersection_text": "Wychwood Ave x Tyrrel Ave",
  "ward": null
}
```

Query path:

```text
1. receive structured_text
2. hash structured_text
3. insert ticket row in SQLite
4. embed structured_text locally
5. upsert vector point where point_id = ticket_id
6. search service_records_v1 and tickets_v1
7. retrieve candidate SQLite rows by vector payload ids
8. persist duplicate_candidates
9. create/update review_case
```

Why this is good enough now:

- runs on the dev server;
- makes the dashboard usable quickly;
- keeps vectors keyed to durable SQLite IDs;
- can be replaced later by a DGX-backed implementation without changing dashboard APIs.

## Twilio bug fix plan

Current issue:

```text
backend edge receives Twilio From
agent InboundMessage supports twilio_from
sandbox_bridge does not pass twilio_from
agent cannot send replies through backend relay
```

Required changes:

```text
backend/app/whatsapp/edge_router.py
  - pass From into _forward_to_sandbox as twilio_from
  - stop printing raw From in logs; print only sender_hash and MessageSid

backend/app/whatsapp/sandbox_bridge.py
  - accept twilio_from parameter
  - include "twilio_from" in JSON payload to the agent

agent/openclaw_intake/main.py
  - already accepts twilio_from; keep in memory only
```

Tests:

```text
POST raw Twilio webhook with From
mock/capture sandbox payload
assert twilio_from is present in sandbox payload
assert no raw From is persisted in SQLite
assert duplicate MessageSid remains idempotent
```

## Dashboard API plan

```http
GET  /api/v1/dashboard/summary
GET  /api/v1/dashboard/cases?state=PENDING_REVIEW
GET  /api/v1/dashboard/cases/{case_id}
GET  /api/v1/dashboard/cases/{case_id}/trace
POST /api/v1/dashboard/cases/{case_id}/actions
GET  /api/v1/tickets/{ticket_id}
```

Case detail should include:

```json
{
  "id": "case_01HY...",
  "state": "PENDING_REVIEW",
  "ticket": {
    "id": "ticket_01HY...",
    "description": "There is graffiti on a stop sign near Wychwood and Tyrrel.",
    "intersection_text": "Wychwood Ave x Tyrrel Ave",
    "ward": null,
    "structured_text": "TICKET_TEXT_V1\n..."
  },
  "duplicate_count": 3,
  "unresolved_count": 2,
  "candidates": [
    {
      "candidate_type": "service_request_record",
      "candidate_id": "sr2026_000123",
      "similarity_score": 0.84,
      "status": "In Progress",
      "reason": "similar text, same intersection, unresolved"
    }
  ],
  "suggestion_text": "Likely duplicate unresolved issue at the same intersection.",
  "trace": []
}
```

## NVIDIA/DGX reintegration later

Once local E2E works, replace only the embedding/vector implementation:

```text
FastEmbed local -> NIM/NeMo embedding endpoint
Qdrant local -> cuVS/FAISS-GPU service or NVIDIA-backed vector index
SQLite imported records -> RAPIDS/cuDF-produced SQLite/Parquet artifacts
local CPU ingestion -> DGX Spark preprocessing and report generation
```

Keep the API and SQLite schema stable. Only update vector refs/metadata:

```text
embedding_model
embedding_dim
vector_collection
vector_point_id
structured_text_hash
```
