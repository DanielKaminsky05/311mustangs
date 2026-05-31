# Resolution Engine Planning Notes

## Current pivot

The current implementation priority is a **local-first, end-to-end duplicate review system**:

```text
WhatsApp citizen conversation
  -> OpenClaw/NemoClaw intake agent emits one formal structured text block
  -> backend parses that text into SQLite ticket fields
  -> backend embeds the same text with a local FastEmbed-style embedder
  -> local vector DB nearest-neighbor search finds semantically similar tickets/records
  -> backend checks unresolved/open status and creates a dashboard review case
  -> NemoClaw analyst agent can add a trace and suggestion
  -> government employee reviews the case in the web dashboard
```

The detailed current implementation plan is [`local-vector-webhook-plan.md`](./local-vector-webhook-plan.md).

## What changed from the old plan

The old priority was to optimize the NVIDIA/DGX vector stack first. That is now deferred. The highest-value work is getting the complete product loop running on the dev server.

Deferred until after the local system works:

```text
DGX Spark live embedding runtime
NVIDIA NIM/NeMo embedding endpoint
RAPIDS/cuDF production ingestion path
cuVS / FAISS-GPU vector search
Parquet-backed NNS artifacts
image/media ingestion
large safety/urgency schema
full scheduling optimization
```

Still important later: the NVIDIA/Spark story in [`spark-usage.md`](./spark-usage.md) should be used for the judging build once the local path is stable. The local vector service should be hidden behind interfaces so it can be swapped for DGX/NVIDIA later.

## Current backend/frontend review

What exists now:

- FastAPI app with health/readiness and a starter `users` router.
- Raw Twilio/WhatsApp edge endpoint:
  - `GET /api/v1/webhooks/whatsapp`
  - `POST /api/v1/webhooks/whatsapp`
- Structured agent intake endpoint:
  - `POST /api/v1/webhooks/whatsapp/ticket-submissions`
  - HMAC auth, backend-owned-field rejection, idempotency by `event_id`, and `NEEDS_MORE_INFO` responses.
- Intake schema currently accepts a richer JSON ticket with location, safety answers, and media refs.
- Pipeline is currently a stub in `backend/app/whatsapp/intake_validator.py`.
- Persistence is currently in-memory only; no durable SQLite app DB or local vector DB is wired in this working tree.
- Frontend is still the default Next.js starter page.

## Immediate scope

### 1. Fix the WhatsApp agent webhook contract

Keep the same endpoint path if possible, but simplify what the agent sends.

The agent should submit one formalized text block for embedding:

```text
TICKET_TEXT_V1
DESCRIPTION: Graffiti on a stop sign near Wychwood and Tyrrel.
INTERSECTION: Wychwood Ave x Tyrrel Ave
WARD: UNKNOWN
```

Rules:

- no images/media in the structured ticket payload;
- no `media_refs` in the current MVP path;
- no safety/hazard/urgency/category fields from the agent;
- backend parses this text into `description`, `street_1`, `street_2`, and `ward`;
- backend uses the same exact text block as the embedding input;
- the envelope must still include a traceable `event_id`, `conversation_id`, hashed sender id, and source message ids;
- backend generates `ticket_id` and returns it;
- vector DB point id should be the same `ticket_id` or a deterministic ref stored on the ticket.

### 2. Fix the Twilio reply bug

The raw Twilio edge receives `From`, but the sandbox message payload currently does not include `twilio_from`. The intake agent already has an optional `twilio_from` field and needs it to call the backend reply relay.

Fix plan:

```text
edge_router.whatsapp_inbound
  -> _forward_to_sandbox(..., twilio_from=From)
  -> sandbox_bridge.post_inbound_message(..., twilio_from=twilio_from)
  -> agent/openclaw_intake InboundMessage.twilio_from
```

Do not persist raw phone numbers in SQLite. Pass `twilio_from` only as transient runtime data for Twilio replies, and avoid logging it in full.

### 3. Centralize embeddings on the dev server

Use a local embedding/vector service first:

```text
SQLite app DB = source of truth for tickets, review cases, trace, and vector refs
FastEmbed-style local embedder = text -> vector
local vector DB = nearest-neighbor search keyed by ticket_id/source_record_id
```

Recommended local MVP stack:

```text
fastembed or sentence-transformers for CPU embeddings
Qdrant local/dev-server collection for vector search
SQLite for app state and dashboard data
```

Fallback if Qdrant setup costs too much time: use `sqlite-vec` or a simple in-process FAISS index, but keep the same repository/service interface.

## Minimal SQLite schema for the current MVP

This is intentionally smaller than the previous broad schema.

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
id text primary key                         -- ticket_id generated by backend
source text not null                        -- whatsapp
conversation_id text not null
sender_id_hash text not null
status text not null                        -- ACCEPTED | IN_REVIEW | DUPLICATE | RESOLVED | ERROR
reported_at datetime not null

description text not null
street_1 text
street_2 text
intersection_text text                      -- "street_1 x street_2" or UNKNOWN
ward text

structured_text text not null               -- exact TICKET_TEXT_V1 block
structured_text_hash text not null
embedding_model text
embedding_dim integer
vector_collection text
vector_point_id text                         -- usually same as ticket id

created_at datetime not null
updated_at datetime not null
```

### `service_request_records`

Historical/scattered dataset records that can be compared against tickets. Import only the fields needed for duplicate review.

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
candidate_type text not null                -- service_request_record | ticket
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
state text not null                         -- PENDING_REVIEW | APPROVED | REJECTED | CLOSED
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
event_type text not null                    -- tool_call | observation | reasoning | final
content_text text not null
created_at datetime not null
unique(case_id, sequence)
```

## Backend API plan

Keep existing transport endpoints:

```http
GET  /api/v1/webhooks/whatsapp
POST /api/v1/webhooks/whatsapp
POST /api/v1/webhooks/whatsapp/ticket-submissions
POST /api/v1/intake/replies/{conversation_id}
```

Change the structured `ticket-submissions` payload to the local text contract described above, then return:

```json
{
  "status": "ACCEPTED",
  "ticket_id": "ticket_123",
  "event_id": "wa_evt_123",
  "structured_text_hash": "sha256:...",
  "vector_collection": "tickets_v1",
  "vector_point_id": "ticket_123",
  "review_case_id": "case_123"
}
```

Dashboard endpoints for the frontend:

```http
GET  /api/v1/dashboard/summary
GET  /api/v1/dashboard/cases?state=PENDING_REVIEW
GET  /api/v1/dashboard/cases/{case_id}
GET  /api/v1/dashboard/cases/{case_id}/trace
POST /api/v1/dashboard/cases/{case_id}/actions
GET  /api/v1/tickets/{ticket_id}
```

## Implementation order

1. Update backend Pydantic schema for text-only `ticket-submissions` payload.
2. Add parser for `TICKET_TEXT_V1`.
3. Add SQLite DB module and repositories for `intake_events`, `tickets`, `duplicate_candidates`, `review_cases`, and `agent_trace_events`.
4. Persist idempotency by `event_id` in SQLite.
5. Add local embedder and vector DB service interfaces.
6. On ticket submission: parse text, persist ticket, embed text, upsert vector by `ticket_id`, run local NNS, persist candidates, create review case.
7. Fix Twilio `twilio_from` propagation to the agent.
8. Add dashboard APIs.
9. Replace the starter frontend with the review dashboard.
10. After local E2E works, swap the embedding/vector service implementation for the DGX/NVIDIA path.

## Overhaul guidance

The existing WhatsApp/Twilio edge endpoint does **not** need a full rewrite. The structured agent webhook payload does need to be simplified for the current MVP. Treat this as a contract change behind the same route, not as a transport-layer redesign.
