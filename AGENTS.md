# Repository Guidelines

## Project Overview
Tandemly is a family finance and wealth management PWA. It ingests monthly
CSV/PDF statements from multiple institutions, normalizes them into a single
ledger, supports categorization (rules + AI via OpenRouter) and transfer
detection, and tracks asset values over time. Design and UX favor fast month-end
review and clear visibility into net worth, spending, and asset allocation.

The app is multi-tenant — every user belongs to one or more workspaces with
role-based access control (owner / admin / editor / viewer). Data is fully
isolated between workspaces.

## Design Direction (Dark Neo)
- Visual style: dark charcoal base, soft gradients, glass-like cards, warm
  amber accents, and muted greens for assets.
- Typography: Bricolage Grotesque for headings, Manrope for body/UI.
- Experience: modern, sleek, and data-dense where needed, but not spreadsheet-
  bound.
- See `docs/DESIGN.md` for the evolving UI reference.

## Project Structure
Monorepo using npm workspaces:

```
apps/web/          Next.js 16 PWA (App Router, React Server Components)
  app/             Pages and API routes
    (shell)/       Authenticated routes (dashboard, ledger, review, assets, etc.)
    api/           REST API endpoints
  lib/             Shared utilities, services, auth, permissions
    __tests__/     Vitest unit tests (co-located)
  middleware.ts    Edge middleware (session guard)
packages/ui/       Shared React component library (@tandemly/ui)
docs/              Product/design/architecture documentation
screenshots/       Design inspirations and references
```

Key documentation:
- `docs/ROADMAP.md` — master plan (phases, blockers, success criteria)
- `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`
- `docs/DESIGN.md`, `docs/WIREFRAMES.md`, `docs/UX_SPEC.md`
- `docs/APPWRITE_SETUP.md`, `docs/INGESTION_PIPELINE.md`
- `docs/MULTI_WORKSPACE_FEATURE.md`, `docs/TESTING_PLAN.md`

## Build, Test, and Development Commands
Run from `apps/web/`:

```sh
npm run dev          # Start local dev server
npm run build        # Production build
npm run start        # Serve production build
npm test             # Run Vitest test suite
npm run test:watch   # Run tests in watch mode
npm run lint         # ESLint
```

Tests are co-located in `lib/__tests__/*.test.ts` using Vitest with jsdom.

## Tech Stack
- **Framework:** Next.js 16, React 18, TypeScript (strict)
- **Auth:** Appwrite accounts + iron-session (encrypted HttpOnly cookies)
- **Database:** Appwrite Cloud (14 collections, 18 indexes)
- **AI:** OpenRouter (auto-categorization), Whisper API (voice transcription)
- **Styling:** Tailwind CSS + Dark Neo design system
- **Testing:** Vitest, @testing-library/react, jsdom
- **Package manager:** npm workspaces

## Architecture Patterns

### Authentication
1. iron-session stores encrypted session in HttpOnly cookie
2. Edge middleware (`middleware.ts`) guards all non-public routes
3. `getApiContext()` in `lib/api-auth.ts` is the server-side entry point —
   returns authenticated user + workspace context or null
4. `createSessionClient()` creates an Appwrite client from the stored session

### Authorization (RBAC)
1. `requireWorkspacePermission(workspaceId, userId, permission)` in
   `lib/workspace-guard.ts` — call this in every API route
2. `hasPermission(role, permission)` in `lib/workspace-permissions.ts` —
   pure function, hierarchy: viewer < editor < admin < owner
3. Permissions: `read`, `write`, `delete`, `admin`, `owner`

### API Route Pattern
```typescript
export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await requireWorkspacePermission(workspaceId, ctx.user.$id, "write");
  // ... business logic
}
```

### Data Access
- All queries filter by `workspace_id` for tenant isolation
- Collection names are defined in `lib/collection-names.ts` (use `COLLECTIONS.*`)
- Rate limiting on auth endpoints via `lib/rate-limit.ts`

## Coding Style & Naming Conventions
- Indentation: 2 spaces
- File naming: `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- Class/Type names: `PascalCase`; functions and variables: `camelCase`
- Prefer `const` over `let`; avoid `any` where possible
- Commit messages: conventional format (`feat:`, `fix:`, `docs:`, `chore:`)
- Keep `console.log` out of production code — use `console.error` sparingly
  for server-side error logging only

## Testing Guidelines

### Test framework
- Framework: Vitest with jsdom environment
- Test files: `lib/__tests__/*.test.ts`
- Run: `npm test` from `apps/web/`
- Write tests for pure logic (permissions, rate limiting, data transforms)
- API routes that depend on Appwrite are harder to unit test — focus on
  integration tests or mock the database client

### Multi-layered testing strategy

**Layer 1: Local testing (before commit)**
```sh
cd apps/web
npm test              # Run unit tests (< 10s) — ALWAYS before commit
npm run lint          # ESLint checks — catch style issues early
```

**Layer 2: Pre-push validation (recommended)**
```sh
npx tsc --noEmit      # Type-check entire codebase
npm run build         # Verify production build succeeds
```

**Layer 3: CI automation (GitHub Actions)**
- Workflow: `.github/workflows/test.yml`
- Triggers: every push to main/develop/claude/*, all PRs
- Runs: lint → type-check → tests → build
- Environment: clean Ubuntu, Node 20.x
- **Blocks merges if any step fails**

### Testing checklist
- ✓ Add unit tests for new functions in `lib/`
- ✓ Run `npm test` locally before every commit
- ✓ Verify type safety with `npx tsc --noEmit` before pushing
- ✓ Check CI status before merging PRs (all checks must pass)
- ✓ Update tests when modifying logic in existing tested modules

### Optional: Pre-commit hooks
Consider using [husky](https://typicode.github.io/husky/) to automatically run
tests on `git commit`:

```sh
npm install --save-dev husky lint-staged
npx husky init
echo "cd apps/web && npm test && npm run lint" > .husky/pre-commit
```

This prevents committing broken code and keeps history clean.

## Security & Configuration
Store secrets in environment variables. Never commit API keys.

Required env vars:
- `NEXT_PUBLIC_APPWRITE_ENDPOINT` — Appwrite API endpoint
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID` — Appwrite project ID
- `NEXT_PUBLIC_APPWRITE_DATABASE_ID` — Appwrite database ID
- `APPWRITE_API_KEY` — Server-side API key (admin operations)
- `SESSION_SECRET` — iron-session encryption key (min 32 chars)
- `INVITATION_SECRET` — HMAC key for invitation token hashing
- `OPENROUTER_API_KEY` — AI auto-categorization
- `OPENROUTER_MODEL` — Model ID (optional, has default)
- `WHISPER_API_KEY` — Voice transcription (optional)
- `NEXT_PUBLIC_APP_URL` — Base URL for email links (optional, defaults to localhost)
