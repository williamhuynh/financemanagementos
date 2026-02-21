# Roadmap

Reviewed Feb 2026. Master plan for Tandemly — tracks what's shipped, what's next, and what's planned.

---

## Phase 1: MVP Core (DONE)

All core product functionality is built and working:

- [x] PWA shell + authentication (iron-session + Appwrite)
- [x] CSV import with column mapping and preview
- [x] Ledger + review queue (unknowns, transfers, duplicates)
- [x] Categorization rules, auto-categorization (OpenRouter), and transfer matching
- [x] Dashboard summary + monthly reports + waterfall
- [x] Assets with manual valuations and history
- [x] Monthly close / reopen with snapshot generation
- [x] Voice input for cash transactions (Whisper transcription)
- [x] Password reset flow (forgot-password + reset-password)
- [x] Email verification on signup (auto-send, banner, resend, verify page)
- [x] Onboarding flow for new users (workspace creation wizard)

---

## Phase 1.5: Multi-Workspace & Security (DONE)

Full multi-tenant workspace system with RBAC. See [MULTI_WORKSPACE_FEATURE.md](MULTI_WORKSPACE_FEATURE.md) for user-facing docs and [implementation plan](../.claude/plans/multi-user-workspace-plan.md) for technical details.

- [x] Dynamic workspace creation on signup
- [x] Workspace switcher UI (topbar dropdown, hidden for single workspace)
- [x] Role-based access control — owner / admin / editor / viewer
- [x] Centralized workspace guard (`requireWorkspacePermission`) on all 16 API routes + 7 server components
- [x] All data.ts functions accept `workspaceId` parameter (no hardcoded defaults)
- [x] Invitation system — HMAC-SHA256 token hashing, 7-day expiry, email verification
- [x] Member management — list, invite, remove (owner protected)
- [x] Database indexes (18 total, including unique constraint on workspace_members)
- [x] Fail-fast on missing secrets (SESSION_SECRET, INVITATION_SECRET)

---

## Phase 2: MVP Hardening (Current Focus)

These items close the gap between "works for us" and "ready for others to use."

### Blockers — Must ship before public launch

- [x] **Rate limiting on auth endpoints** — In-memory sliding-window rate limiter on login (5/15m), signup (3/15m), forgot-password (3/15m), reset-password (5/15m), invitation verify/accept (10/15m).
- [x] **Error boundaries (error.tsx)** — Root `error.tsx`, shell `error.tsx`, and `not-found.tsx` pages with retry/navigate-home actions.
- [x] **Strip debug output** — Removed `debugReason` from TransferMatchClient, verbose `console.log` from workspace routes, onboarding, cash logs, and workspace context.
- [x] **Account deletion / data export** — `GET /api/account/export` (JSON data export) and `DELETE /api/account` (full account + data deletion). UI on profile page with confirmation flow.
- [x] **Basic automated tests** — Vitest framework with 16 tests covering rate limiting, workspace permissions (RBAC), and collection name constants.
- [x] **CSRF token validation** — Synchronizer Token Pattern. Token generated on login/signup, stored in iron-session. Middleware validates `X-CSRF-Token` on all POST/PATCH/DELETE. Auth routes exempt.
- [x] **Input validation (Zod)** — Runtime schema validation on all 30+ API routes via `lib/validations.ts`. Replaces ad-hoc manual validation with consistent typed schemas. Standardizes error responses on `{ error }` shape.
- [x] **Rate limiting on all data routes** — New `DATA_RATE_LIMITS` presets: read (60/min), write (30/min), delete (20/min), bulk (5/min), ai (10/min), export (3/min), account delete (3/min). Pluggable store interface supports in-memory (default) or Redis (`REDIS_URL`).
- [x] **Audit logging** — New `audit_logs` collection. Fire-and-forget `writeAuditLog()` in `lib/audit.ts` records who, what, when, resource, and IP on all mutations. Never crashes business logic.

### Fast-follow — Ship within first week post-launch

- [ ] **Terms of Service / Privacy Policy pages** — Required for financial data. Add static pages + consent checkbox on signup.
- [x] **CSRF token validation** — Moved to Blockers (shipped in SaaS readiness PR).
- [x] **Consistent API error format** — Zod validation standardizes all routes on `{ error }`. Shipped in SaaS readiness PR.
- [ ] **Richer empty states** — Basic empty states exist in ledger, assets, review, cash log, and dashboard. Could be richer with CTAs for importing data and setting up categories.
- [ ] **Workspace deletion + leave workspace** — Users can create workspaces but not delete them or leave them.
- [ ] **Rename `value_aud` DB field to `value_home`** — The `asset_values` collection stores FX-converted values in the workspace's home currency, but the Appwrite field is still named `value_aud` from when AUD was hardcoded. Rename to `value_home` (or `value_home_currency`) for clarity. Requires an Appwrite schema migration + backfill script + updating all reads in `data.ts` (`buildAssetOverviewFromRecords`, `prepareAssetRecords`) and the write in `app/api/assets/values/route.ts`.

### Polish — Nice to have

- [ ] **Loading states (loading.tsx)** — No `loading.tsx` files. Add to shell and key pages.
- [ ] **Structured logging** — Replace `console.*` with structured logger. Remove sensitive data from logs.
- [ ] **Docker / deployment config** — No container config for reproducible deployment.
- [ ] **Database migration versioning** — Schema changes are one-off scripts with no versioning.
- [ ] **In-app help / documentation** — No guidance for CSV import format, voice input, review queue.

---

## Phase 3: Quality

- [ ] PDF parsing + OCR for statement imports
- [ ] Improved duplicate detection
- [ ] Category suggestions from transaction history
- [ ] Data export improvements (CSV, JSON)

---

## Phase 4: Automation

- [ ] Provider integrations (Open Banking where available)
- [ ] Automated valuations for selected assets
- [ ] Scheduled monthly snapshot and reminders

---

## Documentation Index

### Planning & Architecture
| Document | Description |
|----------|-------------|
| [REQUIREMENTS.md](REQUIREMENTS.md) | Goals, MVP scope, out-of-scope, success criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and tech stack |
| [DATA_MODEL.md](DATA_MODEL.md) | Entity relationships and field definitions |
| [INGESTION_PIPELINE.md](INGESTION_PIPELINE.md) | CSV/PDF import pipeline stages |
| [APPWRITE_SETUP.md](APPWRITE_SETUP.md) | Appwrite collections, env vars, setup scripts |

### Design & UX
| Document | Description |
|----------|-------------|
| [DESIGN.md](DESIGN.md) | Visual direction (Dark Neo), color palette, typography |
| [WIREFRAMES.md](WIREFRAMES.md) | Text-based wireframes for all pages |
| [UX_SPEC.md](UX_SPEC.md) | UX specification and interaction patterns |
| [INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md) | Navigation and core workflows |

### Features & Testing
| Document | Description |
|----------|-------------|
| [MULTI_WORKSPACE_FEATURE.md](MULTI_WORKSPACE_FEATURE.md) | User guide: workspaces, roles, invitations |
| [TESTING_PLAN.md](TESTING_PLAN.md) | Manual and automated test plan |

### Implementation Plans (`.claude/`)
| Document | Description |
|----------|-------------|
| [multi-user-workspace-plan.md](../.claude/plans/multi-user-workspace-plan.md) | Detailed workspace implementation plan (all phases complete) |
| [deployment-readiness.md](../.claude/deployment-readiness.md) | Pre-deployment checklist and rollback plan |

---

## Success Criteria

- Monthly close completed in under 15 minutes after import
- Unknown category rate under 10% after 3 months of use
- Net worth and category summaries match manual checks within 1% variance
