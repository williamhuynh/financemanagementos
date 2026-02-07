# Roadmap

Reviewed Feb 2026. Master plan for FinanceLab — tracks what's shipped, what's next, and what's planned.

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

- [ ] **Rate limiting on auth endpoints** — Login, signup, forgot-password, and invitation routes have no throttling. Add middleware-level rate limiting to prevent brute-force attacks.
- [ ] **Error boundaries (error.tsx)** — No `error.tsx` files exist. Add to `(shell)/` and key route groups. Add client-side error boundaries for interactive components.
- [ ] **Strip debug output** — `debugReason` rendered in `review/TransferMatchClient.tsx:205`. Multiple `console.log` in production routes log user emails/IDs. Gate behind `NODE_ENV` or remove.
- [ ] **Account deletion / data export** — No way for users to delete their account or export data. Required for GDPR compliance.
- [ ] **Basic automated tests** — Zero test files exist. At minimum: auth flow, permission enforcement, import pipeline. See [TESTING_PLAN.md](TESTING_PLAN.md).

### Fast-follow — Ship within first week post-launch

- [ ] **Terms of Service / Privacy Policy pages** — Required for financial data. Add static pages + consent checkbox on signup.
- [ ] **CSRF token validation** — `SameSite=Lax` is partial protection. Add explicit CSRF tokens for POST/PATCH/DELETE.
- [ ] **Consistent API error format** — Some routes return `{ detail }`, others `{ error }`. Standardize on one shape.
- [ ] **Richer empty states** — Basic empty states exist in ledger, assets, review, cash log, and dashboard. Could be richer with CTAs for importing data and setting up categories.
- [ ] **Workspace deletion + leave workspace** — Users can create workspaces but not delete them or leave them.

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
