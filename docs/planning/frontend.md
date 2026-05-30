# Frontend Plan (Operator Dashboard)

This document defines what the **Next.js frontend** must be for the 311 resolution
engine: an **operator / city-planner dashboard** that surfaces audited backend
decisions, lets operators approve high-risk work, and demonstrates the DGX Spark
retrieval/grounding live to judges.

For overall solution framing read [`proposal.md`](./proposal.md); for triage
outcomes and data signals read [`data.md`](./data.md); for the DGX/NVIDIA story
read [`spark-usage.md`](./spark-usage.md); for agent/tool boundaries read
[`agents.md`](./agents.md).

**Schema source of truth:** for the canonical ticket shape (intake) and the
evidence pack shape (triage output), [`data-pipeline.md`](./data-pipeline.md) is
authoritative. This doc describes how the dashboard **renders** those shapes;
when this doc and `data-pipeline.md` disagree, `data-pipeline.md` wins.

## Scope clarification: which surface is this?

The product has **two** human-facing surfaces. Only one of them is this app.

| Surface | What it is | Is it this Next.js app? |
|---|---|---|
| **WhatsApp intake** | Citizen submits a request through a NemoClaw/OpenClaw agent over WhatsApp. | **No** — sandboxed agent harness, lives outside the web app. |
| **Operator dashboard** | City-operator console: triage outcomes, evidence, schedules, approvals, copilot chat. | **Yes — this is the `frontend/` app.** |

Because judges cannot be made to text a WhatsApp number on stage, the dashboard
**also** carries a **demo request-submission flow** (form + file upload) so a live
request can be driven end-to-end through the DGX path during judging.

## Priority discipline

`README.md` lists **frontend/dashboard polish as deprioritized / nice-to-have**,
behind the DGX Spark data pipeline. So the bar is a **thin but credible operator
console**, not a polished product. Its highest-value jobs are:

- **Usability (10 pts):** prove a real city planner could act on this tomorrow.
- **Spark-story proof:** show DGX retrieval/evidence and NVIDIA-stack metadata live.

Do not let dashboard polish consume time that belongs to the DGX pipeline.

## Framework constraints (read before writing code)

This repo is **Next.js 16.2.6 + React 19.2, App Router, with Cache Components ON**.
This is **not** the Next.js in training data. Before writing components, read
`node_modules/next/dist/docs/01-app/` and `docs/practices/nextjs-best-practices.md`.
Highest-impact rules for this dashboard:

```text
params / searchParams / cookies() / headers() are async -> always await
Server Components are the default; 'use client' only on interactive leaves
every request-time/non-deterministic component must be `use cache` OR wrapped in <Suspense>
file upload + submission handlers are Server Functions = public POST endpoints
  -> authenticate, authorize, and validate inside each one
Middleware is now Proxy (proxy.ts at project root)
```

Live, request-time pieces here (triage results, chat, upload progress, status
strip) are interactive leaves or `<Suspense>` boundaries, never statically cached.

## Required screens / components

### 1. Request intake & submission panel (demo driver)

The operator-facing way to push a request through the system live. The form
mirrors the **canonical ticket schema** that the WhatsApp/NemoClaw intake agent
produces (see [`data-pipeline.md`](./data-pipeline.md) §"Canonical backend ticket
schema" and [`agents.md`](./agents.md) §"WhatsApp / NemoClaw intake agent").

Important: `service_request_type` is **not** a form field. The backend infers
category from taxonomy search; asking the operator to pick it would short-circuit
the DGX retrieval story.

```text
fields:
  description           free-text, required
  location              raw_text + intersection_street_1/2,
                        postal_code_or_fsa, ward (optional), lat/lon (optional)
  observed_at           datetime, required (defaults to demo_clock)
  hazard_flags          7 tri-state checks (yes/no/unknown), all required:
                          injury, active_danger,
                          blocking_road, blocking_sidewalk,
                          flooding, sewage_or_water_issue,
                          traffic_signal_issue
file upload:   media_refs[] populated by upload subsystem (section 2)
demo helper:   "load scripted demo case" picker for the data.md cases
clock:         respects demo_clock = 2026-01-15 20:00 so permit/date windows line up
```

Submitting calls a backend Server Function that normalizes the request, runs the
DGX embed-and-search path, computes deterministic scores, and returns an
**evidence pack** (`data-pipeline.md` §Stage 7). The UI renders the result; it
never computes scores itself.

**`NEEDS_MORE_INFO` handling:** if required fields are missing or invalid the
backend returns `NEEDS_MORE_INFO` with a list of specific missing fields
(`data-pipeline.md` §Stage 1). The form must surface which fields need filling
and re-prompt the operator, rather than treating the response as a generic error.

Hazard flags matter because three of them — `injury`, `active_danger`,
`traffic_signal_issue` — are **hard-route triggers** that force
`HIGH_URGENCY_HUMAN_REVIEW` regardless of urgency score. The form must collect
them explicitly; "unknown" is a valid value and is not silently coerced to false.

### 2. File upload subsystem (NEW — required)

Citizens and operators must be able to **attach files to a request** — primarily
photos of the issue (graffiti, damaged sign, debris, pothole), and optionally
documents (e.g. a permit PDF for evidence). This makes the intake realistic and
unlocks an optional **vision-grounding** path on the DGX (see "Vision grounding").

**Client behaviour**

```text
input:        drag-and-drop zone + "browse" button, multiple files
preview:      thumbnail grid for images, filename/size chip for documents
remove:       per-file remove before submit
progress:     per-file upload progress + overall state (idle/uploading/done/error)
states:       empty, selected, uploading, uploaded, rejected (with reason)
```

**Accepted files and limits** (enforced on client AND server — client checks are
UX only, the Server Function is the authority):

```text
images:       image/jpeg, image/png, image/webp, image/heic
documents:    application/pdf   (optional, for permit/evidence attachments)
max size:     ~10 MB per file (tunable)
max count:    ~5 files per request (tunable)
reject:       wrong MIME/extension, oversize, too many, empty file
```

**Upload flow**

```text
Dashboard upload zone
  -> Server Function: validate (MIME sniff + size + count), assign attachment_id
  -> store bytes in local artifact store (var/uploads/<request_or_temp_id>/<attachment_id>)
  -> persist attachment metadata row (see contract below)
  -> return attachment_id(s) to the client
  -> client attaches attachment_id(s) to the request submission payload
```

**Storage decision (MVP):** store on the **dev server** under `var/uploads/`
(local filesystem), keep only **metadata + relative path** in SQLite. No external
object store / no cloud upload — this preserves the "city/citizen data stays
local" Spark story. Files never leave the local environment.

**Security rules (Server Function = public POST endpoint):**

```text
- never trust client-provided filename or content-type; sniff bytes for real MIME
- generate server-side attachment_id and storage path; never use client path
- reject anything not on the allowlist; cap size before reading full body
- strip/normalize filenames; store original name only as display metadata
- (optional) strip EXIF/GPS from images unless location is intentionally used
- associate attachment to a request; orphan temp uploads expire/clean up
```

**Vision grounding (optional, DGX stretch — strong creativity points):**
If time allows, run an attached image through a **local NVIDIA-backed vision/VLM
or classifier on the DGX Spark** to derive a category hint or text caption, then
feed that into the same deterministic `structured_text` -> embed -> search path.
This directly targets the criteria's creativity example ("using vision models to
read…") and keeps inference local. Treat as **DEFERRED stretch**; the deterministic
text path must work without it. The vision model **suggests**; it never overrides
the deterministic scores.

### 3. Triage outcome view (core screen)

For each processed request, show the **evidence pack** the backend produced
(`data-pipeline.md` §Stage 7 is authoritative). The UI displays backend-owned
values; it must **not** invent, fuse, or recompute them.

Render the four backend decisions in **parallel**, not collapsed into a single
label — this is the operator's audit surface:

```text
category_decision:    SUGGESTED_CATEGORY | UNCERTAIN_CATEGORY
duplicate_decision:   DUPLICATE | POSSIBLE_DUPLICATE | NOT_DUPLICATE
urgency_decision:     HIGH_URGENCY_HUMAN_REVIEW
                    | MEDIUM_REVIEW_OR_QUEUE
                    | LOW_URGENCY_SCHEDULING
route:                SCHEDULING_AGENT | human workflow | duplicate workflow
```

Operator dispositions (auto-scheduled, pending approval, overridden, etc.) are
**derived UI states** computed from `route` plus the approvals overlay — they
are not labels the backend emits.

Supporting fields rendered on this screen:

```text
category candidates:   top-K list with similarity, confidence, and margin
top-level scores:      urgency_score, duplicate_score,
                       category_confidence, category_margin
score breakdown:       category_base_score, hazard_boost_total,
                       keyword_boost_total, penalty_total
hazard flags:          the 7 booleans from the submitted ticket
                       (highlight hard-route flags that fired)
attachments:           thumbnails/links for media_refs
audit_refs:            linked to audit log entries; copilot chat citations
                       resolve into these
```

(Noise permit / utility-cut evidence panels remain DEFERRED until MVP — track
[`data.md`](./data.md).)

### 4. Evidence panel (DGX grounding proof)

Makes the Spark retrieval visible — this is the system's credibility.

```text
- nearest historical 311 records from DGX vector search (record ids + similarity scores)
- the structured_text that was embedded for this request
- audit-log reference id for the decision
- (DEFERRED until MVP) permit evidence for noise; utility-cut conflict evidence
```

### 5. Schedule / queue view with before/after

```text
- ranked queue / candidate insertions for auto-scheduled low-priority operations
- the active operation DAG state (read-only; no fancy graph viz for MVP)
- utility-cut demo case (DEFERRED until MVP): show Candidate A REJECTED (BLOCKED_BY_UTILITY_CUT)
  vs Candidate B ACCEPTED (window ended) — the visible "real data changed the schedule" moment
```

### 6. Human-in-the-loop approval queue

```text
- pending queue for *_PENDING_APPROVAL and HUMAN_REVIEW items
- Approve / Override actions that write back to the backend (Server Function, authorized)
- shows the evidence + scores that triggered the human gate
```

This is the "keep humans in the loop for what matters" half of the product thesis.

### 7. Operator copilot chat (HITL advising agent)

A chat panel answered by the DGX-hosted LLM **over audited evidence only**
(`agents.md`). The chat **explains** existing decisions; it never produces scores
or invents constraints.

```text
example questions the chat must answer:
  Why was this request marked duplicate?
  Why was the first schedule insertion rejected?
  What evidence requires human approval?
  Which permit resolved this noise complaint?   (DEFERRED until MVP)
```

### 8. NVIDIA / Spark status panel (judging-critical, cheap to build)

A status strip / debug panel that renders the judging-proof fields from
`spark-usage.md`. High value for the 30-pt NVIDIA Ecosystem category.

```text
gpu_enabled=true + NVIDIA device name
RAPIDS/cuDF version
embedding backend + model name (NIM / NeMo / explicit CUDA fallback)
vector-search backend (cuVS / FAISS-GPU / explicit fallback)
311 records embedded/indexed count (190k+)
open-data row counts by dataset
"no external API dependency for triage/explanation" indicator
```

Source these from `data_pipeline_runs.metrics_json` / `var/data_pipeline_report.md`.

## Backend data contract (what the frontend consumes)

The dashboard is a **read-and-approve** view over backend-owned state
(`data.md` persistence handoff). It renders these; it does not recompute them:

```text
service_requests          -> normalized 311 rows and submitted canonical tickets
                             (schema: data-pipeline.md §Canonical backend ticket schema)
request_attachments        -> uploaded file metadata (see below)   [NEW]
triage_decisions          -> full evidence pack per ticket
                             (schema: data-pipeline.md §Stage 7 routing output)
request_embeddings        -> embedding/index references (for evidence display)
operations                -> seeded/active demo operations (DAG nodes)
operation_dependencies    -> DAG / conflict edges
schedule_assignments      -> ranked/baseline schedule rows
audit_logs                -> per-stage evidence + reasoning trail; referenced
                             by triage_decisions.audit_refs[]
data_pipeline_runs        -> NVIDIA-stack metrics for the status panel
demo_cases                -> scripted canonical-ticket inputs for the intake picker
```

**Proposed `request_attachments` row (new, owned by backend):**

```text
attachment_id        (server-generated)
request_id           (nullable while temp/pre-submit; set on submission)
storage_path         (relative path under var/uploads/, server-generated)
display_name         (sanitized original filename, display only)
mime_type            (server-sniffed, not client-claimed)
size_bytes
checksum             (e.g. sha256, for dedupe/audit)
vision_caption       (optional; populated only if DGX vision grounding ran)
created_at
```

## Proposed app structure (`frontend/app/`)

A thin route layout — grow only as needed:

```text
app/
  page.tsx                 # dashboard home: live request list + status strip
  layout.tsx               # shell, nav, NVIDIA status panel slot
  submit/page.tsx          # intake form + file upload + demo-case picker
  requests/[id]/page.tsx   # triage outcome + evidence + attachments + schedule
  approvals/page.tsx       # HITL approval queue
  _components/             # client leaves: UploadZone, ScoreBreakdown, EvidenceList,
                           #   ChatPanel, ApprovalActions, SparkStatusStrip
  _actions/                # Server Functions: submitRequest, uploadAttachment,
                           #   approveDecision, askCopilot   (validate+authz inside each)
```

(Names are a starting point, not a mandate; match repo conventions as they form.)

## What NOT to build on the frontend

```text
- ranking/scoring logic in the client  (scoring is deterministic + backend-owned)
- graph/DAG visualization polish, fancy maps, real geospatial dispatch  (deprioritized)
- the WhatsApp UI  (that is the NemoClaw agent, not this app)
- external object storage / cloud upload  (keep files local for the Spark story)
- letting the copilot chat or vision model decide priority/duplicate/validity
```

## Deferred / open questions

```text
- vision grounding on DGX (image -> caption/category) — DEFERRED stretch
- EXIF/GPS handling on uploaded photos — strip by default unless location is used
- auth model for operators (who can approve) — minimal for hackathon
- temp-upload cleanup / orphan expiry policy
- noise/utility-cut evidence panels — DEFERRED until MVP (track data.md)
```
