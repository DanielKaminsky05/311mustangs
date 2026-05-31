# project duplexity

## Submission Info

- **Team Name**: project duplexity
- **Project Description**: Duplexity is a local-first Public Services workflow for 311-style civic issue intake. It receives WhatsApp reports, runs an intake agent to normalize the report into `TICKET_TEXT_V1`, stores/validates ticket submissions in a backend API, and prepares records for duplicate-review/routing workflows.
- **Challenge selected**: Public Services
- **3–5 min demo video**: TODO
- **Repo link**: TODO
- **Deployed URL / working app capture**: TODO
- **Team roster (names, roles, contacts)**: TODO

---

## Quick Start

### 1) Backend (FastAPI)

```bash
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Health checks:

- `http://localhost:8000/health`
- `http://localhost:8000/ready`
- `http://localhost:8000/docs`

### 2) Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: `http://localhost:3000`

### 3) OpenClaw intake agent (optional local run)

```bash
cd agent/openclaw_intake
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export INTAKE_BACKEND_URL=http://localhost:8000
export INTAKE_AGENT_SECRET=change-me-please-use-openssl-rand
export INFERENCE_BASE_URL=http://host.openshell.internal:11434
export INFERENCE_MODEL=gemma4:26b

uvicorn main:app --host 0.0.0.0 --port 9000
```

---

## Tech Stack

- **Backend**: FastAPI, Pydantic Settings, HTTPX, Twilio SDK
- **Frontend**: Next.js 16, React 19
- **Agent**: FastAPI-based intake service (OpenClaw/NemoClaw runtime)
- **Security**: HMAC request signing for intake webhooks
- **Vector (local MVP path)**: FastEmbed + Qdrant (boilerplate wired)

---

## Architecture (simple)

```text
Citizen (WhatsApp)
   -> Twilio
   -> Backend Edge Webhook (/api/v1/webhooks/whatsapp)
   -> Sandbox bridge payload
   -> OpenClaw Intake Agent (/messages)
   -> Backend Intake Webhook (/api/v1/webhooks/whatsapp/ticket-submissions)
   -> Ticket validation + acceptance
   -> (optional) local embedding/vector upsert
   -> API response + outbound reply relay
```

---

## Reproduce Demo / Setup Details

### Backend env vars (`backend/.env`)

Start from `backend/.env.example`. Key variables:

```env
PROJECT_NAME=311mustangs-api
CORS_ORIGINS=["http://localhost:3000"]
SECRET_KEY=change-me

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_VALIDATE_SIGNATURE=false

INTAKE_AGENT_SECRET=change-me-please-use-openssl-rand
SANDBOX_MESSAGE_URL=http://localhost:9000/messages
SENDER_HASH_SALT=change-me-too

VECTOR_ENABLED=false
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=tickets_v1
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

### Local vector DB (optional)

1. Run local Qdrant (`localhost:6333`).
2. Set `VECTOR_ENABLED=true` in `backend/.env`.
3. Start backend.

Optional bulk load script:

```bash
cd backend
uv run python scripts/populate_vector_db.py --input path/to/tickets.jsonl
```

JSONL format:

```json
{"id":"ticket-123","text":"TICKET_TEXT_V1\nDESCRIPTION: ...\nINTERSECTION: ...\nWARD: ...","payload":{"kind":"ticket"}}
```

---

## Datasets / Synthetic Data / Provenance

TODO

---

## Known Limitations

TODO

---

## Next Steps

TODO
