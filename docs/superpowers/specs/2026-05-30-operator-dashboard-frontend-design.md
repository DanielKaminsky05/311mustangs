# Operator Dashboard Frontend — Design Spec

**Status:** approved design, not yet implemented
**Owner:** frontend
**Source docs (authoritative for shapes):**
[`docs/planning/frontend.md`](../../planning/frontend.md) (UI),
[`docs/planning/data-pipeline.md`](../../planning/data-pipeline.md) (canonical ticket + evidence pack),
[`docs/planning/agents.md`](../../planning/agents.md) (WhatsApp intake + reasoning agent),
[`docs/planning/proposal.md`](../../planning/proposal.md),
[`docs/planning/README.md`](../../planning/README.md) (priority discipline).

When this spec and `data-pipeline.md` disagree on a schema field, **`data-pipeline.md` wins**.

---

## 1. Context

The 311 Mustangs project is bottlenecked on the DGX Spark data and inference pipeline; the project README explicitly demotes "frontend/dashboard polish" to nice-to-have behind the DGX work. The bar for this dashboard is therefore **thin but credible operator console**, not a polished product.

Two facts shape the design:

1. **WhatsApp is not this app.** `agents.md` confirms the citizen-facing intake agent is a separate NemoClaw harness. This Next.js app is *only* the operator/city-planner console. Because judges cannot be made to text a number on stage, the dashboard carries a demo-driver intake form that fabricates the same canonical ticket the WhatsApp agent would emit.
2. **The backend is not built yet.** This design ships against in-repo JSON fixtures shaped exactly like the eventual evidence pack, with a small loader module that the backend will later replace.

## 2. Decisions taken during brainstorming

| Decision | Choice |
|---|---|
| Scope | All 8 screens from `frontend.md`, intentionally thin |
| Data source | Static JSON fixtures under `frontend/fixtures/` |
| Visual direction | City-of-Toronto civic styling (formal, neutral, blue) |
| Upload behavior | Real Server Function writes to `var/uploads/`; client validation is UX only |
| Copilot chat | Scripted canned responses keyed by `(ticket_id, question_keyword)`; swap to a real LLM endpoint later |
| Decision schema | `data-pipeline.md` evidence pack vocabulary; UI never fuses decisions into a single label |

## 3. Framework constraints

- **Next.js 16.2.6 + React 19.2 + App Router + Cache Components ON.** Not the Next.js in training data.
- `params`, `searchParams`, `cookies()`, `headers()` are **async** — always `await`.
- Server Components are the default; `'use client'` only on interactive leaves.
- Every request-time / non-deterministic component must be either `use cache` (with explicit `cacheTag` / `cacheLife`) or wrapped in `<Suspense>` — otherwise the build errors.
- Middleware is now **Proxy** (`proxy.ts` at project root).
- Server Functions are public POST endpoints — **authenticate, authorize, and validate inside each one**.
- Mobile-first Tailwind: base styles for mobile, `sm:` / `md:` / `lg:` prefixes for larger screens.

## 4. Architecture & routes

```text
frontend/
  app/
    layout.tsx                 # shell: civic header, nav rail, StatusStrip
    page.tsx                   # dashboard home
    submit/page.tsx            # intake form + UploadZone + demo-case picker
    requests/[id]/page.tsx     # triage outcome + evidence + attachments + copilot
    approvals/page.tsx         # HITL approval queue
    schedule/page.tsx          # ranked queue / DAG state (read-only table)
    uploads/[scope]/[id]/      # streamed-file route for attachment previews
    _components/               # shared client leaves + visual primitives
    _server/                   # fixture loaders, attachment store, validation
    _actions/                  # Server Functions: submitRequest,
                               #   uploadAttachment, approveDecision, askCopilot
  fixtures/                    # in-repo demo data (Section 5)
  var/uploads/                 # runtime byte storage (gitignored)
  proxy.ts                     # placeholder, no auth in MVP
```

**Rendering model.** Server Components by default; fixture loaders are `use cache` with `cacheTag('fixtures')`. The submit form, upload zone, approval action buttons, and copilot chat are the only `'use client'` leaves. Anything truly request-time (just-uploaded attachment lists keyed on a session id) is wrapped in `<Suspense>`.

**Mapping 8 screens → 5 routes.** Screen 4 ("evidence panel") is physically the three middle panels of `/requests/[id]`; Screen 7 ("copilot chat") is the right-rail panel of the same route; Screen 8 ("Spark status strip") lives in `app/layout.tsx`.

## 5. Data contract & fixtures

All shapes mirror `data-pipeline.md` exactly so swapping to the backend is a loader-swap.

### 5.1 Primary fixtures

**`fixtures/canonical_tickets.json`** — array of normalized intake records (canonical ticket schema verbatim):

```text
ticket_id, source, description,
location: { raw_text, intersection_street_1, intersection_street_2,
            postal_code_or_fsa, ward, latitude, longitude },
observed_at, reported_at,
hazard_flags: { injury, active_danger, blocking_road, blocking_sidewalk,
                flooding, sewage_or_water_issue, traffic_signal_issue },
media_refs: [ attachment_id, … ],
metadata: {}
```

**`fixtures/evidence_packs.json`** — keyed by `ticket_id`, verbatim `data-pipeline.md` §Stage 7:

```text
ticket_id,
category_candidates: [ { service_request_type, division, section,
                         similarity, confidence } ],
category_confidence, category_margin, category_decision,
nearest_historical_records: [ { record_id, similarity,
                                service_request_type, division, section,
                                ward, intersection_street_1/2, status,
                                creation_date, structured_text } ],
active_duplicate_candidates: [ … same shape … ],
duplicate_decision, duplicate_score,
urgency_score, urgency_decision,
score_breakdown: { category_base_score, hazard_boost_total,
                   keyword_boost_total, penalty_total },
route, audit_refs,
structured_text   // the live request's embedded text
```

**`fixtures/audit_logs.json`** — referenced by `audit_refs[]`; each entry captures the inputs/outputs of one pipeline stage.

### 5.2 Demo-driver fixtures

```text
pipeline_metrics.json    # Spark status strip — gpu_enabled, device,
                         # RAPIDS version, embedding model, vector backend,
                         # 311 indexed count, indexed_at
demo_cases.json          # scripted canonical tickets for the intake picker
copilot_scripts.json     # { ticket_id: { question_keyword: { text, audit_refs[] } } }
operations.json          # active operations (DAG nodes)
schedule_assignments.json # proposed insertions for LOW_URGENCY_SCHEDULING tickets
approvals_queue.json     # subset where urgency_decision == HIGH_URGENCY_HUMAN_REVIEW
                         # or route requires human approval; with status
request_attachments.json # persisted upload metadata (runtime-appended)
```

### 5.3 Loader surface (`app/_server/data.ts`)

```text
getRecentTickets()                 -> last N tickets, sorted by reported_at
getTicket(ticket_id)               -> canonical_ticket
getEvidencePack(ticket_id)         -> evidence_pack
getAuditEntries(audit_refs[])      -> audit_log[]
getApprovalsQueue()                -> pending evidence_packs
getScheduleState()                 -> { operations, candidate_insertions }
getPipelineMetrics()               -> pipeline_metrics
getDemoCases()                     -> demo_cases
getCopilotResponse(ticket_id, q)   -> { text, audit_refs[] } | null
```

Each read-only loader is `use cache` with `cacheTag('fixtures')`. Submission and approval Server Functions call `updateTag('fixtures')` (and `updateTag(\`ticket:${id}\`)` where relevant) to invalidate.

## 6. File upload Server Function

The security-sensitive piece. One Server Function, narrow validation, local storage.

**`uploadAttachment(formData)`** in `app/_actions/uploadAttachment.ts`.

Inputs:
- `FormData` with one or more `file` entries
- Optional `request_id` (when attaching to an existing record); omitted on the intake form, where uploads happen before submit and bind to a server-issued `temp_session_id` cookie

Outputs (JSON):

```text
{ attachment_id, display_name, mime_type, size_bytes, checksum, preview_url }
|
{ error_code, file_index, reason }
```

**Validation pipeline (server-authoritative):**

1. cap raw body size before reading (Next limit + per-file cap)
2. iterate FormData files; for each:
   - enforce per-file size (default 10 MB, env-tunable)
   - enforce per-request count (default 5, env-tunable)
   - sniff first 4096 bytes for real MIME — not Content-Type, not extension. Allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`. Reject anything else with `WRONG_MIME`.
   - compute `sha256` over the byte stream as it's written
   - dedupe within the session by checksum (collapse to one `attachment_id`)
   - for images, optional EXIF/GPS strip — off by default, flip on once lat/lon is wired into the canonical ticket
3. generate `attachment_id` = ULID
4. write bytes to `var/uploads/<scope>/<id>/<attachment_id>.<ext>` where extension is derived from the **sniffed** MIME, never from the client filename
5. append a metadata row to `fixtures/request_attachments.json` (the only fixture written at runtime; gitignored from real PRs)
6. return result

**Storage layout:**

```text
frontend/var/uploads/
  temp/<session_id>/<attachment_id>.<ext>     # pre-submit
  req/<request_id>/<attachment_id>.<ext>      # after submit; bind step moves files
```

On submit, `submitRequest` looks up `temp_session_id` from the cookie, moves temp files into `req/<request_id>/`, and updates `request_attachments.json` rows in place. Orphan temp dirs older than 24 h get swept at the top of any Server Function call.

**Error codes the form must handle:** `WRONG_MIME`, `FILE_TOO_LARGE`, `TOO_MANY_FILES`, `EMPTY_FILE`, `WRITE_FAILED`. Returned per-file so partial successes work.

**Preview route — `app/uploads/[scope]/[id]/route.ts`** — streams the file with `Content-Type` from the metadata row, `Content-Disposition: inline`, `Cache-Control: private, max-age=300`. Single chokepoint for any future access control.

**Out of scope:** virus scanning, image transcoding/thumbnailing, chunked/resumable uploads, signed URLs/CDN, auth on the preview route.

## 7. Civic visual system

### 7.1 Palette (CSS variables surfaced through Tailwind v4 `@theme`)

```text
--color-civic-blue        #00386F      // primary; headers, links, focused chrome
--color-civic-blue-deep   #002347      // hover/pressed, header bar fill
--color-civic-blue-soft   #E6EEF7      // tinted row backgrounds, selected state
--color-ink               #14202B      // body text
--color-ink-muted         #4A5763      // labels, secondary text
--color-ink-faint         #8A95A0      // metadata, timestamps, dividers
--color-surface           #FFFFFF
--color-surface-alt       #F4F6F8      // panel background, zebra rows
--color-border            #D8DEE5
--color-border-strong     #B6BEC8

--color-decision-ok       #1F7A45
--color-decision-warn     #B8590A
--color-decision-stop     #B0263C
--color-decision-neutral  #3D4A57
--color-accent-spark      #76B900      // NVIDIA green; ONLY in Spark status strip
```

Semantic colors are reserved for decisions/status. Body chrome stays civic blue + neutrals so the colored signals mean something.

### 7.2 Typography

```text
--font-display   Inter, Helvetica Neue, system-ui, sans-serif
--font-text      Inter, system-ui, sans-serif
--font-mono      JetBrains Mono, ui-monospace, "SF Mono", monospace
                 // ticket_ids, scores, structured_text, audit refs
```

Scale: `text-xs` 11/16 chips & metadata · `text-sm` 13/18 body & forms · `text-base` 15/22 prose · `text-lg` 17/24 panel headings · `text-xl` 20/28 page titles · `text-2xl` 24/32 screen H1 (one max). Weights used: 400, 500, 600.

### 7.3 Density

```text
section gutter   24px  (px-6)
panel padding    16px  (p-4)
form row gap     12px  (gap-3)
table row pad    8px y / 12px x  (py-2 px-3)
chip pad         2px y / 8px x   (py-0.5 px-2)
```

Fixed civic-blue header bar (56 px), collapsible left rail nav, main column `max-w-screen-2xl`. Mobile-first: header → hamburger drawer at `<sm`, rail → drawer, tables → stacked label/value rows.

### 7.4 Primitives (`app/_components/`)

```text
CivicHeader, NavRail, Panel, Toolbar, DataTable, DefinitionList,
DecisionChip, ScoreBar, ScoreBreakdown, ConfidenceList,
EvidenceCard, HazardFlagGrid, AttachmentTile, UploadZone,
StatusStrip, EmptyState
```

### 7.5 Decision-chip mapping (single source of truth)

```text
category_decision      SUGGESTED_CATEGORY → ok      UNCERTAIN_CATEGORY → warn
duplicate_decision     DUPLICATE → stop  POSSIBLE_DUPLICATE → warn  NOT_DUPLICATE → neutral
urgency_decision       HIGH_URGENCY_HUMAN_REVIEW → stop
                       MEDIUM_REVIEW_OR_QUEUE → warn
                       LOW_URGENCY_SCHEDULING → ok
route                  neutral chip with a route icon (no color load)
hard-route fired       small "HARD-ROUTE: <flag>" badge in stop color
```

### 7.6 Accessibility floor

Color never alone — every semantic color carries an icon + label. Visible focus ring on all interactive elements (`outline outline-2 outline-offset-2 outline-civic-blue`). Form fields: explicit `<label>` association, `aria-invalid` + `aria-describedby` for `NEEDS_MORE_INFO` errors. Tables use `<th scope="col">` with `aria-sort` on sortable headers. Min text size 13 px outside chips.

### 7.7 Not building

Dark mode, animations beyond `transition-colors`, skeleton loaders beyond one shimmer variant, icons beyond Lucide React, a separate design-tokens package.

## 8. Per-screen breakdown

### 8.1 Dashboard home — `app/page.tsx`

```text
<StatusStrip/> (top, sticky)
<Panel title="Recent triage decisions">
  <DataTable/>
    cols: reported_at · ticket_id · short description ·
          category_decision · duplicate_decision · urgency_decision · route
    row click → /requests/[id]
<Panel title="Pending operator action">
  compact list from approvals queue; "Open queue →" link

data:   getRecentTickets() + getEvidencePack[] + getApprovalsQueue() + getPipelineMetrics()
client: none
cache:  use cache + cacheTag('fixtures')
```

### 8.2 Submit — `app/submit/page.tsx`

Two-column layout on `lg`, stacked below. Left = `<SubmitForm/>` (description, location, observed_at defaulting to `demo_clock = 2026-01-15 20:00`, `<HazardFlagGrid mode="form"/>`, demo-case picker). Right = `<UploadZone/>` with live previews.

```text
client: <SubmitForm/> wraps left column with controlled state for ticket fields
        + media_refs[]; selecting a demo case hydrates the form
on submit calls submitRequest(canonical_ticket) and handles 3 response shapes:
  { ok, ticket_id }              → router.push(`/requests/${ticket_id}`)
  { NEEDS_MORE_INFO, missing[] } → mark each field aria-invalid, scroll to first
  { error }                      → banner, keep form state

server fns: uploadAttachment (§6), submitRequest
cache: none — write surface
```

`HazardFlagGrid` form mode = 7 rows of (label · radio yes/no/unknown). All seven required; "unknown" preserved as JSON `null`, never silently `false`. `service_request_type` is **not** a form field — backend infers from category taxonomy.

### 8.3 Triage outcome — `app/requests/[id]/page.tsx`

Most important screen. Renders the evidence pack faithfully; never fuses decisions.

```text
header:
  <h1>Request {ticket_id}</h1>  reported_at · source
  row of 4 <DecisionChip/>: category · duplicate · urgency · route
  + HARD-ROUTE badge if any hard-route flag fired

<Panel title="Submitted ticket">
  <DefinitionList/> of canonical ticket
  <HazardFlagGrid mode="readonly"/> highlighting fired hard-routes
  attachments grid resolved from media_refs

<Panel title="Category candidates (DGX retrieval)">
  <ConfidenceList/> top-K with similarity, confidence, margin readout
  disclosure → mono block of structured_text

<Panel title="Urgency score breakdown">
  big urgency_score + <ScoreBar value max=1 ticks=[0.45, 0.75]/>
  <ScoreBreakdown/> waterfall: base + hazard + keyword − penalty

<Panel title="Nearest historical records (evidence)">
  list of <EvidenceCard/> from nearest_historical_records[]

<Panel title="Active duplicate candidates">
  same shape, tagged with the metadata-filter outcome that drove duplicate_decision
  NOT_DUPLICATE shows an empty state, not a hidden panel

<Panel title="Audit trail">
  audit_refs[] as stage-by-stage list; chat citations link into these

<CopilotChatPanel/> docked right rail on lg+, drawer below

data:  getTicket(id) + getEvidencePack(id) + getAuditEntries(refs)
cache: use cache + cacheTag(['fixtures', `ticket:${id}`])
       updateTag(`ticket:${id}`) after any approval action
```

### 8.4 Evidence panel

Not a route — physically the three middle panels of 8.3 plus the `structured_text` disclosure.

### 8.5 Schedule view — `app/schedule/page.tsx`

```text
<Panel title="Active operations">
  <DataTable/> from operations.json
  cols: operation_id · category · ward · intersection · status · scheduled_for
<Panel title="Pending insertions">
  <DataTable/> from schedule_assignments.json (status="proposed")
  cols: ticket_id · category · proposed slot · rank · explanation
  row expands → which active operation it batches with + why
  no DAG viz — read-only table only

data:  getScheduleState()
cache: use cache + cacheTag('fixtures')
```

### 8.6 Approvals queue — `app/approvals/page.tsx`

```text
<Toolbar/> filter chips: All · HIGH_URGENCY_HUMAN_REVIEW · POSSIBLE_DUPLICATE · UNCERTAIN_CATEGORY
<DataTable/>: pending items
  cols: reported_at · ticket_id · short description · urgency_decision · firing reason · score
  row click → inline expand: condensed evidence + [Approve] [Override category] [Send to human review]

client: <ApprovalActions/> per row → approveDecision(ticket_id, action, payload?)
        Override category opens an inline picker over top-K candidates (no free-text — operator cannot type a category that isn't in the taxonomy)
cache:  list use cache + cacheTag('fixtures'); actions invalidate via updateTag
```

### 8.7 Operator copilot chat

Right-rail panel on `/requests/[id]`. Suggested-question buttons derived from `copilot_scripts.json` keys for this ticket. Every bot response has the shape `{ text, audit_refs[] }`; the renderer always shows a citation chip; if `audit_refs` is empty the message is suppressed. No free-form generation in MVP.

```text
server fn: askCopilot(ticket_id, question) → copilot_scripts.json lookup
client:    full component (input, message state)
```

### 8.8 NVIDIA / Spark status panel — `<StatusStrip/>` in `app/layout.tsx`

Single-row monospace numerics, NVIDIA-green accent dots:

```text
● gpu_enabled=true · NVIDIA H100 80GB
● RAPIDS cuDF 25.x
● Embed: NIM nv-embed-v2
● Index: cuVS · 311 records: 190,432 · active: 8,217
● No external API in triage path
● indexed_at 2026-05-29 21:14

hover/click → popover with source field name + raw value, link to var/data_pipeline_report.md

data:  getPipelineMetrics()
cache: use cache + cacheTag('fixtures'); cacheLife.minutes(15)
```

### 8.9 Cross-screen consistency

- Every `ticket_id` is monospace and links to `/requests/[id]`.
- Every decision label uses `<DecisionChip/>` with the §7.5 mapping.
- Numeric scores: 2 decimals, always with threshold context (score bar ticks at 0.45 / 0.75).
- The UI never recomputes or rewords what the backend emitted.

## 9. Implementation priority

Per the README "thin but credible" guidance, stack-rank if time gets tight:

```text
must:    Submit, Triage outcome (with evidence panels), StatusStrip
should:  Dashboard home, Approvals queue
nice:    Schedule view, Copilot chat
```

If we hit the wall, Schedule and Copilot ship as stubs with copy describing what they will become. Everything else must land.

## 10. Out of scope

- Real LLM endpoint for the copilot
- Real DGX embedding / vector search call from the dashboard
- Authentication and operator identity (single-operator MVP; `proxy.ts` is a placeholder)
- Multi-tenancy / multi-ward operator scoping
- WhatsApp UI (that is the NemoClaw agent, not this app)
- Graph/DAG visualization, real geospatial dispatch, maps
- External object storage / cloud upload
- Noise permit / utility-cut evidence panels (DEFERRED — track `data.md`)
- Vision grounding of attached images (DEFERRED stretch)

## 11. Open questions

- Operator auth model — minimal for hackathon; revisit before any non-demo deploy.
- Temp-upload cleanup cadence — 24 h sweep-on-call is the proposal; may want a real cron later.
- EXIF / GPS handling — strip by default; revisit when lat/lon enters the canonical ticket.
- Exact `cacheLife` values per loader — defaults from Next 16 are probably fine; tune if cache misses become visible during the demo.
