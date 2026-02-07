# Roadmap

Reviewed Feb 2026. Tracks progress from working app to public-ready MVP and beyond.

---

## Phase 1: MVP — Core Features (DONE)

All core functionality is built and working:

- [x] PWA shell + authentication (iron-session + Appwrite)
- [x] CSV import with column mapping and preview
- [x] Ledger + review queue
- [x] Categorization rules and transfer matching
- [x] Dashboard summary + monthly reports
- [x] Assets with manual valuations
- [x] Multi-user workspaces with dynamic asset owners
- [x] Password reset flow (forgot-password + reset-password)
- [x] Email verification on signup (auto-send, banner, resend, verify page)
- [x] Fail-fast on missing secrets (SESSION_SECRET, INVITATION_SECRET)
- [x] Dashboard cards workspace isolation

---

## Phase 1.5: MVP Hardening (Current Focus)

These items close the gap between "works for personal use" and "ready for other people to use."

### Blockers — Must ship before public launch

- [ ] **Rate limiting on auth endpoints** — Login, signup, forgot-password, and invitation routes have no throttling. Add middleware-level rate limiting to prevent brute-force attacks.
- [ ] **Error boundaries (error.tsx)** — No `error.tsx` files exist. If a server component throws, users see the default Next.js error page. Add `error.tsx` to `(shell)/` and key route groups. Add client-side error boundaries for interactive components.
- [ ] **Strip debug output** — `debugReason` rendered in `review/TransferMatchClient.tsx:205`. 13+ `console.log` statements in production routes log user emails, IDs, and query parameters. Gate behind `NODE_ENV !== "production"` or remove entirely.
- [ ] **Account deletion / data export** — No way for users to delete their account or export their data. Required for user trust and likely for GDPR/privacy compliance.
- [ ] **Basic automated tests** — Zero test files exist. At minimum add: auth flow tests (signup, login, session expiry), permission enforcement tests (viewer can't edit, non-member can't access), import/transaction pipeline tests (CSV parse → categorize → commit).

### Fast-follow — Ship within first week post-launch

- [ ] **Terms of Service / Privacy Policy pages** — Required when handling financial data. Add static pages and a consent checkbox on signup.
- [ ] **CSRF token validation** — `SameSite=Lax` provides partial protection but isn't sufficient for state-changing POST/PATCH/DELETE. Add explicit CSRF tokens.
- [ ] **Consistent API error response format** — Some routes return `{ detail: "..." }`, others `{ error: "..." }`. Standardize on one shape.
- [ ] **In-app onboarding / empty states** — New users land on an empty dashboard with no guidance. Add empty states with CTAs for importing data, setting up categories, etc.
- [ ] **Workspace deletion** — Users can create workspaces but not delete them. See multi-user workspace plan for implementation details.

### Polish — Nice to have

- [ ] **Loading states (loading.tsx)** — No `loading.tsx` files. Add to shell and key pages for better perceived performance.
- [ ] **Structured logging** — Replace `console.*` with structured logger. Remove sensitive data from logs.
- [ ] **Docker / deployment configuration** — No container config for reproducible deployment.
- [ ] **Database migration versioning** — Schema changes are one-off scripts with no versioning.
- [ ] **In-app help / documentation** — No guidance for CSV import format, voice input, review queue, etc.

---

## Phase 2: Quality

- [ ] PDF parsing + OCR for statement imports
- [ ] Improved duplicate detection
- [ ] Category suggestions from transaction history
- [ ] Data export improvements (CSV, JSON)

---

## Phase 3: Automation

- [ ] Provider integrations (Open Banking where available)
- [ ] Automated valuations for selected assets
- [ ] Scheduled monthly snapshot and reminders

---

## Related Plans

| Plan | Location | Purpose |
|------|----------|---------|
| Multi-user workspace implementation | `.claude/plans/multi-user-workspace-plan.md` | Security, RBAC, invitations, workspace lifecycle |
| Multi-workspace testing | `.claude/testing-plan.md` | Test cases for workspace isolation, permissions, invitations |
| Requirements & success criteria | `docs/REQUIREMENTS.md` | MVP scope, goals, and acceptance criteria |

---

## Success Criteria

From `docs/REQUIREMENTS.md`:

- Monthly close completed in under 15 minutes after import
- Unknown category rate under 10% after 3 months of use
- Net worth and category summaries match manual checks within 1% variance
