# WhatsApp Intake Flow (Twilio + NemoClaw + FastAPI)

How a user files a 311 report over WhatsApp, and how that maps onto the contract
defined in [`whatsapp-api.md`](whatsapp-api.md). This doc is the **transport/runtime
view** (Twilio ⇄ agent ⇄ backend); `whatsapp-api.md` is the **payload/contract +
pipeline** authority. Where they overlap, `whatsapp-api.md` wins.

> **Terminology:** **OpenClaw** is the *agent runtime* that implements the intake agent;
> **NemoClaw** is the *sandbox/orchestration framework* it runs inside (host CLI + OpenShell
> gateway + versioned blueprint — see `nemoclaw-arch.md`). "openclaw" in earlier discussion =
> the OpenClaw intake agent. Because NemoClaw withholds host credentials from the sandbox and
> controls network egress, **Twilio I/O and secrets live in a host-side edge service, not in
> the agent** (see risk A1 below).
>
> **Scope:** the conversational UI *is* WhatsApp. The Next.js app is the dashboard for
> viewing submitted reports — it is **not** part of this flow.

---

## Hackathon MVP scope

> **Judging check (from `spark-usage.md` / `criteria.md`):** the hackathon scores the
> **DGX Spark / NVIDIA stack** — RAPIDS/cuDF, NIM/NeMo embeddings, cuVS/FAISS-GPU vector
> search, optional local NVIDIA LLM — **not** the NemoClaw sandbox. The WhatsApp agent is
> explicitly "an operator copilot, not the main DGX story." → **NemoClaw sandboxing (risks
> A1/A2) is NOT required for the MVP.** Run the OpenClaw agent as a plain process with the
> Twilio creds in env; add the sandbox later only if you want the extra hardening.

The MVP goal is "the loop works end-to-end live." Only a few of the risks below apply:

**MUST (loop breaks, or starves the pipeline, without these):**
- **A3 (partial) — fast Twilio ack.** Return `200` to Twilio immediately, do the work after,
  reply via REST API — or LLM/embedding latency trips Twilio's ~15s timeout → duplicate
  replies on stage. *The agent→backend leg can stay fully synchronous; the `202`-async
  pipeline is NOT needed for the MVP.*
- **A5 (state, not race) — per-sender conversation state.** One in-memory dict keyed by
  sender. Skip the locking; testers message sequentially.
- **A10 — follow-up loop exit.** Cap at ~3 follow-ups then "I'll file with what I have," or
  it can loop forever on stage.
- **Collect the required pipeline inputs, not just description.** The pipeline needs more
  than free text:
  - **`safety_answers` (all 7 keys, `yes`/`no`/`unknown`)** — a *required* contract field
    (no `201` without it) **and** the only input to urgency scoring + the injury /
    active-danger / traffic-signal hard routes. Defaulting to `unknown` is allowed to keep
    the loop short, but ask the relevant ones if you want urgency/routing to look alive.
  - **A specific location (intersection or FSA), not vague `raw_text`.** Duplicate detection
    is only strong when location is specific (`agents.md`), so the follow-up loop should push
    for an intersection/address/postal area rather than accept "near the park."

**SHOULD (cheap, likely to surface while demoing):**
- **A9 — confirm-before-submit recap** (looks smart, hides bad extractions).
- **A6 (partial) — don't crash on non-text** (voice/sticker → "please send text or a
  photo"); capturing a WhatsApp location pin's lat/long is a cheap bonus. Skip real STT.
- **A23 (partial) — a tiny simulate-a-message harness + short replies** (never dump the
  evidence pack).

**SKIP (production-only — listed below, not built for the MVP):**
- **A1, A2** — sandbox creds/egress (not running the sandbox).
- **A4** — full idempotency (fast-ack covers most double-fires).
- **A14, A16, A17** — injection / rate-limit / signature-behind-tunnel (fine to disable
  Twilio signature validation in dev).
- **A7, A8, A11, A12, A13, A15, A18, A19, A20, A21, A22, A24** — single process, English,
  one clean report per chat, don't restart mid-demo.

DGX caveat: the live path still calls DGX `embed_request` + `search_311_index` (that *is* the
judged Spark story), so A3's latency is real — but it's absorbed by the fast Twilio ack, since
the agent→backend leg isn't time-boxed by Twilio.

**Is this loop good enough for the pipeline?** For the centerpiece judged story — submit a
request → DGX embed + vector search → nearest historical 311 records → category/duplicate
decision — **yes**, as long as the loop collects `description`, a specific location, and the
`safety_answers` (see MUST above). Two notes:
- **Skipping media (A8) costs the pipeline nothing** — category/duplicate/urgency are
  **text-only**; images never feed them, so "no photo handling" is free.
- **Two duplicate-demo shapes, different needs.** Dedup *against the historical 190k corpus*
  (submit something similar to a past record) needs **zero persistence**. "Two citizens
  report the same pothole, second is deduped" needs accepted live tickets added to the active
  index mid-session — a slice of A18 that's otherwise skipped. Pick the historical-dedup demo
  to stay lean.

---

## The architecture is three layers, not one

The earlier draft of this doc incorrectly collapsed the conversation loop into the
FastAPI webhook. Per `whatsapp-api.md`, there are **three distinct responsibilities**:

```
┌─────────────────────┐   ┌──────────────────────────┐   ┌───────────────────────────┐
│ 1. Provider edge     │   │ 2. NemoClaw intake agent  │   │ 3. Backend pipeline        │
│ (raw Twilio webhook) │──▶│ (conversation + facts)    │──▶│ (validate → rank → decide) │
│                      │◀──│                           │◀──│                            │
└─────────────────────┘   └──────────────────────────┘   └───────────────────────────┘
   Twilio HTTP, signature      holds conversation state,      structured ticket webhook,
   verify, media download,     collects FACTS only, asks      validation + embedding +
   hashes sender, relays       follow-ups, submits ticket     category/dup/urgency
```

Key separation of concerns:

- **The conversation/slot-filling lives in NemoClaw (layer 2)** — not in the backend.
- **The backend (layer 3) is request/response**, not conversational. It receives a
  *completed structured ticket* and returns either an accepted evidence pack or a
  `NEEDS_MORE_INFO` response that NemoClaw uses to ask the next question.
- **Category, urgency, duplicate status, routing are backend-owned.** NemoClaw submits
  **facts only** and must not classify.

---

## Who owns which fields (from `whatsapp-api.md`)

**NemoClaw submits (intake facts):**

```text
source                # "whatsapp"
description           # citizen's words
location              # raw_text and/or intersection_street_1/2, postal_code_or_fsa, ward, lat, lng
observed_at           # if the user can provide it
safety_answers        # 7 keys, each yes | no | unknown
media_refs            # server-known attachment IDs (NOT raw Twilio URLs)
```

**Backend owns (must be rejected if NemoClaw sends them):**

```text
ticket_id, reported_at, location normalization, hazard_flags,
category_candidates, urgency_score, duplicate_decision, route
```

> ⚠️ Correction from earlier discussion: NemoClaw does **not** collect a "category".
> Category is *inferred by the backend* via vector search against the category taxonomy.
> The agent's job is facts + safety answers, nothing classified.

The 7 `safety_answers` keys (each `yes` / `no` / `unknown`):

```text
injury, active_danger, blocking_road, blocking_sidewalk,
flooding, sewage_or_water_issue, traffic_signal_issue
```

Required for a submittable ticket:

```text
description (non-empty)
location.raw_text OR at least one structured location field
safety_answers object with all 7 keys (unknown is allowed)
observed_at is optional (backend falls back to reported_at)
```

---

## End-to-end sequence

```
┌──────┐      ┌────────┐      ┌─────────────────────┐      ┌────────────────────────┐
│ User │      │ Twilio │      │ Provider edge +      │      │ Backend pipeline        │
│  WA  │      │        │      │ NemoClaw intake agent│      │ (FastAPI)               │
└──┬───┘      └───┬────┘      └──────────┬───────────┘      └───────────┬────────────┘
   │ msg (+image?)│                      │                              │
   │─────────────▶│                      │                              │
   │              │ POST raw webhook     │                              │
   │              │ (form-encoded)       │                              │
   │              │─────────────────────▶│ ① verify X-Twilio-Signature  │
   │              │◀─────────────────────│ ② return 200 fast (ack)      │
   │              │                      │ ③ download media (Twilio auth)│
   │              │                      │ ④ hash sender → conversation  │
   │              │                      │ ⑤ NemoClaw updates fact set   │
   │              │                      │                              │
   │              │                      │ POST /webhooks/whatsapp/      │
   │              │                      │      ticket-submissions (JSON)│
   │              │                      │─────────────────────────────▶│ ⑥ validate
   │              │                      │                              │    (reject backend fields)
   │              │                      │                              │ ⑦ if incomplete:
   │              │                      │◀─────────────────────────────│    200 NEEDS_MORE_INFO
   │              │                      │ ⑧ NemoClaw asks follow-up     │    {missing_fields,
   │              │ POST /Messages.json  │                              │     follow_up_prompts}
   │              │◀─────────────────────│ ⑨ send question (REST API)   │
   │  question    │                      │                              │
   │◀─────────────│                      │                              │
   │              │   (user answers; loop ①–⑨ repeats)                  │
   │              │                      │                              │
   │              │                      │ when complete: ───────────────▶ ⑩ 201 ACCEPTED
   │              │                      │◀─────────────────────────────│    {ticket_id,
   │              │ POST /Messages.json  │                              │     canonical_ticket,
   │              │◀─────────────────────│ ⑪ send confirmation          │     evidence_pack}
   │  "✅ filed"  │                      │                              │
   │◀─────────────│                      │                              │
```

**The loop is driven by the backend's `NEEDS_MORE_INFO` response**, not by a background
task inside the webhook. NemoClaw can also self-check completeness before submitting,
but the backend is the authority on whether a ticket is acceptable.

---

## Layer 1 — Provider edge (raw Twilio webhook)

The provider edge is a **host-side service** that owns the Twilio credentials — they must
not enter the agent sandbox (see risk A1). Per `whatsapp-api.md` these are *separate*
endpoints from the structured ticket webhook:

```http
GET  /api/v1/webhooks/whatsapp       # provider challenge/verification
POST /api/v1/webhooks/whatsapp       # raw provider message events
```

Responsibilities:

```text
verify provider signature (X-Twilio-Signature)
ack with 200 quickly (Twilio ~10–15s timeout)
download any media via Twilio basic auth → store → produce media_refs (server IDs)
hash the sender (sha256) — never persist raw phone numbers
hand the message to the NemoClaw intake agent
DO NOT call the ranking pipeline here — only the structured ticket webhook does that
```

Inbound Twilio fields (body is `application/x-www-form-urlencoded`, **not** JSON):

| Field | Use |
|---|---|
| `From` | sender — **hash it** (`sha256`) for the conversation key; do not store raw |
| `Body` | message text → feeds NemoClaw |
| `MessageSid` | message id → `channel.message_ids`, dedup |
| `NumMedia`, `MediaUrl0`, `MediaContentType0`, … | attachments → download, convert to `media_refs` |
| `ProfileName`, `WaId` | sender identity (still hash/avoid storing raw) |

Media download (requires Twilio basic auth):

```python
import httpx
from app.config import get_settings

async def download_twilio_media(url: str) -> bytes:
    s = get_settings()
    async with httpx.AsyncClient() as client:
        r = await client.get(url, auth=(s.twilio_account_sid, s.twilio_auth_token))
        r.raise_for_status()
        return r.content   # store it, return a server-known id for media_refs
```

---

## Layer 2 — NemoClaw intake agent (conversation + facts)

This is where the per-user state and slot-filling live. Detailed agent behavior is in
`agents.md` / `nemoclaw-arch.md`; the transport-relevant points:

```text
hold conversation state keyed by HASHED sender id
accumulate the intake fact set across messages (description, location, safety_answers, media_refs)
image is OPTIONAL evidence — text-only / image-only / both all work
when it believes the facts are sufficient, submit the structured ticket
on NEEDS_MORE_INFO, ask the returned follow_up_prompts and resubmit
on ACCEPTED, confirm to the user
respect the 24-hour WhatsApp free-form window
```

Modality handling (image is optional context, never required input):

| User sends | NemoClaw |
|---|---|
| photo + "graffiti on a stop sign at Wychwood & Tyrrel" | extract description + location; attach media_ref |
| text only | extract from text; no image needed |
| image only | analyze image; ask for location it can't see (EXIF stripped, no GPS) |
| vague ("there's a problem") | ask for description, then location, then safety answers |

Whether a photo is *required* is a policy choice; `whatsapp-api.md` does **not** list
media as a required field, so default to **photo-optional** (text-only reports valid).

---

## Layer 3 — Backend structured ticket webhook (the defined contract)

This is what the FastAPI backend implements now. **JSON**, not form-encoded.

```http
POST /api/v1/webhooks/whatsapp/ticket-submissions
Content-Type: application/json
```

Request body (envelope + nested `ticket`; see `whatsapp-api.md` for the full example):

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
    "location": { "raw_text": "Wychwood Ave and Tyrrel Ave", "intersection_street_1": "Wychwood Ave",
                  "intersection_street_2": "Tyrrel Ave", "postal_code_or_fsa": "M6G",
                  "ward": null, "latitude": null, "longitude": null },
    "observed_at": "2026-01-15T20:00:00",
    "safety_answers": { "injury": "no", "active_danger": "no", "blocking_road": "no",
                        "blocking_sidewalk": "no", "flooding": "no",
                        "sewage_or_water_issue": "no", "traffic_signal_issue": "no" },
    "media_refs": []
  }
}
```

Implementation requirements (from `whatsapp-api.md`):

```text
validate event_id is globally unique → idempotency (same result for repeated deliveries)
reject backend-owned fields inside ticket (ticket_id, reported_at, hazard_flags,
  category_candidates, urgency_score, duplicate_decision, route)
authenticate the NemoClaw caller — HMAC signature or service token (NOT Twilio signature)
persist channel/conversation/message refs for audit; never store raw phone numbers
```

Responses:

| Code | Meaning |
|---|---|
| `201 Created` | accepted, canonicalized, pipeline ran → returns `ticket_id`, `canonical_ticket`, `evidence_pack` |
| `200 OK` | `NEEDS_MORE_INFO` → returns `missing_fields` + `follow_up_prompts` for NemoClaw |
| `400 Bad Request` | malformed JSON / unsupported shape |
| `422 Unprocessable Entity` | invalid enum/value types |
| `500 / 503` | backend or DGX/vector service unavailable |
| `202 Accepted` | (future) if pipeline becomes async — returns `ticket_id` + status URL |

`NEEDS_MORE_INFO` shape NemoClaw consumes to ask the next question:

```json
{
  "status": "NEEDS_MORE_INFO",
  "missing_fields": ["location"],
  "follow_up_prompts": [
    { "field": "location",
      "prompt": "Where is the issue? A nearby intersection, address, or postal area is enough." }
  ]
}
```

Accepted shape:

```json
{ "status": "ACCEPTED", "ticket_id": "ticket-123", "canonical_ticket": {}, "evidence_pack": {} }
```

The downstream pipeline (validation → category inference → historical/active retrieval →
duplicate decision → urgency scoring → routing/evidence pack) is fully specified in
`whatsapp-api.md` — not repeated here.

---

## Outbound replies: REST API, not the CLI

Replies to the user go through the **Twilio REST API** (`client.messages.create()`),
an HTTP POST to Twilio — **not** the Twilio CLI (a manual dev tool only). We POST to
Twilio; Twilio relays to WhatsApp. We never POST to the phone directly.

```python
from twilio.rest import Client
def send_whatsapp(to: str, text: str):
    s = get_settings()
    Client(s.twilio_account_sid, s.twilio_auth_token).messages.create(
        from_=s.twilio_whatsapp_from, to=to, body=text)
```

---

## Settings additions (`app/config.py`)

```python
class Settings(BaseSettings):
    ...
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = ""        # "whatsapp:+14155238886"
    intake_agent_secret: str = ""         # HMAC/service token for the structured webhook
```

New deps (`backend/pyproject.toml`): `twilio>=9.0`, `httpx>=0.27`.

---

## Prerequisites & local setup

Status legend: ✅ done in this repo/machine · ⬜ you run once.

### 1. Python dependencies — ✅ installed
`twilio>=9.0` and `httpx>=0.27` are in `backend/pyproject.toml` and installed in the venv
(`twilio` for REST sends + signature validation, `httpx` for media download).

### 2. Twilio credentials — ✅ in `.env`
`backend/.env` (gitignored) holds `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_WHATSAPP_FROM` (= `whatsapp:+14155238886`). `app/config.py` reads them via
pydantic-settings. **ngrok needs nothing here** — it uses its own config (see below).

### 3. Twilio CLI — ✅ installed (`twilio-cli/6.2.4`), ⬜ log in
Installed globally via `npm install -g twilio-cli`. Authenticate once:
```
twilio login        # prompts for Account SID + Auth Token (both in .env) + a profile name
```
Used for **sending test messages and tailing logs** — not for the sandbox tunnel (see why
in §5).

### 4. ngrok — ✅ installed (`3.3.1`), ⬜ add authtoken
Installed via `winget install ngrok.ngrok`. One-time, machine-level (stored in
`%LOCALAPPDATA%\ngrok\ngrok.yml`, **not** the project `.env`):
```
ngrok config add-authtoken <token>   # token from dashboard.ngrok.com (free signup)
```

### 5. Why ngrok and not the Twilio CLI tunnel
Twilio can't reach `localhost`, so something must expose the local server publicly. The
Twilio CLI *does* have a built-in tunnel — but only via `phone-numbers:update <SID>`, which
targets **a number you own**. The WhatsApp **Sandbox is a shared number** whose webhook is
set in the Console, not the Numbers API, so the CLI tunnel can't target it. → On the
sandbox, use **ngrok** for the tunnel; the CLI is for sends/logs only. (A production WhatsApp
sender on an owned number *would* let the CLI tunnel — but that needs Meta verification.)

### 6. Per-test-run checklist — ⬜ each session
```
1. uvicorn (run the FastAPI app on :8000)        # the receiver
2. ngrok http 8000                                # the pipe → prints https://xxxx.ngrok-free.app
3. paste https://xxxx.ngrok-free.app/<webhook path> into:
   Console → Messaging → Try it out → WhatsApp sandbox settings → "When a message comes in"
4. testers opt in once: send `join <two-word-code>` to the sandbox number
   (code in Console → Messaging → Try it out). Opt-in expires after 72h of inactivity;
   the 24h free-form reply window applies per user.
```
⚠️ Free-tier ngrok URLs change on every restart → re-paste into the Console each time.

### 7. Production (later)
Drop ngrok + sandbox; deploy the backend to a real public URL and point Twilio at it. A
public, no-opt-in number needs a production WhatsApp Business Sender (Meta WABA + business
verification + display-name review) — start that approval early; it's the slow part.

---

## Risks, edge cases, and open problems

Severity: 🔴 architecture-level (can break the design) · 🟠 functional gap · 🟡 operational/polish.

### Architecture & credentials

**🔴 A1 — Twilio credentials must NOT live inside the agent sandbox.** Per
`nemoclaw-arch.md`, NemoClaw deliberately withholds host credentials from the sandboxed
agent and controls all egress. So the OpenClaw intake agent must **not** hold the Twilio
auth token, call `api.twilio.com`, or download Twilio media directly. → **Layer 1 (Twilio
send/receive/media) is a host-side edge service** that owns the creds; the agent only
produces message *content* and ticket *facts*. (This resolves the old "where does the raw
webhook live" question: host-side, outside the sandbox.)

**🔴 A2 — Sandbox egress allowlist.** The sandbox blocks unlisted outbound hosts, and in
headless/production runs there is no operator at the TUI to approve them. The agent's
allowed egress must explicitly include the backend structured-webhook host and
`inference.local`; anything else is silently blocked.

**🔴 A3 — Synchronous pipeline latency / availability.** The structured webhook runs embed +
three vector searches on a DGX Spark service. If that exceeds the agent→backend HTTP
timeout, or the DGX/vector service returns 500/503, every submit fails. **Decide now**
whether to return `202 Accepted` (ticket_id + status URL, push result later) instead of
retrofitting async — synchronous-only is a demo-day risk.

### Idempotency & concurrency

**🔴 A4 — Idempotency must span both layers and cover in-flight retries.** Twilio retries
inbound webhooks on slow/non-2xx responses → dedup on `MessageSid` at the edge, *separately*
from `event_id` at the backend. A retry can also arrive while the first submit is still
running → need an in-progress lock that returns the same result, not just a completed-result
cache.

**🔴 A5 — Per-conversation race conditions.** A user firing rapid messages (text, then photo,
then "actually it's Main St") produces concurrent/out-of-order POSTs that all mutate the same
fact set → last-write-wins data loss. Serialize updates per hashed sender.

### Input modalities (bigger than text + image)

**🟠 A6 — Non-text WhatsApp messages.** WhatsApp supports voice notes, video, documents,
location pins, contacts, stickers, reactions, quoted replies, and interactive button taps —
the plan handles only text + image. Notably:
- **Voice notes** are a common citizen channel → need speech-to-text before fact extraction.
- A **WhatsApp location pin** arrives as Twilio `Latitude`/`Longitude` form fields (not
  media) — capture them directly into `location.latitude/longitude`; it's the strongest
  location signal available and the plan never mentions it.
- Stickers/reactions → ignore gracefully; unsupported docs → ask for text/photo.

**🟠 A7 — Multilingual input.** Toronto is multilingual; the category taxonomy and historical
text are English, so embedding a non-English description retrieves poorly. Detect language,
reply in kind, and translate/normalize the description before embedding.

**🟠 A8 — Media is collected but never used by the pipeline.** Category, duplicate, and
urgency all run on **text** (`structured_text`). Images/voice are not embedded or scored, so
"send a photo" currently only yields evidence for human reviewers — it does **not** improve
triage. If vision should inform category/severity, that is net-new pipeline work; otherwise
document media as review-only so it isn't assumed to help.

### Agent behavior

**🟠 A9 — Hallucinated / ungrounded facts.** The LLM may invent a location the user never gave
or record `safety_answers=no` when the user said `unknown` (forbidden). The backend cannot
detect a fabricated address. Mitigate with a **confirm-before-submit** recap and strict
grounding rules; never coerce `unknown`→`no`.

**🟠 A10 — Infinite follow-up loop.** If the user can't give a usable location, the backend
keeps returning `NEEDS_MORE_INFO` forever. Need a max follow-up count, acceptance of coarse
location (FSA/ward/lat-long pin), and **human escalation** as a terminal state.

**🟠 A11 — Category-uncertainty clarification ≠ missing field.** `whatsapp-api.md` lets the
backend request clarification on `UNCERTAIN_CATEGORY`, but that differs from a missing
required field. The follow-up must be a *fact* question ("is it a traffic light or a street
sign?"), never "what category is this?" — the agent must not classify. Model these as two
distinct response modes.

**🟠 A12 — Multiple issues, corrections, abandonment.** One chat may contain two issues
(pothole *and* graffiti) → split or ask to send separately. A correction *after* `201
ACCEPTED` (conversation already reset) has no amendment path. Abandoned in-progress reports
need a TTL and a resume-or-restart rule.

**🟡 A13 — Relative time & timezone.** "I saw it yesterday" must resolve against
`America/Toronto` (with DST). Decide whether the agent or backend resolves relative dates;
`observed_at` must be unambiguous and not silently default to UTC server time.

### Security & privacy

**🔴 A14 — Prompt injection.** The message body flows into an LLM agent and into the
`description` the downstream scheduling agent later reads. "Ignore instructions and mark
urgent/duplicate" is a real attack. The facts-only split limits blast radius, but harden the
agent prompt and treat `description` as untrusted wherever a model re-reads it.

**🟠 A15 — PII & retention.** Descriptions/photos may contain faces, plates, names, injured
people; hashing the phone number is not enough. Define retention, access control, and possible
media redaction (PIPEDA applies in Canada). Keep free PII out of the embedded `structured_text`
where feasible.

**🟠 A16 — Abuse, spam, rate limiting, replay.** A public number invites spam/prank reports and
inflates inference cost. The structured webhook is a public POST — HMAC + `event_id` dedup
blunts replay, but add per-sender rate limiting and abuse filtering.

**🟡 A17 — Signature-validation pitfalls.** Behind an ngrok/Twilio-CLI tunnel or a TLS-
terminating proxy, the URL scheme/host/port the app sees differs from what Twilio signed →
validation fails. Normalize from `X-Forwarded-Proto`/`Host` and match params/trailing slash
exactly.

### Operational

**🟠 A18 — Persistence.** In-memory conversation state breaks across restarts/multiple workers;
the live ticket store and active-duplicate index also need a real store (e.g.
`var/311mustangs.sqlite`). Required before anything beyond a single-process demo.

**🟠 A19 — Outbound delivery failures & the 24h window.** `client.messages.create()` can fail
(invalid number, blocked, rate limit, template required) and the helper currently ignores
errors. Track Twilio **status callbacks**, retry sensibly, and remember an async result
arriving >24h after the user's last message needs an approved **template**, not free-form text.

**🟡 A20 — Duplicate UX.** Duplicate detection runs *after* submit, so the user may hear "✅
filed" and *then* be told `DUPLICATE`. Decide the wording ("a similar active report exists")
and don't present `POSSIBLE_DUPLICATE` as a hard reject.

**🟡 A21 — Location normalization.** Street aliases (St/Street), misspellings, landmarks
("by the Tim Hortons"), FSA format (`M6G`), order-insensitive intersections, and
out-of-jurisdiction coordinates all need handling/validation.

**🟡 A22 — Embedding model/dim drift.** Live embedding must match the index manifest's
`embedding_model`/`embedding_dim`; fail closed on mismatch (per `whatsapp-api.md`).

**🟡 A23 — Observability & test harness.** Exercise the loop without a phone (Twilio CLI /
simulated POSTs) and log the flow without persisting raw PII. Keep replies under WhatsApp's
~1600-char limit — never dump the evidence pack to the user.

**🟡 A24 — Other submission channels.** If the Next.js dashboard or a web form ever submits
tickets, the `whatsapp`-specific webhook and `source` won't fit; a parallel intake path is
needed.

---

## Open items (decisions still needed)

1. **Sync vs async pipeline** (A3) — `201`-now vs `202`-async. The biggest design fork; pick
   before implementation.
2. **Voice-note / location-pin support** (A6) — in scope for MVP? Location pin is cheap and
   high-value; voice notes need STT.
3. **Vision in the pipeline** (A8) — is media review-only, or should it inform category/urgency?
4. **Agent UX guardrails** (A9/A10) — confirm-before-submit recap, max follow-ups, and the
   human-escalation terminal state.
5. **Media storage & `media_refs` minting** — the contract between the host-side edge and the
   backend for storing/resolving attachments.
6. **Agent↔backend auth** (A16) — HMAC vs service token, and how the token is injected into the
   sandbox without exposing it as a host credential.
7. **Persistence store** (A18) — conversation state + live ticket store + active-index refresh.
8. Pipeline/contract specifics remain owned by `whatsapp-api.md`; keep this doc limited to
   transport/runtime concerns to avoid drift.
```
