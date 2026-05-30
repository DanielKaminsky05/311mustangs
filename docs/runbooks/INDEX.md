# runbooks index

Description: Step-by-step operational runbooks for setting up and running
parts of the 311mustangs stack.
Purpose: Single source of truth for "how do I get this running" tasks.

Components:
- `twilio-setup.md` — WhatsApp Sandbox activation, Twilio CLI install,
  localhost tunnel via ngrok, webhook wiring, and outbound REST smoke test.
- `nemoclaw-bringup.md` — DGX Spark / GX10 bringup for the NemoClaw sandbox:
  Ollama on `0.0.0.0`, `nemoclaw onboard` with `gemma4:26b`, port forwarding
  for inbound messages, custom egress preset for the laptop backend.

Related Indexes:
- `../planning/INDEX.md` — planning docs map (architecture, contracts).
- `../INDEX.md` — top-level docs map.
