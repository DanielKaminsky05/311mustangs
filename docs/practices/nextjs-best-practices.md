# Best Practices: Next.js 16 (App Router)

Conventions for the Next.js frontend / full-stack code in this repo. For Python services, see **[fastapi-best-practices.md](fastapi-best-practices.md)**.

> ⚠️ **This is Next.js 16.2.6 + React 19.2.** Many APIs differ from Next 14/15. Where this guide and your prior knowledge disagree, **this guide wins** — and the authoritative source is the bundled docs at `node_modules/next/dist/docs/01-app/`. Read the relevant doc before writing framework code.

### 1. The mental model (read this first)

- **Server Components are the default.** Files under `app/` render on the server unless they start with `'use client'`. Server Components can be `async`, fetch data, read secrets, and talk to the DB directly.
- **Rendering is Partial Prerendering (PPR) when Cache Components is on.** At build time Next renders the tree into a *static shell*. Three things land in the shell: `use cache` output, deterministic computation, and `<Suspense>` fallbacks. Everything else streams at request time.
- **You must explicitly classify dynamic work.** Anything that reads request-time data or is non-deterministic must be either cached (`use cache`) or wrapped in `<Suspense>`. Otherwise you get a build/dev error: `Uncached data was accessed outside of <Suspense>`.

### 2. Async APIs — the #1 breaking change

In Next 16 the following are **Promises and must be awaited**:

```tsx
// params and searchParams are Promises
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const { q } = await searchParams
  // ...
}

// cookies() and headers() are async
import { cookies, headers } from 'next/headers'
const theme = (await cookies()).get('theme')?.value
const ua = (await headers()).get('user-agent')
```

Prefer the **auto-generated, globally-available route prop helpers** (no import needed) for type safety:

```tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
}

export default function Layout(props: LayoutProps<'/dashboard'>) {
  return <>{props.children}</>
}
```

### 3. Server vs Client Components

| Use a **Server Component** (default) when you… | Use a **Client Component** (`'use client'`) when you… |
| --- | --- |
| Fetch from a DB/API, use secrets/API keys | Need `useState`, `useEffect`, event handlers (`onClick`) |
| Want to reduce client JS | Need browser APIs (`window`, `localStorage`, geolocation) |
| Want streaming / fast FCP | Use a custom hook or a client-only third-party lib |

Rules:

- `'use client'` marks a **boundary**: every import and child of that file joins the client bundle. Don't sprinkle it everywhere — put it on the smallest interactive leaf (e.g. a `<SearchBar/>`), not a whole layout.
- **Push `'use client'` down the tree.** Keep layouts/pages as Server Components; isolate interactivity.
- Pass data Server→Client via **serializable props** only. Functions, class instances, and Symbols are not serializable.
- **Context providers** must be Client Components. Render them as deep as possible (wrap `{children}`, not the whole `<html>`).
- Wrap client-only **third-party components** that lack `'use client'` in your own `'use client'` re-export.
- **Prevent environment poisoning:** put `import 'server-only'` at the top of modules that touch secrets. Only `NEXT_PUBLIC_`-prefixed env vars reach the client; everything else is replaced with `""`.

### 4. Fetching data

```tsx
// Server Component — just await. fetch() is request-deduped automatically.
export default async function Page() {
  const res = await fetch('https://api.example.com/posts')
  const posts = await res.json()
  return <PostList posts={posts} />
}
```

- `fetch` calls are **memoized within a single request**, but **not cached across requests** by default. Use `use cache` to cache, or `<Suspense>` to stream fresh data each request.
- Deduplicate non-`fetch` data loaders (DB queries) across a request with React `cache()`:

  ```tsx
  import { cache } from 'react'
  export const getPost = cache(async (slug: string) => db.post.findUnique({ where: { slug } }))
  ```

  Call the same `getPost` in both `generateMetadata` and the page — it runs once.
- **Parallelize** independent fetches with `Promise.all`.
- **Stream slow/fresh data** rather than blocking the whole page:

  ```tsx
  import { Suspense } from 'react'
  export default function Page() {
    return (
      <>
        <h1>Blog</h1>
        <Suspense fallback={<Skeleton />}>
          <LatestPosts /> {/* async component that fetches */}
        </Suspense>
      </>
    )
  }
  ```
- To stream a promise into a **Client Component**, pass the un-awaited promise and resolve it with React's `use()` hook inside a `<Suspense>`.

### 5. Caching with Cache Components (`use cache`)

Enable it once in config:

```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { cacheComponents: true }
export default nextConfig
```

Then cache at the **data level** or **UI level** with the `'use cache'` directive:

```tsx
import { cacheLife, cacheTag } from 'next/cache'

async function BlogPosts() {
  'use cache'
  cacheLife('hours')   // lifetime profile
  cacheTag('posts')    // tag for on-demand invalidation
  const res = await fetch('https://api.example.com/blog')
  return <List posts={await res.json()} />
}
```

Key rules:

- **Cache key = build id + function id + serialized arguments + closed-over values.** Different inputs → different entries (enables parameterized/personalized caching).
- **You cannot read `cookies()`/`headers()`/`searchParams` inside a `use cache` scope.** Read them *outside*, then pass the extracted value as an argument so it becomes part of the cache key:

  ```tsx
  async function ProfileContent() {
    const sessionId = (await cookies()).get('session')?.value
    return <Cached sessionId={sessionId} />
  }
  async function Cached({ sessionId }: { sessionId?: string }) {
    'use cache'
    return <div>{await fetchUserData(sessionId)}</div>
  }
  ```
- **Non-deterministic ops** (`Math.random()`, `Date.now()`, `crypto.randomUUID()`) are not allowed in a prerendered path. Either cache the result, or call `await connection()` first and wrap in `<Suspense>` to defer to request time.
- Serializable cache args/returns: primitives, plain objects, arrays, `Date`, `Map`, `Set`, TypedArrays, and React elements (pass-through). **Not** allowed: class instances, functions, Symbols, `URL` instances, Weak collections.
- **Always set an explicit `cacheLife`** so nested-cache behavior is predictable.

`cacheLife` profiles:

| Profile | revalidate | expire |
| --- | --- | --- |
| `seconds` | 1s | 60s |
| `minutes` | 1m | 1h |
| `hours` | 1h | 1d |
| `days` | 1d | 1w |
| `weeks` | 1w | 30d |
| `max` | 30d | ~indefinite |

Or pass a custom object: `cacheLife({ stale: 3600, revalidate: 7200, expire: 86400 })`.

> If you are **not** using Cache Components, see `node_modules/.../guides/caching-without-cache-components` for the previous fetch-options model (`fetch(url, { next: { revalidate, tags } })`).

### 6. Revalidation

| API | Where | Semantics |
| --- | --- | --- |
| `cacheTag('t')` / `cacheLife(...)` | inside `use cache` | Tag + lifetime for an entry |
| `revalidateTag('t')` | anywhere | Stale-while-revalidate (next visitor may see stale once) |
| `updateTag('t')` | **Server Actions only** | Immediately expires — read-your-own-writes |
| `revalidatePath('/x')` | anywhere | Path-based; coarse — prefer tags |
| `refresh()` (`next/cache`) | Server Action | Refreshes the client router for instant UI |

**Prefer tag-based revalidation** over path-based. Inside a mutation that needs the user to immediately see their change, use `updateTag`.

### 7. Mutating data — Server Functions ("Server Actions")

```tsx
// Inline in a Server Component, or in a 'use server' file.
async function createPost(formData: FormData) {
  'use server'
  // ALWAYS authenticate + authorize here — these are public POST endpoints.
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  await db.post.create({ data: { title: formData.get('title') } })
  updateTag('posts')          // refresh cached reads
  redirect('/posts')          // revalidate before redirect if using revalidatePath
}

// Wire to a form (progressive enhancement, no client JS required):
<form action={createPost}>
  <input name="title" required />
  <button type="submit">Publish</button>
</form>
```

- Server Functions run as **POST** endpoints. **Treat every one as a public, untrusted entry point** — validate auth and input inside the function.
- Pending UI + returned errors: use `useActionState`:

  ```tsx
  'use client'
  const [state, formAction, pending] = useActionState(createPost, { message: '' })
  // <button disabled={pending}> ; render state.message for errors
  ```
- **Model expected errors as return values** (`return { message: '...' }`), not thrown exceptions. Reserve `throw` for truly unexpected failures.

### 8. Error handling

- `app/**/error.tsx` (Client Component) catches uncaught render errors for a segment; it receives `{ error, unstable_retry }`.
- `notFound()` (from `next/navigation`) renders the nearest `not-found.tsx`.
- `forbidden()` / `unauthorized()` + `forbidden.tsx` / `unauthorized.tsx` are available (enable `authInterrupts`).
- Component-scoped boundaries: `unstable_catchError` from `next/error`.

### 9. Routing, navigation, metadata

- **Link prefetches** by default (on hover / when in viewport). Use `<Link prefetch={false}>` to opt out; raw `<a>` never prefetches.
- For loading affordances on slow links, use `useLinkStatus()` from `next/link` (`{ pending }`).
- Use `window.history.pushState/replaceState` for shallow URL updates (e.g. sort params) without a full navigation.
- **Metadata:** export a static `metadata` object, or an async `generateMetadata({ params })`. Generate OG images with `ImageResponse` from `next/og` (`opengraph-image.tsx`). Memoize shared fetches with `cache()`.

### 10. Middleware is now "Proxy"

As of Next 16, Middleware is renamed **Proxy** (same functionality). Use a single `proxy.ts` at project root (sibling to `app/`):

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}
export const config = { matcher: '/about/:path*' }
```

- Proxy is for headers, rewrites, A/B redirects, and **optimistic** auth checks — **not** full session/authorization, and **not** slow data fetching.
- `fetch` cache options have **no effect** inside Proxy.

### 11. Route Handlers (`app/**/route.ts`)

```ts
export async function GET(request: Request) {
  return Response.json({ ok: true })
}
```

- Supports GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS. Only `GET` can be cached.
- With Cache Components on, `GET` handlers follow the page prerender model. You can't put `'use cache'` directly in the handler body — extract a helper and cache that.

### 12. Testing

Use **Vitest + React Testing Library** (jsdom) for unit/component tests, and **Playwright** for end-to-end flows. This is the supported stack for React 19 / Next 16 — Jest works but Vitest is faster and aligns with the Vite-based test transform.

**Setup** (already wired in `frontend/`):

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  // Mirror the "@/*" tsconfig alias explicitly. Don't use vite-tsconfig-paths
  // for this — it only maps aliases for files in tsconfig's `include`, and we
  // exclude test files from the build tsconfig (see below).
  resolve: { alias: { '@': resolve(rootDir) } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'], css: false },
})
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'   // adds toBeInTheDocument(), etc.
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
afterEach(() => cleanup())
// jsdom lacks some browser APIs — stub what your components use:
if (!URL.createObjectURL) { URL.createObjectURL = vi.fn(() => 'blob:mock'); URL.revokeObjectURL = vi.fn() }
```

**Conventions**

- Co-locate tests as `*.test.ts(x)` next to the source. Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- **Exclude test + tooling config from the production typecheck.** Add `vitest.config.ts`, `vitest.setup.ts`, and `**/*.test.ts(x)` to `tsconfig.json`'s `exclude` — otherwise `next build` type-checks them and a vite/vitest version skew in the config can fail the build. Vitest transpiles via esbuild, so it doesn't need them in the app tsconfig.

**What to test (and how)**

| Target | Approach |
| --- | --- |
| Pure logic / data accessors / formatters | Plain Vitest unit tests — fast, no DOM. Assert data invariants too (unique ids, scores in range). |
| **Client Components** (`'use client'`) | `render()` + `@testing-library/user-event`; assert on visible text/roles, not implementation details. |
| **Server Components** (`async`) | RTL can't render `async` components yet. Test the **data functions** they call directly; cover the rendered output with an e2e (Playwright) test. |
| Forms / Server Functions | Unit-test the validation/logic; assert returned error states. Don't rely on `<form action={fn}>` wiring in jsdom. |
| File inputs | Prefer `userEvent.upload(input, file)`. It applies the input's `accept` filter — to exercise your **own** validation guard, drive `fireEvent.change(input, { target: { files } })` instead. Mock `file.size` via `Object.defineProperty` rather than allocating real bytes. |
| Full user journeys | **Playwright** against `next build && next start` — the only reliable way to cover Server Components, navigation, and streaming. |

**Principles**

- Query by accessible role/text (`getByRole`, `getByText`), not test ids, except as a last resort.
- `await` all `user.*` interactions; wrap nothing in manual `act()` — RTL/user-event handle it.
- Keep network/DB out of unit tests — inject or import fixtures (this repo uses `app/lib/mock-data.ts`).
- Model expected errors as assertions on returned/rendered state, mirroring §7's "errors as return values."

### 13. Background work

`after()` from `next/server` runs a callback after the response is sent (logging, analytics) without making the route dynamic. Read `cookies()`/`headers()` **before** calling `after`, then use the captured value inside.

### Checklist

- [ ] Awaited `params`, `searchParams`, `cookies()`, `headers()`.
- [ ] `'use client'` only on the smallest interactive leaves; secrets behind `server-only`.
- [ ] Every request-time / non-deterministic component is either `use cache` or inside `<Suspense>` (no blocking-route errors).
- [ ] Explicit `cacheLife` + `cacheTag` on cached functions; mutations call `updateTag`/`revalidateTag`.
- [ ] Server Functions authenticate, authorize, and validate input.
- [ ] Proxy logic lives in one root `proxy.ts` and stays lightweight.
- [ ] Tests use Vitest + RTL; client behavior covered by component tests, logic by unit tests, journeys by Playwright. Test/config files excluded from the production typecheck.
