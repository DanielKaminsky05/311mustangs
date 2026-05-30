# NemoClaw bringup on the GX10 (Ollama + gemma4:26b)

End-to-end bringup for the OpenClaw intake agent inside a NemoClaw sandbox on
`asus@gx10-4a58`. Pairs with `twilio-setup.md` — Twilio talks to the laptop
edge; the sandbox on the GX10 holds the conversation state and runs the
`gemma4:26b` slot-filling agent.

> Read `docs/planning/whatsapp-integration.md` first if you haven't. The
> "three layers, not one" section is the load-bearing diagram.

---

## Topology recap

```
Laptop (Windows)                    GX10 (Linux, aarch64)
─────────────────────               ──────────────────────────────
FastAPI :8000                       Ollama 0.0.0.0:11434
 ├─ Twilio edge   ◀── Twilio          ├─ gemma4:26b  (intake)
 └─ Structured webhook                └─ nemotron:70b (backend reasoning)

         │ POST inbound msg (LAN)
         ▼
NemoClaw sandbox (Docker, OpenClaw)
 ├─ HTTP listener :9000 (inbound from edge — forward_ports)
 ├─ Inference → inference.local → Ollama gemma4:26b (host)
 └─ Egress allowlist:
      - inference.local (host inference, always allowed)
      - <laptop-lan>:8000 (backend webhook + outbound replies)
```

Two LAN flows you must enable:

1. **Laptop → GX10:9000** — edge POSTs inbound messages into the sandbox.
2. **GX10 sandbox → Laptop:8000** — agent POSTs structured tickets + outbound
   reply text back to the edge. (Outbound Twilio sends live on the laptop;
   the sandbox never holds Twilio creds — `A1`.)

---

## 1. SSH in and confirm Ollama is healthy

```bash
ssh asus@gx10-4a58
ollama --version
ollama list
```

If `gemma4:26b` and `nemotron:70b` aren't pulled:

```bash
ollama pull gemma4:26b
ollama pull nemotron:70b
```

Confirm Ollama listens on **all interfaces** (default 127.0.0.1 won't work
from inside the Docker sandbox):

```bash
sudo ss -tlnp | grep 11434
```

You should see `0.0.0.0:11434`. If it's `127.0.0.1`, override the systemd
unit:

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_KEEP_ALIVE=-1"\n' | \
  sudo tee /etc/systemd/system/ollama.service.d/override.conf

sudo systemctl daemon-reload
sudo systemctl restart ollama
sudo ss -tlnp | grep 11434   # re-verify
```

Smoke test from the laptop (or the GX10 itself):

```bash
curl http://gx10-4a58.local:11434/api/tags
```

---

## 2. Install NemoClaw

If Docker isn't already configured for your user:

```bash
sudo usermod -aG docker $USER
newgrp docker
docker run --rm hello-world   # sanity
```

Install NemoClaw:

```bash
curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash
nemoclaw --version
```

---

## 3. Onboard the sandbox against Ollama + gemma4:26b

Non-interactive variant:

```bash
NEMOCLAW_PROVIDER=ollama \
NEMOCLAW_MODEL=gemma4:26b \
nemoclaw onboard --non-interactive --yes-i-accept-third-party-software
```

The onboarder will:

1. Resolve the OpenClaw blueprint and verify its digest.
2. Stand up an OpenShell sandbox (Docker container) named after the agent.
3. Wire inference: inside the sandbox, calls to `inference.local` route to
   Ollama at `http://gx10-4a58.local:11434` (the host).
4. Apply the default network policy — egress is closed-by-default; only
   `inference.local` is allowed.

Verify:

```bash
nemoclaw list                 # name your sandbox got
nemoclaw <name> status
nemoclaw <name> policy-list
```

Quick inference smoke test from inside the sandbox:

```bash
nemoclaw <name> shell
# inside:
curl http://inference.local/api/tags
exit
```

---

## 4. Forward a port for inbound messages

The edge service on the laptop POSTs to a small HTTP listener inside the
sandbox (the OpenClaw agent's `/messages` endpoint — see
`agent/openclaw_intake/` scaffold). Expose it through the blueprint.

Edit the sandbox blueprint config (path depends on NemoClaw install
location — typically `~/.nemoclaw/blueprints/openclaw/blueprint.yaml`).
Under `components.sandbox`, ensure:

```yaml
components:
  sandbox:
    image: "ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest"
    name: "openclaw"
    forward_ports:
      - 9000        # OpenClaw intake agent inbound listener
```

Rebuild:

```bash
nemoclaw <name> rebuild     # or `nemoclaw uninstall && nemoclaw onboard ...`
```

Confirm the host now accepts on 0.0.0.0:9000:

```bash
sudo ss -tlnp | grep 9000
```

From the laptop:

```powershell
curl http://gx10-4a58.local:9000/health
```

(Health endpoint is part of the OpenClaw agent scaffold — see step 6.)

---

## 5. Add the backend-webhook egress preset

The agent must be allowed to call the laptop's backend at port 8000 — for
both follow-up replies (POSTed back to the edge for Twilio relay) and the
final structured ticket webhook. By default this host is BLOCKED.

Create a custom preset on the GX10:

```yaml
# ~/.nemoclaw/blueprints/openclaw/policies/presets/laptop-backend.yaml
preset:
  name: laptop-backend
  description: "311mustangs backend webhook on the dev laptop"

network_policies:
  laptop_backend:
    name: laptop_backend
    endpoints:
      # Replace <LAPTOP-LAN-IP> with the laptop's LAN address (Settings →
      # Network → Properties → IPv4 address on Windows; or `ipconfig`).
      - host: <LAPTOP-LAN-IP>
        port: 8000
        protocol: rest
        enforcement: enforce
        tls: terminate
        rules:
          - allow: { method: POST, path: "/api/v1/webhooks/whatsapp/ticket-submissions" }
          - allow: { method: POST, path: "/api/v1/intake/replies/**" }
    binaries:
      - { path: /usr/bin/curl }
      - { path: /usr/local/bin/node }
      - { path: /usr/bin/python* }
```

> If the laptop's LAN IP changes (DHCP), update this file and re-apply.
> Tailscale / static reservations are nicer long-term.

Apply it:

```bash
nemoclaw <name> policy-add
# select 'laptop-backend' from the menu, or use --preset laptop-backend
nemoclaw <name> policy-list   # confirm it shows applied
```

---

## 6. Drop in the OpenClaw intake agent

See `agent/openclaw_intake/` in this repo for the agent scaffold. Copy it
into the sandbox workspace:

```bash
# from laptop
scp -r agent/openclaw_intake asus@gx10-4a58:/tmp/openclaw_intake

# on the GX10
nemoclaw <name> shell
cp -r /tmp/openclaw_intake /sandbox/
cd /sandbox/openclaw_intake
cat README.md            # follow the run instructions inside
exit
```

The agent reads two env vars set inside the sandbox:

```bash
export INTAKE_BACKEND_URL=http://<LAPTOP-LAN-IP>:8000
export INTAKE_AGENT_SECRET=<same secret as backend/.env INTAKE_AGENT_SECRET>
```

`INTAKE_AGENT_SECRET` is how the agent HMAC-signs its POSTs to the backend.
Both sides must hold the same value.

---

## 7. End-to-end smoke

1. Laptop: backend running (`uvicorn app.main:app --reload`).
2. Laptop: ngrok or Twilio tunnel pointing at `:8000/api/v1/webhooks/whatsapp`.
3. Twilio Sandbox webhook URL set to that tunnel.
4. GX10: Ollama serving gemma4:26b on 0.0.0.0:11434.
5. GX10: NemoClaw sandbox onboarded, port 9000 forwarded, laptop-backend
   preset applied, agent running inside.

From your opted-in WhatsApp, send:

> there's a pothole on bay and king

You should see (in order, in different log streams):

- `POST /api/v1/webhooks/whatsapp 200` on the laptop uvicorn log.
- `POST /messages 200` on the GX10 sandbox agent log.
- Agent log: extracted facts → if complete, `POST /ticket-submissions` to laptop.
- Laptop: `201 Created` with stub `evidence_pack`.
- Agent: replies back with confirmation text via edge → Twilio.
- Your phone: receives the confirmation.

If any step stops, the corresponding log will say so.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `curl http://inference.local/api/tags` fails inside sandbox | Ollama not on `0.0.0.0`. Re-do step 1. |
| Agent gets blocked egress popup in the NemoClaw TUI | Backend URL not in the laptop-backend preset, or LAN IP changed. |
| 401 on the structured webhook | `INTAKE_AGENT_SECRET` mismatched between backend `.env` and sandbox env. |
| Laptop can't reach `gx10-4a58.local:9000` | mDNS not resolving — use the raw IP, or add a Hosts entry. |
| Sandbox times out posting to laptop | Windows firewall blocking inbound 8000 — `New-NetFirewallRule -DisplayName "311 backend dev" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow`. |
| 24-hour reply window expired | User must message you first (free-form WhatsApp policy). |
| `gemma4:26b` says it doesn't have vision | Variant pulled is text-only; that's fine — text-only intake is supported. Set `media_refs=[]` and continue. |
