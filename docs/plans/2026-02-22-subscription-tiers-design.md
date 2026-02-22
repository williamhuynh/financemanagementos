# Subscription Tiers & Feature Gating — Design

**Date:** 2026-02-22
**Status:** Approved

## Goal

Add a subscription tier system to Tandemly so workspaces can be free or paid,
with quota enforcement (accounts, assets, members) and per-workspace feature
overrides for experimental/regional features. Includes an admin panel for
platform-level workspace management.

Stripe integration is deferred to a follow-up phase. This phase builds the
gating infrastructure, upgrade UX, billing settings page, and admin panel.

## Mental Model

- The **workspace** represents a household. One person subscribes, others are
  invited. Everyone in the workspace shares the same plan and features.
- The workspace **owner** is the subscriber/billing contact.
- Each workspace has a **plan** (`free` | `pro`) that defines default limits
  and features.
- Each workspace can have **feature overrides** — a list of feature keys
  enabled regardless of plan. Used for experimental features, regional
  features, beta testing, or developer use.

## Tiers

| | Free | Pro |
|---|---|---|
| Accounts | 5 | Unlimited |
| Assets | 8 | Unlimited |
| Members | 2 | 5 |
| Features | All (for now) | All (for now) |

All features are enabled on both plans initially. Features will be moved to
paid-only as they mature.

## Data Model Changes

**`workspaces` collection — add 2 fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `plan` | string | `"free"` | Tier: `"free"` or `"pro"` |
| `feature_overrides` | string | `"[]"` | JSON array of feature keys enabled for this workspace regardless of plan |

Existing workspaces get `plan: "free"` and `feature_overrides: "[]"`.

No new collections required.

## Plan Configuration (`lib/plans.ts`)

Single source of truth for plan definitions. Importable by both server and
client code.

```
Plan config structure:
├── Plan ID ("free" | "pro")
│   ├── label: "Free" | "Pro"
│   ├── limits
│   │   ├── maxAccounts: 5 | Infinity
│   │   ├── maxAssets: 8 | Infinity
│   │   └── maxMembers: 2 | 5
│   └── features: string[]  (list of enabled feature keys)
```

**Exported helpers (pure functions, no DB calls):**
- `getPlanConfig(planId)` — returns full config for a plan
- `getWorkspaceFeatures(plan, featureOverrides)` — merges plan defaults with
  overrides, returns full set of enabled features
- `hasFeature(plan, featureOverrides, featureKey)` — boolean check
- `getLimit(plan, limitKey)` — numeric limit for a plan
- `isAtLimit(plan, currentCount, limitKey)` — boolean: has the workspace hit
  the cap?

## Enforcement

### Server-side (API routes)

On create operations (add account, add asset, invite member):

1. `getApiContext()` returns workspace with `plan` and `feature_overrides`
2. Query current count (e.g. how many accounts does this workspace have?)
3. `isAtLimit(plan, currentCount, "maxAccounts")` → if true, return 403
4. Otherwise proceed

For future feature gating: `hasFeature(plan, featureOverrides, "bank_feeds")`
→ if false, return 403.

**Server enforcement is the real gate.** Client-side checks are UX only.

### Client-side (UI)

Workspace plan and feature overrides are available in client context.
Components use the same helpers to decide when to show the upgrade modal
instead of proceeding with an action.

## Upgrade Modal

A reusable `<UpgradeModal>` component. Triggered when a user attempts an
action that exceeds their plan limits.

**Flow:**
1. User clicks "Add Account" (button always visible)
2. Check limit
3. If at limit → show `<UpgradeModal>` instead of opening the form
4. Modal shows: what limit was hit, current usage, plan max, upgrade CTA
5. User dismisses or clicks upgrade

**Props:** limit context (what was hit, current count, plan max).

Until Stripe is wired, the upgrade CTA is a placeholder (e.g. "Contact us"
or a link to the billing settings page).

## Billing Settings Page (`/settings/billing`)

In-app page showing:
- Current plan (Free / Pro)
- Usage vs limits (e.g. 3/5 accounts, 6/8 assets, 1/2 members)
- Upgrade CTA (placeholder until Stripe)

No public pricing page in this phase.

## Admin Panel (`/admin/workspaces`)

**Access:** Protected by a global `superadmin` role stored in Appwrite user
labels. A `lib/admin-guard.ts` utility checks this.

**Workspace list view:**
- All workspaces: name, owner, plan, member count, account count, asset count
- Search and filter

**Workspace detail/edit:**
- Change plan (free ↔ pro)
- Toggle feature overrides (checkbox list of known feature keys)
- View usage stats

## Superadmin Role

A `superadmin` label on the Appwrite user account. Checked by
`requireSuperadmin()` in `lib/admin-guard.ts`.

This is separate from workspace RBAC — a superadmin has platform-level
access to manage all workspaces. They are not automatically a member of
any workspace.

## What's in Scope

- `plan` + `feature_overrides` fields on workspaces collection
- Backfill existing workspaces to `plan: "free"`
- `lib/plans.ts` — plan config + helper functions
- Extend `getApiContext()` to include plan data
- `lib/admin-guard.ts` — superadmin check
- Quota enforcement on accounts, assets, and invitations API routes
- `<UpgradeModal>` component
- Billing settings page (`/settings/billing`)
- Admin panel (`/admin/workspaces`)
- Tests for plan logic and admin guard

## What's NOT in Scope

- Stripe / payment integration (phase 2)
- Public pricing page
- Feature restrictions (all features enabled on both plans for now)
- Automated bank feeds or other paid-only features
