# OpenClaw intake agent (NemoClaw sandbox)

The slot-filling WhatsApp intake agent. Runs inside the NemoClaw sandbox on
the GX10 — see `docs/runbooks/nemoclaw-bringup.md` for how to bring up the
sandbox. The agent never holds Twilio credentials; it talks to the laptop
backend over HTTP, and the backend relays to Twilio.

## Responsibilities (per `docs/planning/whatsapp-integration.md`)

- Receive WhatsApp messages (relayed from the laptop edge) on `POST /messages`
- Keep per-conversation fact state (description / location / safety / media)
- Call `gemma4:26b` via `host.openshell.internal:11434` to extract new facts
  and decide whether to submit or ask a follow-up
- Cap at 3 follow-ups, then submit with what we have (A10)
- POST structured ticket to the backend; on `NEEDS_MORE_INFO` ask the
  returned prompt; on `ACCEPTED` send the confirmation text
- Never classify category/urgency/duplicate — those are backend-owned

## Layout

```
agent/openclaw_intake/
├── README.md             ← this file
├── requirements.txt
├── main.py               ← FastAPI app: /health, /messages
├── state.py              ← ConversationFacts dataclass + in-memory store
├── extractor.py          ← Ollama call + JSON-mode prompt for fact extraction
├── backend_client.py     ← HMAC-signed POSTs to backend (submit, reply)
└── tests/
    └── test_extractor.py
```

## Run inside the sandbox

```bash
# from inside the NemoClaw sandbox shell
cd /sandbox/openclaw_intake
pip install -r requirements.txt
export INTAKE_BACKEND_URL=http://<LAPTOP-TAILSCALE-IP>:8000
export INTAKE_AGENT_SECRET=<same as backend .env>
export INFERENCE_BASE_URL=http://host.openshell.internal:11434  # default
export INFERENCE_MODEL=gemma4:26b
uvicorn main:app --host 0.0.0.0 --port 9000
```

The `0.0.0.0:9000` bind is what `forward_ports: [9000]` in the NemoClaw
blueprint exposes to the GX10 host — so the laptop edge can reach it at
`http://<gx10-tailscale-ip>:9000/messages`. Tailscale, not LAN: the
laptop and GX10 are on different subnets so `.local` mDNS and direct LAN
routing don't work; Tailscale gives both ends a stable address.

## Run outside the sandbox (testing)

You can run the agent on the laptop directly for fact-extraction iteration
without standing up the sandbox. It still needs an Ollama endpoint:

```powershell
$env:INTAKE_BACKEND_URL = "http://localhost:8000"
$env:INTAKE_AGENT_SECRET = "test-secret"
$env:INFERENCE_BASE_URL = "http://<gx10-tailscale-ip>:11434"   # Ollama exposes /v1/ here too
$env:INFERENCE_MODEL = "gemma4:26b"
uvicorn main:app --port 9000
```

Then simulate a message:

```powershell
curl -X POST http://localhost:9000/messages -H "Content-Type: application/json" -d '{
  "conversation_id": "conv-test",
  "sender_id_hash": "sha256:test",
  "message_id": "SM-test",
  "text": "There is graffiti on a stop sign at Wychwood and Tyrrel",
  "media_refs": []
}'
```

## Plug points

- `extractor.extract_and_decide()` — current implementation is a thin
  Ollama JSON-mode prompt. Keep it aligned with the intake-agent behavior in
  `docs/planning/whatsapp-integration.md` and the current pivot plan in
  `docs/planning/README.md`.
- `state.ConversationStore` — in-memory dict for the MVP; swap for a
  SQLite-backed store when persistence/restart-safety matters (A18).
- Multi-issue detection (A12) is unimplemented; the current loop accepts
  one ticket per conversation.
