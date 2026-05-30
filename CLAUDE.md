@AGENTS.md

# Engineering best practices

Follow the stack-specific guides for all code in this repo:

- **[docs/nextjs-best-practices.md](docs/nextjs-best-practices.md)** — Next.js frontend / full-stack code.
- **[docs/fastapi-best-practices.md](docs/fastapi-best-practices.md)** — any Python API service.

- **Next.js (this repo): v16.2.6 + React 19.2 — App Router.** This is NOT the Next.js in your training data. Before writing framework code, read the relevant guide in `node_modules/next/dist/docs/01-app/`, and follow `docs/nextjs-best-practices.md`. Highest-impact rules:
  - `params`, `searchParams`, `cookies()`, and `headers()` are **async — always `await`** them.
  - Server Components are the default; put `'use client'` only on the smallest interactive leaves, behind `server-only` for secrets.
  - With Cache Components on, every request-time/non-deterministic component must be `use cache` **or** wrapped in `<Suspense>` — otherwise the build errors.
  - Cache with the `'use cache'` directive + explicit `cacheLife`/`cacheTag`; revalidate with `updateTag`/`revalidateTag` (prefer tags over paths).
  - Middleware is now **Proxy** (`proxy.ts` at project root). Server Functions are public POST endpoints — authenticate, authorize, and validate inside each one.

- **FastAPI (any Python service we add):** follow `docs/fastapi-best-practices.md` — `lifespan` (not `on_event`), `pydantic-settings` via `Depends`, separated input/output schemas with `response_model`, `async def` for async I/O, business logic in `services/`, locked-down auth/CORS.
