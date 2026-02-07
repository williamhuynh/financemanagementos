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
