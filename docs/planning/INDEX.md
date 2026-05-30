# planning index

Description: Planning set for the 311 resolution engine demo.
Purpose: Capture MVP scope decisions and subsystem-level implementation direction.

Components:
- `README.md` — current implementation priority, critical path, and pitch framing.
- `deferred-proposal.md` — deferred proposal, do not read this.
- `spark-usage.md` — DGX Spark/NVIDIA usage plan and judging-proof checklist.
- `agents.md` — how agents are used and how they interact with the data pipeline, full E2E data flow.
- `whatsapp-api.md` — WhatsApp/backend intake contract plus data pipeline correspondence and vector embedding pipeline for one-time artifacts and live inference. Includes implementation plan.
- `whatsapp-integration.md` — Twilio ⇄ NemoClaw ⇄ backend transport/runtime view: provider webhook, conversation layering, structured ticket webhook flow, and Twilio setup notes. Defers payload/pipeline specifics to `whatsapp-api.md`.
- `criteria.md` — judging rubric excerpts used to prioritize work.
- `nvidia-suggestion.md` — archived suggestion notes (reference-only).
- `nemoclaw.md` / `nemoclaw-arch.md` / `text.md` — NemoClaw-focused concept notes.
- `spark-env.md` — DGX Spark (GX10) Python environment layout, per-venv install/update runbook, and Docker/NemoClaw notes.

Related Indexes:
- `../INDEX.md` - top-level docs navigation
