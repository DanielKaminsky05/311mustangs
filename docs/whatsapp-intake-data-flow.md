# WhatsApp Intake — Data Flow (with mock payloads)

End-to-end trace of one citizen report, from the WhatsApp message hitting Twilio
through to a filed ticket, with concrete mock request/response bodies at every
hop. Field names, endpoints, and headers match the code as of branch
`integrate-nemoclaw`.

> **Scope note:** the DGX reasoning pipeline is stubbed and nothing is persisted
> to a database yet — see [§7](#7-validate--run-backend-intake_routerpy) and
> [Caveats](#caveats). Media is collected but dropped before the ticket — see
> [§ Media](#media-images).

## Topology (Strategy A — all on the GX10, all localhost)

```
Citizen (WhatsApp)
   │  ① WhatsApp message
   ▼
Twilio sandbox
   │  ② HTTP form POST   (X-Twilio-Signature)
   ▼
Backend edge  :8000  POST /api/v1/webhooks/whatsapp
   │  ③ hash sender, dedupe, return 200 fast
   │  ④ fire-and-forget JSON forward
   ▼
Agent  :9000  POST /messages
   │  ⑤ extract + decide   (OpenAI-compatible /v1/chat/completions)
   ▼
Ollama :11434  qwen3.6:35b
   │
   ├─⑥a ASK  → Agent → Backend POST /api/v1/intake/replies/{conv}  (HMAC) → Twilio
   │
   └─⑥b SUBMIT → Agent → Backend POST /api/v1/webhooks/whatsapp/ticket-submissions (HMAC)
           │  ⑦ validate + run (stub) → 201 ACCEPTED
           ▼
        Agent → Backend replies (confirmation) → Twilio
```

Two trust boundaries: **Twilio ↔ edge** = `X-Twilio-Signature` (off behind the dev
tunnel). **Agent ↔ backend** = HMAC-SHA256 over the raw body with the shared
`INTAKE_AGENT_SECRET`.

---

## ① Citizen → Twilio

The citizen messages the Twilio WhatsApp sandbox number:

```
huge pothole at Bay St and King St blocking the bike lane, no injuries
```

Twilio accepts it and POSTs a webhook to the edge (the tunnel URL is configured
in the Twilio console to point at `<tunnel>/api/v1/webhooks/whatsapp`).

---

## ② Twilio → Backend edge

`POST /api/v1/webhooks/whatsapp` · `Content-Type: application/x-www-form-urlencoded`

Headers (relevant):
```
X-Twilio-Signature: 8mn... (base64 HMAC; validated only if TWILIO_VALIDATE_SIGNATURE=true)
```

Form body (mock — text-only message):
```
From=whatsapp:+15551234567
To=whatsapp:+14155238886
Body=huge pothole at Bay St and King St blocking the bike lane, no injuries
MessageSid=SM1a2b3c4d5e6f7g8h
NumMedia=0
AccountSid=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The handler only reads: `From`, `Body`, `MessageSid`, `NumMedia`,
`Latitude`/`Longitude`, and `MediaUrl{i}`. Everything else Twilio sends is ignored.

**Image variant** — if the citizen attaches a photo, Twilio adds:
```
NumMedia=1
MediaUrl0=https://api.twilio.com/2010-04-01/Accounts/ACxxxx/Messages/MM.../Media/ME...
MediaContentType0=image/jpeg
```

**Location-pin variant** — if the citizen shares a pin:
```
Latitude=43.6489
Longitude=-79.3817
```

---

## ③ Backend edge — internal processing

`edge_router.py::whatsapp_inbound`:

1. **(optional) verify** `X-Twilio-Signature` — skipped in dev (`TWILIO_VALIDATE_SIGNATURE=false`).
2. **hash sender:** `hash_sender("whatsapp:+15551234567", SENDER_HASH_SALT)`
   → `sha256:dd75701f74fc49632c3a191d7d9d9a624557b55d54c7afed53cae21faf14900d`
   (raw phone is never stored or logged downstream).
3. **dedupe:** if `MessageSid` already seen for this sender → return 200, stop.
4. **media:** collect `MediaUrl0..N` into `media_urls` (NOT downloaded here).
5. **location:** build `location_pin` from `Latitude`/`Longitude` if present.
6. **schedule** `_forward_to_sandbox` as a `BackgroundTask`.
7. **return 200 immediately** (empty body) — beats Twilio's ~15s timeout.

Response to Twilio:
```
HTTP/1.1 200 OK
(no body)
```

Backend log line:
```
Received message from whatsapp:+15551234567 (sender_hash=sha256:dd75701f...).
MessageSid=SM1a2b3c4d5e6f7g8h, text='huge pothole at Bay St and King St
blocking the bike lane, no injuries', media_count=0, location_pin=None, media_urls=[]
```

---

## ④ Backend → Agent (fire-and-forget forward)

`sandbox_bridge.py::post_inbound_message` → `POST http://localhost:9000/messages`
· `Content-Type: application/json` · `timeout=10s` (best-effort; errors swallowed)

Request body (mock):
```json
{
  "conversation_id": "sha256:dd75701f74fc49632c3a191d7d9d9a624557b55d54c7afed53cae21faf14900d",
  "sender_id_hash": "sha256:dd75701f74fc49632c3a191d7d9d9a624557b55d54c7afed53cae21faf14900d",
  "message_id": "SM1a2b3c4d5e6f7g8h",
  "text": "huge pothole at Bay St and King St blocking the bike lane, no injuries",
  "media_refs": [],
  "twilio_from": "whatsapp:+15551234567",
  "location_pin": null
}
```

> `conversation_id == sender_id_hash` (the edge keys conversations by sender hash).
> `media_refs` carries the raw Twilio URLs when present (un-fetchable downstream — see Media).
> The 10s timeout usually fires before the agent finishes inference; that's fine
> (fire-and-forget) — the agent completes independently.

---

## ⑤ Agent → Ollama (extract + decide)

`extractor.py::extract_and_decide` → `POST http://localhost:11434/v1/chat/completions`
· `timeout=180s` · model `qwen3.6:35b`

Request body (mock, abbreviated system prompt):
```json
{
  "model": "qwen3.6:35b",
  "stream": false,
  "response_format": { "type": "json_object" },
  "max_tokens": 3000,
  "messages": [
    { "role": "system", "content": "You are the 311 Toronto WhatsApp intake assistant ... output a single JSON object ..." },
    { "role": "user", "content": "{\"current_facts\":{\"description\":null,\"location\":{\"raw_text\":null,\"intersection_street_1\":null,\"intersection_street_2\":null,\"postal_code_or_fsa\":null,\"ward\":null,\"latitude\":null,\"longitude\":null},\"observed_at\":null,\"safety_answers\":{\"injury\":\"unknown\",\"active_danger\":\"unknown\",\"blocking_road\":\"unknown\",\"blocking_sidewalk\":\"unknown\",\"flooding\":\"unknown\",\"sewage_or_water_issue\":\"unknown\",\"traffic_signal_issue\":\"unknown\"}},\"follow_ups_remaining\":3,\"new_user_message\":\"huge pothole at Bay St and King St blocking the bike lane, no injuries\"}" }
  ]
}
```

Mock Ollama response (`choices[0].message.content` is itself a JSON string):
```json
{
  "id": "chatcmpl-abc123",
  "choices": [
    {
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "{\"updated_facts\":{\"description\":\"Large pothole blocking the bike lane\",\"location\":{\"raw_text\":\"Bay St and King St\",\"intersection_street_1\":\"Bay St\",\"intersection_street_2\":\"King St\"},\"safety_answers\":{\"injury\":\"no\"}},\"next_action\":\"ask\",\"follow_up\":\"Is the pothole blocking the road or sidewalk for cars/pedestrians, and is there any flooding?\"}"
      }
    }
  ],
  "usage": { "prompt_tokens": 612, "completion_tokens": 96, "total_tokens": 708 }
}
```

The agent parses `content`, merges `updated_facts` into the in-memory
`ConversationFacts` for this `sender_id_hash` (never coercing a safety `unknown`),
then branches on `next_action`. **Force-submit override:** if `follow_ups_sent >= 3`,
`next_action` is forced to `"submit"` regardless of what the model said.

---

## ⑥a ASK branch — Agent → Backend → Twilio

When `next_action == "ask"`, the agent increments `follow_ups_sent`, then relays
the question (it cannot call Twilio directly — A1).

`backend_client.send_reply` → `POST http://localhost:8000/api/v1/intake/replies/{conversation_id}`

Headers:
```
Content-Type: application/json
X-Intake-Signature: sha256=4f1c... (HMAC-SHA256 of the raw body, key=INTAKE_AGENT_SECRET)
```

Request body (mock):
```json
{
  "to": "whatsapp:+15551234567",
  "body": "Is the pothole blocking the road or sidewalk for cars/pedestrians, and is there any flooding?"
}
```

`replies_router.py` verifies HMAC, then either sends via Twilio or (dev, no creds)
short-circuits:

Mock response — **with** Twilio creds:
```json
{ "status": "sent", "message_sid": "SMxxxxxxxx", "conversation_id": "sha256:dd75701f..." }
```
Mock response — **dev, no creds:**
```json
{ "status": "skipped_no_twilio_creds" }
```

Agent returns to the edge's background caller:
```json
{ "action": "ask", "follow_up": "Is the pothole blocking the road or sidewalk for cars/pedestrians, and is there any flooding?" }
```

The citizen replies, and steps ②–⑤ repeat — accumulating facts in the same
conversation — until the model (or the 3-question cap) decides to submit.

---

## ⑥b SUBMIT branch — Agent → Backend (structured ticket)

When `next_action == "submit"`, the agent renders the accumulated facts and POSTs
the structured ticket.

`facts.to_ticket_text_v1()` →
```
TICKET_TEXT_V1
DESCRIPTION: Large pothole blocking the bike lane
INTERSECTION: Bay St x King St
WARD:
```

`backend_client.submit_ticket` →
`POST http://localhost:8000/api/v1/webhooks/whatsapp/ticket-submissions` · `timeout=60s`

Headers:
```
Content-Type: application/json
X-Intake-Signature: sha256=9ab2... (HMAC-SHA256 of the raw body, key=INTAKE_AGENT_SECRET)
```

Request body (mock — the event envelope):
```json
{
  "event_id": "wa-7f3e9c1b8a2d4e5f6071829abcdef012",
  "event_type": "ticket.submitted",
  "event_version": "2026-05-30",
  "sent_at": "2026-05-31T18:42:07.512Z",
  "channel": {
    "provider": "whatsapp",
    "conversation_id": "sha256:dd75701f74fc49632c3a191d7d9d9a624557b55d54c7afed53cae21faf14900d",
    "sender_id_hash": "sha256:dd75701f74fc49632c3a191d7d9d9a624557b55d54c7afed53cae21faf14900d",
    "message_ids": ["SM1a2b3c4d5e6f7g8h", "SM9z8y7x6w5v4u3t"]
  },
  "ticket_text": "TICKET_TEXT_V1\nDESCRIPTION: Large pothole blocking the bike lane\nINTERSECTION: Bay St x King St\nWARD: "
}
```

---

## ⑦ Validate + run (backend `intake_router.py`)

1. **HMAC verify** (`X-Intake-Signature`, constant-time) → 401 if bad.
2. **Parse JSON** (400 malformed) → **validate envelope** (`extra="forbid"`, 422 invalid).
   The `sender_id_hash` validator rejects anything containing `+` or `whatsapp:`.
3. **Idempotency:** if this `event_id` was seen before → return the *same* cached
   status + body (Twilio-retry fan-out can't double-file).
4. `validate_and_run(ticket_text)` — requires `DESCRIPTION` + `INTERSECTION`
   (**ward optional**).

### ⑦ Success → HTTP 201 ACCEPTED
```json
{
  "status": "ACCEPTED",
  "ticket_id": "ticket-4a62738b47de",
  "canonical_ticket": {
    "ticket_id": "ticket-4a62738b47de",
    "source": "whatsapp",
    "description": "Large pothole blocking the bike lane",
    "intersection": "Bay St x King St",
    "ward": "",
    "reported_at": "2026-05-31T18:42:08.103Z",
    "ticket_text": "TICKET_TEXT_V1\nDESCRIPTION: Large pothole blocking the bike lane\nINTERSECTION: Bay St x King St\nWARD: "
  },
  "evidence_pack": {
    "category_candidates": [],
    "nearest_historical_records": [],
    "active_duplicate_candidates": [],
    "duplicate_decision": "NOT_DUPLICATE",
    "urgency_decision": "LOW_URGENCY_SCHEDULING",
    "route": "SCHEDULING_AGENT",
    "note": "pipeline stub — real DGX path not yet wired"
  }
}
```
> ⚠️ `evidence_pack` is **entirely hard-coded** (the stub). No classification,
> duplicate detection, urgency, or routing actually runs. If `VECTOR_ENABLED=true`,
> a best-effort Qdrant upsert happens here; it's `false` by default. **No SQL/DB
> write occurs** — the ticket lives only in the HTTP response and an in-memory
> idempotency cache.

### ⑦ Missing required field → HTTP 200 NEEDS_MORE_INFO
```json
{
  "status": "NEEDS_MORE_INFO",
  "missing_fields": ["INTERSECTION"],
  "follow_up_prompts": [
    { "field": "INTERSECTION", "prompt": "What intersection is this near? Format: street1 x street2." }
  ]
}
```

---

## ⑧ Confirmation → citizen

On **201**, the agent stores `submitted_ticket_id` and sends a confirmation back
through the replies endpoint (same HMAC path as ⑥a):

Request body (mock):
```json
{ "to": "whatsapp:+15551234567", "body": "Thanks — your report was filed. Reference: ticket-4a62738b47de." }
```

Agent's final return value:
```json
{ "action": "accepted", "ticket_id": "ticket-4a62738b47de" }
```

On **200 NEEDS_MORE_INFO**, the agent instead relays the backend's prompt as a
follow-up and returns `{"action":"needs_more_info", ...}`, looping back to ②.

---

## Media (images)

A photo is **collected but never used**:

| Stage | What happens to the image |
|-------|---------------------------|
| ② Edge in | `MediaUrl0` captured into `media_urls` ✅ |
| ③ Edge | **Not downloaded.** `download_media()` exists but is never called (TODO) ❌ |
| ④ Forward | Raw Twilio URL passed as `media_refs` (needs Twilio basic-auth to fetch) ⚠️ |
| ⑤ Agent | Stored in `facts.media_refs`; **never sent to the LLM** (text-only `qwen3.6:35b`; the box's `llama3.2-vision:11b` is unused) ❌ |
| ⑥b Submit | **Dropped** — `to_ticket_text_v1()` / envelope carry no media ❌ |
| ⑦ Ticket | No media field exists ❌ |

To make images work: (1) edge downloads + persists + mints stable `media_ref`
IDs, (2) optionally route to a vision model, (3) carry `media_refs` into the
envelope + ticket schema + persistence.

---

## Caveats (current state)

- **Nothing is persisted** on submit — no DB row, Qdrant disabled. Ticket + idempotency cache are **in-memory**, lost on backend restart.
- **Evidence pack is a stub** — the real DGX classification/duplicate/urgency/routing pipeline is not wired (`_run_pipeline_stub`).
- **Safety data is dropped** — the agent collects 7 safety answers + `observed_at` + lat/long, but `to_ticket_text_v1()` carries only description/intersection/ward.
- **HMAC has no replay nonce**; **multi-issue-per-conversation** is unimplemented. All acceptable for the demo.
```
