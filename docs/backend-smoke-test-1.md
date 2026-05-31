# Backend Smoke Test 1

Generated: 2026-05-30

## TODO: tests identified but not run in this session

These checks exist or are implied by the current backend surface, but were **not** executed during this smoke pass:

- **TODO: Run the live Twilio sandbox outbound smoke test** in `backend/tests/test_outbound_message.py`
  - purpose: verify the real Twilio REST send path end to end
  - why not run: local runtime did not have Twilio creds configured, and the test requires `TEST_WHATSAPP_TO` plus a sandbox-joined destination number
- **TODO: Run reply relay with real Twilio creds** via `POST /api/v1/intake/replies/{conversation_id}`
  - purpose: verify backend HTTP reply relay -> Twilio send behavior returns `status: sent`
  - why not run: current runtime returned `skipped_no_twilio_creds`
- **TODO: Run vector-enabled smoke tests**
  - purpose: verify accepted ticket submissions trigger embedding + Qdrant upsert/search behavior
  - why not run: current runtime had `VECTOR_ENABLED=false`
- **TODO: Run durable database behavior tests after SQLite lands**
  - purpose: verify persistence, idempotency across restart, seen-message dedupe across restart, and ticket/intake record integrity
  - why not run: current backend conversation and idempotency state is still in-memory

This file records:

1. the current automated pytest coverage in `backend/tests/`,
2. the live smoke tests run against the local dev server, and
3. reproducible commands for rerunning the same checks.

## Scope and current backend behavior

Current backend state in this working tree:

- FastAPI app is running locally on `http://127.0.0.1:8000`
- WhatsApp structured intake is protected by HMAC via `X-Intake-Signature`
- raw Twilio edge accepts form posts
- reply relay endpoint is present
- user scaffold endpoints are present
- current conversation/idempotency state is **in-memory**
- current durable SQLite DB behavior is **not yet implemented**
- local vector behavior is gated by env config and was **not live-tested here** because `VECTOR_ENABLED=false`
- Twilio outbound send was **not live-tested here** because Twilio creds were absent; reply relay returned `skipped_no_twilio_creds`

---

## Automated pytest suite

Run the full suite with:

```bash
cd backend
uv run --extra dev pytest -q
```

Observed result during this session:

```text
19 passed, 1 skipped
```

The skipped test is the opt-in live Twilio outbound test in `tests/test_outbound_message.py`.

### Pytest inventory by file

#### `backend/tests/test_health.py`

- `test_health`
  - checks `GET /health`
  - expects `200 {"status":"ok"}`
- `test_ready`
  - checks `GET /ready`
  - expects `200 {"status":"ready"}`

#### `backend/tests/test_users.py`

- `test_create_user_returns_safe_fields`
  - `POST /users`
  - expects `201`
  - verifies response includes `id`, `email`, `created_at`
  - verifies response does **not** leak `password` or `hashed_password`
- `test_get_user_roundtrip`
  - create user, then `GET /users/{id}`
  - expects `200`
- `test_duplicate_email_conflicts`
  - create same email twice
  - expects second request `409`
- `test_get_missing_user_404`
  - `GET /users/999`
  - expects `404`
- `test_short_password_rejected`
  - `POST /users` with password shorter than 8 chars
  - expects `422`
- `test_delete_user`
  - create, delete, then fetch
  - expects `204` then `404`

#### `backend/tests/test_whatsapp_edge.py`

- `test_verify_endpoint`
  - `GET /api/v1/webhooks/whatsapp`
  - expects `200 ok`
- `test_inbound_text_message_acked`
  - unsigned dev-mode form post to raw edge webhook
  - expects `200`
- `test_duplicate_message_sid_is_idempotent`
  - same `MessageSid` twice
  - expects both `200`, with second silently deduped
- `test_location_pin_accepted`
  - raw edge post with `Latitude` and `Longitude`
  - expects `200`
- `test_twilio_from_forwarded_to_sandbox`
  - verifies `From` is forwarded internally as `twilio_from`

#### `backend/tests/test_whatsapp_intake.py`

- `test_complete_payload_accepted`
  - signed structured intake payload
  - expects `201 ACCEPTED`
- `test_missing_ward_returns_needs_more_info`
  - signed intake with blank `WARD`
  - expects `200 NEEDS_MORE_INFO`
- `test_invalid_prefix_returns_needs_more_info`
  - bad `ticket_text` prefix
  - expects `200` with missing `TICKET_TEXT_V1`
- `test_missing_signature_rejected`
  - intake without signature
  - expects `401`
- `test_idempotent_same_event_id`
  - same `event_id` twice
  - expects same `ticket_id` both times
- `test_raw_phone_in_sender_hash_rejected`
  - raw phone value in `sender_id_hash`
  - expects `422`

#### `backend/tests/test_outbound_message.py`

- `test_send_real_whatsapp_message`
  - direct live Twilio REST send via Python helper, not via curl against the local backend
  - skipped unless `TEST_WHATSAPP_TO` is set
  - requires valid Twilio creds in `backend/.env`

Run that one alone with:

```bash
cd backend
TEST_WHATSAPP_TO='whatsapp:+1YOURNUMBER' uv run --extra dev pytest tests/test_outbound_message.py -s
```

---

## Live smoke tests run against the local dev server

The following live smoke tests were run against the already-running dev server at `http://127.0.0.1:8000`.

### Health and readiness

- `GET /health` → `200`
- `GET /ready` → `200`
- `GET /api/v1/webhooks/whatsapp` → `200 ok`

### Structured intake webhook

- valid signed payload → `201 ACCEPTED`
- valid signed payload with blank `WARD` → `200 NEEDS_MORE_INFO`
- missing/bad signature → `401`
- malformed JSON with valid signature over malformed body → `400`
- extra forbidden field → `422`
- same `event_id` posted twice → same cached `ticket_id` both times

### Reply relay endpoint

- valid signed request with no Twilio creds configured → `200 {"status":"skipped_no_twilio_creds"}`
- invalid signature → `401`

### Raw Twilio edge webhook

- raw text form post → `200`
- duplicate `MessageSid` replay → `200`
- raw location-pin form post → `200`

Observed server log behavior also matched expectations:

- `401`, `400`, `422`, and `201` responses appeared for the structured intake test set
- one logged receipt for `MessageSid=SM-LIVE-SMOKE-1` indicated the first raw edge request processed normally
- replaying the same `MessageSid` still returned `200`, consistent with dedupe behavior

---

## Reproduction setup

### 1. Base URL

```bash
export BASE_URL='http://127.0.0.1:8000'
```

### 2. Intake secret

Use the same `INTAKE_AGENT_SECRET` value your backend is running with.

```bash
export INTAKE_SECRET='replace-with-your-backend-intake-secret'
```

### 3. Helper to sign request bodies

This helper generates the exact `X-Intake-Signature` header expected by the structured intake and reply relay endpoints.

```bash
sign_body() {
  BODY="$1" INTAKE_SECRET="$INTAKE_SECRET" python3 - <<'PY'
import hashlib
import hmac
import os

body = os.environ['BODY'].encode()
secret = os.environ['INTAKE_SECRET'].encode()
print('sha256=' + hmac.new(secret, body, hashlib.sha256).hexdigest())
PY
}
```

---

## Curl reproduction: health and verification

### `GET /health`

```bash
curl -i "$BASE_URL/health"
```

Expected:

```text
HTTP/1.1 200 OK
{"status":"ok"}
```

### `GET /ready`

```bash
curl -i "$BASE_URL/ready"
```

Expected:

```text
HTTP/1.1 200 OK
{"status":"ready"}
```

### `GET /api/v1/webhooks/whatsapp`

```bash
curl -i "$BASE_URL/api/v1/webhooks/whatsapp"
```

Expected:

```text
HTTP/1.1 200 OK
ok
```

---

## Curl reproduction: users scaffold

### Create user

```bash
curl -i "$BASE_URL/users" \
  -H 'Content-Type: application/json' \
  --data '{"email":"a@example.com","password":"supersecret"}'
```

Expected: `201`, response includes `id`, `email`, `created_at`, and omits password fields.

### Get created user

Replace `1` with the created id if needed.

```bash
curl -i "$BASE_URL/users/1"
```

Expected: `200` if present.

### Duplicate email conflict

Run create twice:

```bash
curl -i "$BASE_URL/users" \
  -H 'Content-Type: application/json' \
  --data '{"email":"dup@example.com","password":"supersecret"}'

curl -i "$BASE_URL/users" \
  -H 'Content-Type: application/json' \
  --data '{"email":"dup@example.com","password":"supersecret"}'
```

Expected: second response `409`.

### Missing user

```bash
curl -i "$BASE_URL/users/999"
```

Expected: `404`.

### Short password rejected

```bash
curl -i "$BASE_URL/users" \
  -H 'Content-Type: application/json' \
  --data '{"email":"short@example.com","password":"short"}'
```

Expected: `422`.

### Delete user

```bash
curl -i -X DELETE "$BASE_URL/users/1"
```

Expected: `204` if the user exists.

---

## Curl reproduction: structured intake webhook

### Valid accepted payload

```bash
BODY=$(cat <<'JSON'
{"event_id":"live-smoke-accepted-1","event_type":"ticket.submitted","event_version":"2026-05-30","sent_at":"2026-05-30T20:01:02Z","channel":{"provider":"whatsapp","conversation_id":"conv-live-smoke","sender_id_hash":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","message_ids":["wamid.live.1"]},"ticket_text":"TICKET_TEXT_V1\nDESCRIPTION: Pothole near Bay and King\nINTERSECTION: Bay St x King St W\nWARD: Ward 10"}
JSON
)
SIG=$(sign_body "$BODY")

curl -i "$BASE_URL/api/v1/webhooks/whatsapp/ticket-submissions" \
  -H 'Content-Type: application/json' \
  -H "X-Intake-Signature: $SIG" \
  --data "$BODY"
```

Expected: `201 ACCEPTED`.

### Missing `WARD` -> `NEEDS_MORE_INFO`

```bash
BODY=$(cat <<'JSON'
{"event_id":"live-smoke-missing-ward-1","event_type":"ticket.submitted","event_version":"2026-05-30","sent_at":"2026-05-30T20:01:02Z","channel":{"provider":"whatsapp","conversation_id":"conv-live-smoke","sender_id_hash":"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","message_ids":["wamid.live.2"]},"ticket_text":"TICKET_TEXT_V1\nDESCRIPTION: Pothole near Bay and King\nINTERSECTION: Bay St x King St W\nWARD: "}
JSON
)
SIG=$(sign_body "$BODY")

curl -i "$BASE_URL/api/v1/webhooks/whatsapp/ticket-submissions" \
  -H 'Content-Type: application/json' \
  -H "X-Intake-Signature: $SIG" \
  --data "$BODY"
```

Expected: `200 NEEDS_MORE_INFO`.

### Bad or missing signature -> `401`

```bash
BODY=$(cat <<'JSON'
{"event_id":"live-smoke-bad-signature-1","event_type":"ticket.submitted","event_version":"2026-05-30","sent_at":"2026-05-30T20:01:02Z","channel":{"provider":"whatsapp","conversation_id":"conv-live-smoke","sender_id_hash":"sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","message_ids":["wamid.live.3"]},"ticket_text":"TICKET_TEXT_V1\nDESCRIPTION: Pothole near Bay and King\nINTERSECTION: Bay St x King St W\nWARD: Ward 10"}
JSON
)

curl -i "$BASE_URL/api/v1/webhooks/whatsapp/ticket-submissions" \
  -H 'Content-Type: application/json' \
  --data "$BODY"
```

Expected: `401 Unauthorized`.

### Malformed JSON -> `400`

Important: the malformed body must still be signed exactly as sent.

```bash
BODY='{"event_id":"bad-json",'
SIG=$(sign_body "$BODY")

curl -i "$BASE_URL/api/v1/webhooks/whatsapp/ticket-submissions" \
  -H 'Content-Type: application/json' \
  -H "X-Intake-Signature: $SIG" \
  --data "$BODY"
```

Expected: `400 Bad Request`.

### Extra forbidden field -> `422`

```bash
BODY=$(cat <<'JSON'
{"event_id":"live-smoke-extra-field-1","event_type":"ticket.submitted","event_version":"2026-05-30","sent_at":"2026-05-30T20:01:02Z","channel":{"provider":"whatsapp","conversation_id":"conv-live-smoke","sender_id_hash":"sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","message_ids":["wamid.live.4"]},"ticket_text":"TICKET_TEXT_V1\nDESCRIPTION: Pothole near Bay and King\nINTERSECTION: Bay St x King St W\nWARD: Ward 10","unexpected":"nope"}
JSON
)
SIG=$(sign_body "$BODY")

curl -i "$BASE_URL/api/v1/webhooks/whatsapp/ticket-submissions" \
  -H 'Content-Type: application/json' \
  -H "X-Intake-Signature: $SIG" \
  --data "$BODY"
```

Expected: `422 Unprocessable Content`.

### Same `event_id` twice -> idempotent cached response

```bash
BODY=$(cat <<'JSON'
{"event_id":"live-smoke-idempotency-1","event_type":"ticket.submitted","event_version":"2026-05-30","sent_at":"2026-05-30T20:01:02Z","channel":{"provider":"whatsapp","conversation_id":"conv-live-smoke","sender_id_hash":"sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","message_ids":["wamid.live.5"]},"ticket_text":"TICKET_TEXT_V1\nDESCRIPTION: Streetlight out near Queen and Bathurst\nINTERSECTION: Queen St W x Bathurst St\nWARD: Ward 9"}
JSON
)
SIG=$(sign_body "$BODY")

curl -i "$BASE_URL/api/v1/webhooks/whatsapp/ticket-submissions" \
  -H 'Content-Type: application/json' \
  -H "X-Intake-Signature: $SIG" \
  --data "$BODY"

curl -i "$BASE_URL/api/v1/webhooks/whatsapp/ticket-submissions" \
  -H 'Content-Type: application/json' \
  -H "X-Intake-Signature: $SIG" \
  --data "$BODY"
```

Expected: both return `201` with the same `ticket_id`.

### Raw phone in `sender_id_hash` -> `422`

```bash
BODY=$(cat <<'JSON'
{"event_id":"live-smoke-raw-phone-1","event_type":"ticket.submitted","event_version":"2026-05-30","sent_at":"2026-05-30T20:01:02Z","channel":{"provider":"whatsapp","conversation_id":"conv-live-smoke","sender_id_hash":"whatsapp:+14155551234","message_ids":["wamid.live.6"]},"ticket_text":"TICKET_TEXT_V1\nDESCRIPTION: Pothole near Bay and King\nINTERSECTION: Bay St x King St W\nWARD: Ward 10"}
JSON
)
SIG=$(sign_body "$BODY")

curl -i "$BASE_URL/api/v1/webhooks/whatsapp/ticket-submissions" \
  -H 'Content-Type: application/json' \
  -H "X-Intake-Signature: $SIG" \
  --data "$BODY"
```

Expected: `422`.

### Invalid `ticket_text` prefix -> `NEEDS_MORE_INFO`

```bash
BODY=$(cat <<'JSON'
{"event_id":"live-smoke-invalid-prefix-1","event_type":"ticket.submitted","event_version":"2026-05-30","sent_at":"2026-05-30T20:01:02Z","channel":{"provider":"whatsapp","conversation_id":"conv-live-smoke","sender_id_hash":"sha256:abababababababababababababababababababababababababababababababab","message_ids":["wamid.live.7"]},"ticket_text":"DESCRIPTION: x"}
JSON
)
SIG=$(sign_body "$BODY")

curl -i "$BASE_URL/api/v1/webhooks/whatsapp/ticket-submissions" \
  -H 'Content-Type: application/json' \
  -H "X-Intake-Signature: $SIG" \
  --data "$BODY"
```

Expected: `200` with `missing_fields: ["TICKET_TEXT_V1"]`.

---

## Curl reproduction: reply relay

### Valid signed request

If Twilio creds are absent, expected result is `200 {"status":"skipped_no_twilio_creds"}`.
If Twilio creds are present, expected result is `200 {"status":"sent", ...}`.

```bash
BODY=$(cat <<'JSON'
{"to":"whatsapp:+14165550123","body":"live smoke test only"}
JSON
)
SIG=$(sign_body "$BODY")

curl -i "$BASE_URL/api/v1/intake/replies/conv-live-smoke" \
  -H 'Content-Type: application/json' \
  -H "X-Intake-Signature: $SIG" \
  --data "$BODY"
```

### Bad signature -> `401`

```bash
BODY=$(cat <<'JSON'
{"to":"whatsapp:+14165550123","body":"live smoke test only"}
JSON
)

curl -i "$BASE_URL/api/v1/intake/replies/conv-live-smoke" \
  -H 'Content-Type: application/json' \
  --data "$BODY"
```

Expected: `401 Unauthorized`.

---

## Curl reproduction: raw Twilio edge webhook

These raw edge requests are accepted in dev when `TWILIO_VALIDATE_SIGNATURE=false`.
They may trigger background forwarding to the configured sandbox URL.

### Text message

```bash
curl -i -X POST "$BASE_URL/api/v1/webhooks/whatsapp" \
  -d 'From=whatsapp%3A%2B14155551234' \
  -d 'Body=live+edge+smoke+1' \
  -d 'MessageSid=SM-LIVE-SMOKE-1' \
  -d 'NumMedia=0'
```

Expected: `200 OK`.

### Duplicate `MessageSid`

Send the exact same request again:

```bash
curl -i -X POST "$BASE_URL/api/v1/webhooks/whatsapp" \
  -d 'From=whatsapp%3A%2B14155551234' \
  -d 'Body=live+edge+smoke+1' \
  -d 'MessageSid=SM-LIVE-SMOKE-1' \
  -d 'NumMedia=0'
```

Expected: still `200 OK`, with dedupe behavior internally.

### Location pin

```bash
curl -i -X POST "$BASE_URL/api/v1/webhooks/whatsapp" \
  -d 'From=whatsapp%3A%2B14155551234' \
  -d 'Body=' \
  -d 'MessageSid=SM-LIVE-SMOKE-LOC-1' \
  -d 'NumMedia=0' \
  -d 'Latitude=43.6772' \
  -d 'Longitude=-79.4163'
```

Expected: `200 OK`.

---

## Notes and limitations

- Current idempotency and seen-message tracking are in-memory only.
  - restarting the app clears them
  - these smoke tests do **not** validate durable DB behavior yet
- `VECTOR_ENABLED=false` in the observed runtime, so the smoke tests did not validate Qdrant or local embedding behavior
- Twilio creds were absent in the observed runtime, so the reply relay test returned `skipped_no_twilio_creds`
- the opt-in outbound Twilio pytest test has no true local curl equivalent because it directly exercises the Python Twilio client rather than the FastAPI HTTP surface

## Recommended next additions

After this smoke pass, the next most useful work would be:

1. add missing pytest coverage for `replies_router.py`
2. commit a reusable smoke runner under `backend/scripts/`
3. once SQLite lands, add integration tests for durable idempotency, seen-message dedupe, and ticket persistence across app restart
