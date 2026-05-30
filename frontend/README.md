# 311mustangs — Operator Dashboard

Next.js 16 (App Router) operator console for the 311 resolution engine. It surfaces
audited backend decisions — triage outcomes, DGX retrieval evidence, schedules, and
human approvals. See [`../docs/planning/frontend.md`](../docs/planning/frontend.md)
for the full spec.

> **Mock data:** every value currently comes from `app/lib/mock-data.ts` (a stand-in
> for the backend data contract). The UI only *renders* scores — it never computes them.

## Routes

| Route | What it is |
|---|---|
| `/` | Dashboard — incoming requests + decision summary stats |
| `/submit` | Intake form with file upload + scripted demo-case picker → inline triage result |
| `/requests/[id]` | Triage outcome: scores, schedule before/after, attachments, evidence |
| `/approvals` | Human-in-the-loop queue (approve / override) |
| `/copilot` | Operator copilot chat, grounded in audit evidence |

A persistent NVIDIA/DGX Spark status strip (judging-proof metadata) renders in the
shell on every page.

## Develop

```bash
npm run dev        # http://localhost:3000
npm run build      # production build + typecheck
npm run lint
```

## Test

Vitest + React Testing Library (jsdom). See the testing section in
[`../docs/practices/nextjs-best-practices.md`](../docs/practices/nextjs-best-practices.md).

```bash
npm test           # run once
npm run test:watch # watch mode
```

Tests cover the data accessors/invariants (`app/lib/mock-data.test.ts`) and client
behavior — file-upload validation, score rendering, decision badges, and the
approval queue (`app/_components/*.test.tsx`).
