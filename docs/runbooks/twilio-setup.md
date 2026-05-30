# Twilio WhatsApp Sandbox — dev setup

End-to-end bringup for the WhatsApp intake demo on this repo. Targets the
**Twilio WhatsApp Sandbox**, not a production WABA sender. Sandbox is free,
needs no Meta approval, and lets each tester opt in with a join code.

> Production note: once we're past the demo, a public no-opt-in WhatsApp
> number requires a WhatsApp Business Sender (Meta WABA + business
> verification + display-name review). That review is the slow part —
> kick it off in parallel if a production launch is on the timeline.

---

## 0. Prerequisites

- Twilio account already created (`shaneedelstein@gmail.com` per your note).
- Backend running locally with the WhatsApp routers wired
  (`backend/app/whatsapp/`).
- Python 3.12+ on Windows; `backend/.venv` set up via `pip install -e ".[dev]"`.
- Node 18+ on Windows (for the Twilio CLI).
- Phones that can install WhatsApp (yours + anyone testing).

---

## 1. Activate the WhatsApp Sandbox

1. Sign in to <https://console.twilio.com>.
2. Left nav → **Messaging** → **Try it out** → **Send a WhatsApp message**.
3. The page shows two things you need to copy:
   - **Sandbox sender number**, formatted `+1 415 523 8886`. In code we use
     `whatsapp:+14155238886`.
   - **Join code**, of the form `join <two-word-phrase>` (e.g.
     `join needle-orchid`).
4. From your phone's WhatsApp, send `join <two-word-phrase>` to the sandbox
   number. You'll get a confirmation message back. That phone is now opted in
   for ~72 hours of inactivity.
5. Repeat step 4 for every tester. The free-form reply window per opted-in
   phone is 24 hours from the last user message — outside that, you'd need
   an approved template.

---

## 2. Grab your account credentials

Console → **Account** → **API keys & tokens** (or the dashboard widget):

- **Account SID** — starts with `AC...`
- **Auth Token** — click "View" to reveal

Copy both into `backend/.env` (create from `.env.example` if it doesn't exist):

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_real_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_VALIDATE_SIGNATURE=false
```

Why `TWILIO_VALIDATE_SIGNATURE=false` in dev: Twilio signs the request URL
exactly as it sent it. Behind ngrok / the Twilio CLI proxy the scheme/host
the app sees differs from what Twilio signed, so validation fails. **Flip
to `true` in production** behind a real TLS-terminating ingress, and
normalize `X-Forwarded-Proto`/`Host` before validating.

The `INTAKE_AGENT_SECRET` and `SENDER_HASH_SALT` should be replaced with
real random values — `openssl rand -hex 32` (or PowerShell:
`[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`).

---

## 3. Install the Twilio CLI on Windows

PowerShell:

```powershell
npm install -g twilio-cli
twilio --version
twilio login
```

`twilio login` prompts for the Account SID and Auth Token and saves a
local profile. Verify:

```powershell
twilio profiles:list
```

---

## 4. Start the backend

Separate PowerShell window:

```powershell
cd C:\Users\shane\Documents\Coding-Projects\311mustangs\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Sanity:

```powershell
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/webhooks/whatsapp
```

The second call should return `ok`.

---

## 5. Tunnel localhost to the internet

Twilio's sandbox webhook needs a public URL. Pick one:

### Option A — ngrok (most common, recommended)

```powershell
choco install ngrok       # or: scoop install ngrok
ngrok config add-authtoken <token>   # from https://dashboard.ngrok.com
ngrok http 8000
```

Note the forwarding URL, e.g. `https://abcd-12-34-56-78.ngrok-free.app`.
This is your public base.

### Option B — Twilio CLI auto-tunnel (limited — for regular numbers only)

`twilio phone-numbers:update <SID> --sms-url http://localhost:8000/...`
auto-creates a proxy, **but the WhatsApp sandbox webhook is not a regular
phone number** — there's no CLI flag to update its inbound URL. Use this
option only if you later move to a regular Twilio number for SMS.

### Option C — Cloudflare Tunnel / Tailscale Funnel

If you already have one of these wired up, point it at `localhost:8000`.
No Twilio-specific config required.

---

## 6. Point the sandbox at your tunnel

Console → **Messaging** → **Try it out** → **Send a WhatsApp message** →
**Sandbox settings** tab.

| Field | Value |
|---|---|
| WHEN A MESSAGE COMES IN | `https://<tunnel>/api/v1/webhooks/whatsapp` |
| Method | `POST` |
| STATUS CALLBACK URL | (leave blank for MVP) |

Click **Save**.

---

## 7. End-to-end smoke test

From your opted-in WhatsApp:

> hi, pothole at Bay and King

In the uvicorn log you should see a `POST /api/v1/webhooks/whatsapp 200 OK`
within ~1s. The agent reply doesn't arrive yet because the NemoClaw
sandbox isn't wired up — that's the next runbook
(`docs/runbooks/nemoclaw-bringup.md`).

For now, you can fake the outbound side from a Python REPL inside the
backend venv:

```python
from app.config import get_settings
from app.whatsapp.twilio_client import send_whatsapp

send_whatsapp(
    get_settings(),
    to="whatsapp:+1<your-e164-phone>",
    body="Test reply from the 311 backend.",
)
```

If you get the message on WhatsApp, the outbound REST path works.

---

## 8. Production hardening checklist (deferred)

- Flip `TWILIO_VALIDATE_SIGNATURE=true`, normalize `X-Forwarded-*` before
  building the URL Twilio signed.
- Rotate `TWILIO_AUTH_TOKEN` if it ever leaked into logs/PRs; same for
  `INTAKE_AGENT_SECRET` and `SENDER_HASH_SALT`.
- Move to a WhatsApp Business Sender (Meta WABA approved number).
- Subscribe to **Status callbacks** so failed deliveries are visible.
- Add rate-limit / abuse filter at the edge before forwarding to the
  sandbox (`A16` in `whatsapp-integration.md`).

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Twilio retries the webhook in < 15s | The handler took too long. The edge should return 200 immediately — work is done in `BackgroundTasks`. |
| 403 on POST /webhooks/whatsapp | `TWILIO_VALIDATE_SIGNATURE=true` behind a proxy where scheme/host differ from what Twilio signed. Set to false in dev. |
| No reply on WhatsApp | The sandbox bridge has nothing to call yet (`SANDBOX_MESSAGE_URL` empty or pointing nowhere). See `nemoclaw-bringup.md`. |
| "outside the 24-hour window" from `messages.create()` | The user hasn't messaged you in 24h. Have them send any message first; or move to template messages. |
| `Unable to create record: Twilio could not find a Channel...` | The recipient hasn't joined the sandbox with `join <code>`. |
