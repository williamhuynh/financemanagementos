# Architecture

See [ROADMAP.md](ROADMAP.md) for current status and priorities.

## Tech Stack
- **Frontend:** Next.js 14 (App Router) PWA with React Server Components
- **UI:** Shared component library in `packages/ui/`, Dark Neo design system
- **Auth:** Appwrite accounts + iron-session (encrypted HttpOnly cookies)
- **Database:** Appwrite Cloud (Sydney region) — 14 collections, 18 indexes
- **Storage:** Appwrite storage for statement uploads
- **AI:** OpenRouter for auto-categorization, Whisper for voice transcription

## Frontend
- PWA shell with offline-friendly caching for recent views.
- Pages: Dashboard, Ledger, Review Queue, Assets, Cash Log, Import, Reports, Settings.
- Shared component library (`packages/ui/`) for cards, chips, charts, topbar.
- Client/server component split — server components fetch data, client components handle interactivity.

## Backend (Next.js API Routes + Appwrite)
- **Auth:** Email/password via Appwrite, session stored in iron-session.
  - No client-side Appwrite SDK — all data access flows through server API routes.
  - `getApiContext()` in `lib/api-auth.ts` validates session and workspace membership on every request.
- **Database:** Appwrite database collections, all scoped by `workspace_id`.
  - API key client for database operations (server-side only).
  - Session client for user account preferences (workspace switching).
- **Storage:** Statement uploads to Appwrite storage buckets.
- **Workspace isolation:** `requireWorkspacePermission()` in `lib/workspace-guard.ts` enforces RBAC on all routes.

## Data Flow
- Import: Upload CSV → map columns → preview → detect duplicates → commit to ledger.
- Categorization: Rule-based matching → OpenRouter AI fallback → unknowns to review queue.
- Transfer matching: Same amount, opposite direction, within date window across owned accounts.
- Monthly close: Validate → snapshot totals → mark month closed → allow reopen.

## Key Services
| File | Purpose |
|------|---------|
| `lib/api-auth.ts` | Authentication context, session client, API key client |
| `lib/workspace-guard.ts` | Permission enforcement (`requireWorkspacePermission`) |
| `lib/workspace-permissions.ts` | Role-permission mapping |
| `lib/invitation-service.ts` | HMAC-SHA256 invitation tokens, accept/verify flow |
| `lib/data.ts` | All Appwrite database queries (workspace-scoped) |
| `lib/cash-logs-service.ts` | Cash log queries |
| `lib/collection-names.ts` | Collection name constants |
| `lib/workspace-types.ts` | TypeScript types for workspace, roles, permissions |

## Observability
- Import logs per batch.
- Metrics: unknown category rate, transfer match rate, duplicate rate.
- TODO: Replace `console.*` with structured logging.
