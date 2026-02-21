# CLAUDE.md

Project instructions for Claude Code sessions working on Tandemly.

## What is this project?
Tandemly — a family finance and wealth management PWA. Ingests CSV/PDF bank
statements, normalizes into a unified ledger, categorizes transactions (rules +
AI), detects transfers, and tracks asset values. Multi-tenant with RBAC
(owner / admin / editor / viewer). See `docs/ROADMAP.md` for current status.

## Repo layout
```
apps/web/            Next.js 16 PWA (App Router)
  app/(shell)/       Authenticated pages (dashboard, ledger, review, assets…)
  app/api/           REST API routes
  lib/               Auth, services, permissions, rate limiting
  lib/__tests__/     Vitest unit tests
  middleware.ts      Edge session guard
packages/ui/         Shared component library (@tandemly/ui)
docs/                Architecture, design, data model, roadmap
```

## Commands
All commands **must** run from `apps/web/` (not from root):
```sh
cd apps/web
npm run dev          # Dev server
npm run build        # Production build
npm test             # Vitest test suite
npm run test:watch   # Tests in watch mode
npx eslint app/ lib/ # ESLint (DO NOT use `npm run lint` — `next lint` is
                     #   broken in this Next.js 16 workspace setup)
npx tsc --noEmit     # Type-check
```

## Key patterns — follow these

### Auth
- `getApiContext()` (`lib/api-auth.ts`) → returns `{ user, databases, config, workspaceId }` or null
- `requireWorkspacePermission(workspaceId, userId, permission)` (`lib/workspace-guard.ts`) — call in every API route
- **Redirect on null context**: In server pages under `(shell)/`, when `getApiContext()`
  returns null, always `redirect("/login")`. The login page lives at `app/login/page.tsx`.
  Do NOT use `"/signin"` — there is no `/signin` route.
- Role hierarchy: viewer < editor < admin < owner
- Permissions: `read`, `write`, `delete`, `admin`, `owner`

### API route template
```typescript
export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await requireWorkspacePermission(workspaceId, ctx.user.$id, "write");
  // business logic…
}
```

### Data access
- Always filter by `workspace_id` for tenant isolation
- Use `COLLECTIONS.*` from `lib/collection-names.ts` — never hardcode collection strings
- Appwrite `Query.limit()` caps at 5000 — paginate with `Query.cursorAfter()` for exports/bulk ops
- Delete asset_valuations BEFORE assets (valuations keyed by asset_id, not workspace_id)

### Extractors (`lib/extractors/`)
- `pdf.ts` uses `pdf-parse` which depends on `pdfjs-dist` — runs **server-side only**
- `pdfjs-dist` expects browser APIs (`DOMMatrix`); the polyfill lives in
  `server-polyfills.ts` and is registered via `instrumentation.ts` at server
  startup. `pdf.ts` uses a **dynamic import** (`await import("pdf-parse")`)
  instead of a static import so the polyfill is guaranteed to run first.
  Do NOT convert this back to a static import.
- When adding new extractors, watch for browser-only APIs in npm deps that will
  crash in Node.js/edge server environments — polyfill or pick a server-safe library.
  Use dynamic imports for deps that need polyfills (static imports are hoisted
  above module-level code by the bundler).

### OpenRouter / external API calls
- **Referer header**: Always use `process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"`
  for `HTTP-Referer`. Never hardcode `"http://localhost:3000"` — OpenRouter free-tier
  models enforce data-policy settings tied to the referer, so a mismatch causes 404s
  in production.
- **Error handling**: When an external API returns a non-OK response, always read and
  log the response body *before* throwing. Status codes alone (e.g. 404) are not
  debuggable — the body contains the real reason (model removed, policy violation, etc.).
  ```typescript
  if (!response.ok) {
    let detail = "";
    try { const b = await response.json(); detail = b?.error?.message || JSON.stringify(b); } catch {}
    console.error(`API failed: ${response.status}`, detail);
    throw new Error(`API failed: ${response.status}${detail ? ` — ${detail}` : ""}`);
  }
  ```
- **Logging at the route level**: If a catch block returns an error response to the
  client, it must also `console.error` so the message appears in Vercel / server logs.
  Silently returning a 502 with no log makes production issues invisible.
- **Model availability**: Free-tier models on OpenRouter can be removed or renamed
  without notice. The default model is set in `OPENROUTER_MODEL` env var (fallback
  `xiaomi/mimo-v2-flash:free`). If it starts 404-ing, check the OpenRouter models page.
- Reference implementation: `app/api/cash-logs/process/route.ts` (dynamic referer,
  graceful fallback parsing when AI fails).

### Date handling
- **Storage format**: Always store dates as ISO `YYYY-MM-DD` strings in Appwrite.
  The `date` attribute is a string field and Appwrite sorts it lexicographically —
  ISO is the only format where string sort = chronological sort. The import API
  (`app/api/imports/route.ts`) normalises all incoming dates via `normalizeDateToISO()`.
- **Display format**: Show dates in Australian DD/MM/YYYY format in the UI.
  `parseDateValue()` in `lib/data.ts` handles parsing both formats (and others)
  back into `Date` objects for display and month-matching.
- **Why not DD/MM/YYYY for storage?** It breaks ledger pagination — `"01/02/2025"`
  (Feb 1) sorts before `"15/01/2025"` (Jan 15) lexicographically, scattering months
  across the sort order and causing the offset-based batch pagination to miss rows.

### Naming: "Ledger" vs "Transactions"
- The backend code, API routes, URL paths, and database collections still use **"ledger"**
  (e.g. `/ledger`, `/api/ledger`, `getLedgerRows()`, `LedgerRow` type).
- The **user-facing UI** calls it **"Transactions"** (nav label, page title, empty states,
  buttons). Do NOT show the word "Ledger" to users.
- When adding new UI text, use "Transactions". When working with backend/data code,
  continue using "ledger". A full backend rename is deferred.

### Naming: "Reports" vs "Monthly Close"
- The route path, directory name, and some backend references still use **"reports"**
  (e.g. `/reports`, `app/(shell)/reports/`, `ReportsPage`, `reportStats`).
- The **user-facing UI** calls it **"Monthly Close"** (nav label, page title, back links).
  The page's purpose is to review a month and close it after importing everything.
  Do NOT show the word "Reports" to users.
- When adding new UI text, use "Monthly Close". When working with routes/backend code,
  continue using "reports". A full backend rename is deferred.

### Detail Panel (right-side push panel)
- Use `<DetailPanel>` from `@tandemly/ui` whenever a page needs a right-side detail
  view (e.g. clicking a row to see more info). Do NOT create custom drawers or overlays.
- **Desktop (>720px)**: Panel animates open via `width` transition (0 → 380px) and adds
  `body.detail-panel-active` which applies `margin-right: 380px` to `.app-shell`,
  pushing the main content left. No backdrop.
- **Mobile (≤720px)**: Panel slides in as an overlay (`translateX`) with a backdrop.
  Body scroll is locked.
- The component handles mobile detection, Escape key, and body class management
  internally — just pass `open`, `onClose`, `title`, and `children`.
- **Portal rendering**: `DetailPanel` uses `createPortal` to render at `document.body`,
  so it is safe to place anywhere in the component tree. This avoids a CSS stacking
  context trap: ancestor elements with `transform`, `filter`, `will-change`, or
  `animation` (e.g. the `.card` class's `fadeUp` animation) create a new containing
  block that breaks `position: fixed` children and clips them with `overflow: hidden`.
  The portal ensures the panel always overlays the full viewport.
- For field content inside the panel, use the shared CSS classes:
  `right-drawer-detail`, `right-drawer-label`, `right-drawer-value`,
  `right-drawer-actions`. These are defined in `globals.css` and used across
  all detail panel instances (Transactions, Import Details, etc.).
- Reference implementations: `app/(shell)/ledger/LedgerClient.tsx` (Transactions),
  `app/(shell)/import-hub/ImportClient.tsx` (Import Details).

### Rate limiting
- Auth endpoints use `lib/rate-limit.ts` (in-memory sliding window)
- Import and apply: `import { rateLimit, AUTH_RATE_LIMITS } from "…/lib/rate-limit"`

## Code style rules

- 2-space indentation, no tabs
- `kebab-case.ts` for utility files, `PascalCase.tsx` for components
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- No `console.log` in production code — it was stripped in Phase 2; keep it that way
- `console.error` is OK sparingly in server-side API routes for error logging
- Prefer `const` over `let`; avoid `any`
- Return `{ error: "…" }` (not `{ detail }`) from API routes — we're standardizing on this

## Testing

### Test framework
- Vitest + jsdom, tests in `lib/__tests__/*.test.ts`
- Test pure logic: permissions, rate limiting, data transforms, collection names

### When to run tests
**Before every commit:**
```sh
cd apps/web
npm test              # Unit tests (fast, < 10s)
npx eslint app/ lib/  # Code quality (not `npm run lint`, see note above)
```

**Before pushing (recommended):**
```sh
npx tsc --noEmit      # Type safety check
npm run build         # Ensure production build works
```

**Automated in CI:**
- GitHub Actions runs full test suite on every push and PR
- Tests run in clean environment on Node 20.x
- Workflow: `.github/workflows/test.yml`
- Blocks merge if any check fails (tests, lint, type-check, build)

### Test checklist
- ✓ Add tests for new utility functions in `lib/`
- ✓ Run `npm test` locally before committing
- ✓ Verify CI passes before merging PRs
- ✓ Update tests when changing logic in tested modules

## Env vars (never commit secrets)
Required: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`,
`NEXT_PUBLIC_APPWRITE_DATABASE_ID`, `APPWRITE_API_KEY`, `SESSION_SECRET`,
`INVITATION_SECRET`

Optional: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `WHISPER_API_KEY`,
`NEXT_PUBLIC_APP_URL`

## Current focus
Phase 2 blockers are done. Fast-follow items remain — see `docs/ROADMAP.md`:
ToS/Privacy pages, CSRF tokens, consistent error format, empty states,
workspace deletion.
