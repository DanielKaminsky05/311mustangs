# backend index

Description: FastAPI backend service for 311mustangs.
Purpose: Handle WhatsApp ingress, intake webhook validation, reply relay, and local vector upsert wiring.

Components:
- `app/main.py` — app factory, lifespan state, router registration, vector-store initialization.
- `app/config.py` — environment-backed settings (Twilio, intake HMAC, sandbox bridge, vector config).
- `app/whatsapp/edge_router.py` — Twilio webhook edge (`GET/POST /api/v1/webhooks/whatsapp`), dedupe, sandbox forward.
- `app/whatsapp/intake_router.py` — structured intake webhook (`POST /api/v1/webhooks/whatsapp/ticket-submissions`), HMAC auth, idempotency, ticket_text processing, vector upsert on ACCEPTED.
- `app/whatsapp/intake_validator.py` — `TICKET_TEXT_V1` parsing/required-field checks and ACCEPTED/NEEDS_MORE_INFO decision.
- `app/vector_store.py` — local FastEmbed + Qdrant client (collection ensure, upsert, search).
- `scripts/populate_vector_db.py` — JSONL boilerplate loader for vector backfill.
- `pyproject.toml` — project deps and test/tool config (`fastembed`, `qdrant-client`).

Tests:
- `tests/test_whatsapp_intake.py` — ticket submission contract and idempotency.
- `tests/test_whatsapp_edge.py` — Twilio edge behavior and sandbox forwarding.
- `tests/test_outbound_message.py` — live Twilio outbound smoke test (opt-in).
- `tests/test_health.py` — health/readiness endpoints.

Related Indexes:
- `../docs/backend/INDEX.md` - backend-facing specification docs
- `../docs/db/INDEX.md` - DB doc boundary and migration notes
