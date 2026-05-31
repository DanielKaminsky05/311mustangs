# planning index

Description: Planning set for the 311 resolution engine demo.
Purpose: Capture MVP scope decisions and subsystem-level implementation direction.

Components:
- `README.md` — current system plan: WhatsApp intake → persisted SQLite ticket → local vector embedding/search → async NemoClaw duplicate/urgency analysis → government-employee dashboard.
- `local-vector-webhook-plan.md` — local-first execution plan for `TICKET_TEXT_V1`, SQLite + local vector flow, and later DGX/NVIDIA swap path.
- `whatsapp-api.md` — WhatsApp/backend intake contract plus data pipeline correspondence and vector embedding pipeline for one-time artifacts and live inference. The intake contract remains authoritative.
- `whatsapp-integration.md` — Twilio ⇄ NemoClaw ⇄ backend transport/runtime view: provider webhook, conversation layering, structured ticket webhook flow, and Twilio setup notes. Defers payload/pipeline specifics to `whatsapp-api.md`.
- `spark-usage.md` — DGX Spark/NVIDIA usage plan and judging-proof checklist.
- `spark-env.md` — DGX Spark (GX10) Python environment layout, per-venv install/update runbook, and Docker/NemoClaw notes.
- `criteria.md` — judging rubric excerpts used to prioritize work.
- `nemoclaw.md` / `nemoclaw-arch.md` — NemoClaw-focused concept notes.

Related Indexes:
- `../INDEX.md` - top-level docs navigation
- `../backend/INDEX.md` - backend specification docs
- `../db/INDEX.md` - DB-documentation boundary
