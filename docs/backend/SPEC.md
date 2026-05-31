# Backend Specification (API + DB + Vector DB)

Status: current implementation + near-term target schema.

## 1) API Endpoints

Base app: `backend/app/main.py`

### Health

- `GET /health`
  - 200: `{ "status": "ok" }`
- `GET /ready`
  - 200: `{ "status": "ready" }`

### Users (scaffold)

Router: `backend/app/users.py`

- `GET /users`
  - 200: `UserOut[]`
- `POST /users`
  - body: `UserCreate { email, password(min 8) }`
  - 201: `UserOut`
  - 409: duplicate email
- `GET /users/{user_id}`
  - 200: `UserOut`
  - 404: not found
- `DELETE /users/{user_id}`
  - 204
  - 404: not found

### WhatsApp edge webhook (Twilio -> backend)

Router: `backend/app/whatsapp/edge_router.py`

- `GET /api/v1/webhooks/whatsapp`
  - Returns `hub.challenge` when present, else `ok`
- `POST /api/v1/webhooks/whatsapp`
  - Form fields:
    - `From` (required)
    - `Body` (default empty)
    - `MessageSid` (required)
    - `NumMedia` (default 0)
    - `Latitude`, `Longitude` (optional)
  - Behavior:
    - optional Twilio signature verification (`TWILIO_VALIDATE_SIGNATURE`)
    - sender hash derivation
    - dedupe by `MessageSid`
    - background forward to sandbox URL with:
      - `conversation_id`
      - `sender_id_hash`
      - `message_id`
      - `text`
      - `media_refs` (currently Twilio URLs passthrough)
      - `twilio_from`
      - `location_pin`
  - 200 always on normal accept path

### WhatsApp structured intake webhook (Agent -> backend)

Router: `backend/app/whatsapp/intake_router.py`

- `POST /api/v1/webhooks/whatsapp/ticket-submissions`
  - headers:
    - `X-Intake-Signature: sha256=<hex(hmac(secret, raw_body))>`
  - body model: `TicketTextSubmissionEnvelope`
    - `event_id: str`
    - `event_type: "ticket.submitted"`
    - `event_version: str`
    - `sent_at: datetime`
    - `channel: { provider, conversation_id, sender_id_hash, message_ids[] }`
    - `ticket_text: str` (TICKET_TEXT_V1)
  - Behavior:
    - HMAC verify
    - envelope validation
    - idempotent by `event_id` (cached status/body replay)
    - parse + validate `ticket_text`
    - returns:
      - 200 `NEEDS_MORE_INFO`
      - 201 `ACCEPTED`
    - on ACCEPTED and vector client enabled: embeds/upserts `ticket_text` to Qdrant (best-effort)

### Outbound reply relay (Agent -> backend -> Twilio)

Router: `backend/app/whatsapp/replies_router.py`

- `POST /api/v1/intake/replies/{conversation_id}`
  - headers: same HMAC signature as above
  - body: `{ to: "whatsapp:+E164", body: "..." }`
  - response:
    - 200 `{ status: "skipped_no_twilio_creds" }` when Twilio creds absent
    - 200 `{ status: "sent", message_sid, conversation_id }` on send
    - 401 bad signature
    - 400 malformed payload

---

## 2) TICKET_TEXT_V1 Contract

Expected content in `ticket_text`:

```text
TICKET_TEXT_V1
DESCRIPTION: ...
INTERSECTION: street1 x street2
WARD: ...
```

Validation rules (`backend/app/whatsapp/intake_validator.py`):

- First non-empty line must be `TICKET_TEXT_V1`
- Required keys: `DESCRIPTION`, `INTERSECTION`, `WARD`
- Missing items return `NEEDS_MORE_INFO` with prompts

---

## 3) Database Schema + Indexes (target durable MVP)

Current runtime storage is in-memory. The following SQLite schema is the recommended durable baseline.

### Tables

```sql
CREATE TABLE intake_events (
  event_id TEXT PRIMARY KEY,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE conversations (
  sender_id_hash TEXT PRIMARY KEY,
  follow_ups_sent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE seen_messages (
  sender_id_hash TEXT NOT NULL,
  message_id TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  PRIMARY KEY (sender_id_hash, message_id)
);

CREATE TABLE tickets (
  ticket_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  sender_id_hash TEXT NOT NULL,
  event_id TEXT NOT NULL,
  description TEXT NOT NULL,
  intersection_text TEXT NOT NULL,
  ward TEXT,
  ticket_text TEXT NOT NULL,
  structured_text_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  embedding_model TEXT,
  embedding_dim INTEGER,
  vector_collection TEXT,
  vector_point_id TEXT
);

CREATE TABLE duplicate_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL,
  candidate_ref TEXT NOT NULL,
  candidate_kind TEXT NOT NULL, -- ticket | service_record
  score REAL NOT NULL,
  rank INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

### Indexes

```sql
CREATE UNIQUE INDEX ux_tickets_event_id ON tickets(event_id);
CREATE INDEX ix_tickets_sender_hash ON tickets(sender_id_hash);
CREATE INDEX ix_tickets_conversation_id ON tickets(conversation_id);
CREATE INDEX ix_tickets_created_at ON tickets(created_at);

CREATE INDEX ix_dup_candidates_ticket_rank
  ON duplicate_candidates(ticket_id, rank);

CREATE INDEX ix_dup_candidates_score
  ON duplicate_candidates(score DESC);
```

---

## 4) Local Vector DB Specification (FastEmbed + Qdrant)

Implementation file: `backend/app/vector_store.py`

### Config

From `backend/app/config.py`:

- `VECTOR_ENABLED` (bool)
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `QDRANT_COLLECTION` (default `tickets_v1`)
- `EMBEDDING_MODEL` (default `BAAI/bge-small-en-v1.5`)

### Collection shape

- Distance: cosine
- Dimension: inferred from first embedding at runtime
- Point ID: `ticket_id`
- Vector input text: raw `ticket_text` (TICKET_TEXT_V1 block)

### Point payload (minimum)

```json
{
  "sqlite_id": "ticket-...",
  "structured_text_hash": "sha256:...",
  "kind": "ticket",
  "status": "ACCEPTED",
  "conversation_id": "...",
  "sender_id_hash": "sha256:..."
}
```

### Upsert/search behavior

- On successful ticket submission (`ACCEPTED`), webhook performs best-effort `upsert_ticket_text(...)`.
- Search API exists in `LocalVectorStore.search(text, limit)` for nearest-neighbor lookup.

### Backfill/population boilerplate

Script: `backend/scripts/populate_vector_db.py`

- Input: JSONL lines
  - `{ "id": "ticket-123", "text": "TICKET_TEXT_V1...", "payload": {...} }`
- Command:

```bash
uv run python scripts/populate_vector_db.py --input <path/to/file.jsonl>
```

---

## 5) Dependency requirements (uv project)

In `backend/pyproject.toml`:

- `fastembed`
- `qdrant-client`

Both are now present and lockfile-resolved in `backend/uv.lock`.
