# MVP Readiness Plan

Reviewed Feb 2026. Tracks gaps between "personal use" and "general public use" for FinanceLab.

## Tier 1 — Blockers (DONE)

- [x] Remove hardcoded "William"/"Peggy" — asset owners now dynamic from workspace members
- [x] Fail-fast on missing secrets (SESSION_SECRET, INVITATION_SECRET)
- [x] Add password reset flow (forgot-password + reset-password pages, Appwrite recovery)
- [x] Add email verification on signup (auto-send, banner for unverified, resend, verify-email page)
- [x] Fix dashboard_cards workspace isolation (getStatCards computes from workspace-scoped assets)

## Tier 2 — Expected for MVP

- [ ] **Rate limiting on auth endpoints** — login, signup, forgot-password, and invitation routes have no throttling. Add rate limiting to prevent brute-force attacks. Consider middleware-level or Vercel Edge Config rate limiting.
- [ ] **Add error.tsx / error boundaries** — no `error.tsx` files exist anywhere. If a server component throws, users see the default Next.js error page. Add `error.tsx` to `(shell)/` and key route groups. Add client-side error boundaries for interactive components.
- [ ] **Remove debug logging and debugReason from UI** — `debugReason` field is rendered in `review/TransferMatchClient.tsx:205`. 13+ `console.log` statements in production routes log user emails, IDs, and query parameters. Strip debug output or gate behind `NODE_ENV !== "production"`.
- [ ] **Account deletion / data export** — no way for users to delete their account or export their data. Required for user trust and likely for GDPR/privacy compliance.
- [ ] **Basic automated tests** — zero test files exist. Add at minimum: auth flow tests (signup, login, session expiry), permission enforcement tests (viewer can't edit, non-member can't access), import/transaction pipeline tests (CSV parse → categorize → commit).

## Tier 3 — Important, can follow fast (post-launch week 1)

- [ ] **Terms of Service / Privacy Policy pages** — required when handling other people's financial data. Add static pages and a consent checkbox on signup.
- [ ] **CSRF token validation** — `SameSite=Lax` provides partial protection but isn't sufficient for state-changing POST/PATCH/DELETE. Noted as TODO in `plans/multi-user-workspace-plan.md`.
- [ ] **Consistent API error response format** — some routes return `{ detail: "..." }`, others `{ error: "..." }`. Standardize on one shape.
- [ ] **In-app onboarding / empty states** — new users land on an empty dashboard with no guidance. Add empty states with CTAs for importing data, setting up categories, etc.
- [ ] **Workspace deletion** — users can create workspaces but not delete them.

## Tier 4 — Nice to have (polish)

- [ ] **Loading states (loading.tsx)** — no `loading.tsx` files. Add to shell and key pages.
- [ ] **Structured logging** — replace `console.*` with structured logger. Remove sensitive data from logs.
- [ ] **Docker / deployment configuration** — no container config for reproducible deployment.
- [ ] **Database migration versioning** — schema changes are one-off scripts with no versioning.
- [ ] **In-app help / documentation** — no guidance for CSV import format, voice input, review queue, etc.
