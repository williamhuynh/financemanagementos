# Subscription Tiers & Feature Gating — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a plan/tier system to workspaces with quota enforcement, upgrade UX, billing settings, and a superadmin panel.

**Architecture:** A `plan` string field on the workspace collection (`"free"` | `"pro"`) plus a `feature_overrides` JSON string for per-workspace exceptions. A shared `lib/plans.ts` config defines limits and features. Server-side enforcement in API routes; client-side upgrade modal for UX. A superadmin role (Appwrite user labels) gates an admin panel for managing all workspaces.

**Tech Stack:** Next.js 16 (App Router), Appwrite (database), Vitest (tests), TypeScript

---

## Task 1: Plan Configuration and Type Definitions

**Files:**
- Create: `apps/web/lib/plans.ts`
- Modify: `apps/web/lib/workspace-types.ts`

**Step 1: Write the failing test**

Create `apps/web/lib/__tests__/plans.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getPlanConfig,
  getWorkspaceFeatures,
  hasFeature,
  getLimit,
  isAtLimit,
  PLAN_IDS,
} from "../plans";

describe("getPlanConfig", () => {
  it("returns free plan config", () => {
    const config = getPlanConfig("free");
    expect(config.label).toBe("Free");
    expect(config.limits.maxAccounts).toBe(5);
    expect(config.limits.maxAssets).toBe(8);
    expect(config.limits.maxMembers).toBe(2);
  });

  it("returns pro plan config", () => {
    const config = getPlanConfig("pro");
    expect(config.label).toBe("Pro");
    expect(config.limits.maxAccounts).toBe(Infinity);
    expect(config.limits.maxAssets).toBe(Infinity);
    expect(config.limits.maxMembers).toBe(5);
  });

  it("falls back to free for unknown plan", () => {
    const config = getPlanConfig("unknown" as any);
    expect(config.label).toBe("Free");
  });
});

describe("getLimit", () => {
  it("returns numeric limit for free plan", () => {
    expect(getLimit("free", "maxAccounts")).toBe(5);
    expect(getLimit("free", "maxAssets")).toBe(8);
    expect(getLimit("free", "maxMembers")).toBe(2);
  });

  it("returns Infinity for pro plan unlimited fields", () => {
    expect(getLimit("pro", "maxAccounts")).toBe(Infinity);
    expect(getLimit("pro", "maxAssets")).toBe(Infinity);
  });
});

describe("isAtLimit", () => {
  it("returns true when count equals limit", () => {
    expect(isAtLimit("free", 5, "maxAccounts")).toBe(true);
  });

  it("returns true when count exceeds limit", () => {
    expect(isAtLimit("free", 6, "maxAccounts")).toBe(true);
  });

  it("returns false when under limit", () => {
    expect(isAtLimit("free", 4, "maxAccounts")).toBe(false);
  });

  it("never returns true for unlimited (Infinity) limits", () => {
    expect(isAtLimit("pro", 99999, "maxAccounts")).toBe(false);
  });
});

describe("hasFeature", () => {
  it("returns true for features included in plan", () => {
    expect(hasFeature("free", "[]", "csv_import")).toBe(true);
  });

  it("returns true for features in overrides even if not in plan", () => {
    expect(hasFeature("free", '["bank_feeds"]', "bank_feeds")).toBe(true);
  });

  it("returns false for features not in plan or overrides", () => {
    // When a feature is eventually removed from the free plan list
    expect(hasFeature("free", "[]", "nonexistent_feature")).toBe(false);
  });

  it("handles malformed overrides JSON gracefully", () => {
    expect(hasFeature("free", "not-json", "csv_import")).toBe(true);
  });
});

describe("getWorkspaceFeatures", () => {
  it("merges plan features with overrides", () => {
    const features = getWorkspaceFeatures("free", '["bank_feeds"]');
    expect(features).toContain("csv_import");
    expect(features).toContain("bank_feeds");
  });

  it("deduplicates features", () => {
    const features = getWorkspaceFeatures("free", '["csv_import"]');
    const csvCount = features.filter((f) => f === "csv_import").length;
    expect(csvCount).toBe(1);
  });
});

describe("PLAN_IDS", () => {
  it("exports plan ID constants", () => {
    expect(PLAN_IDS.FREE).toBe("free");
    expect(PLAN_IDS.PRO).toBe("pro");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run lib/__tests__/plans.test.ts`
Expected: FAIL — module `../plans` does not exist

**Step 3: Write the plan configuration**

Create `apps/web/lib/plans.ts`:

```typescript
export const PLAN_IDS = {
  FREE: "free",
  PRO: "pro",
} as const;

export type PlanId = (typeof PLAN_IDS)[keyof typeof PLAN_IDS];

export type LimitKey = "maxAccounts" | "maxAssets" | "maxMembers";

interface PlanLimits {
  maxAccounts: number;
  maxAssets: number;
  maxMembers: number;
}

interface PlanConfig {
  label: string;
  limits: PlanLimits;
  features: string[];
}

/**
 * All known feature keys. Used by admin panel to render checkboxes.
 * Add new feature keys here as they are built.
 */
export const ALL_FEATURES = [
  "csv_import",
  "pdf_import",
  "manual_assets",
  "ai_categorization",
  "voice_logs",
  "bank_feeds",
] as const;

export type FeatureKey = (typeof ALL_FEATURES)[number];

const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    label: "Free",
    limits: {
      maxAccounts: 5,
      maxAssets: 8,
      maxMembers: 2,
    },
    // All features enabled on both plans for now
    features: [
      "csv_import",
      "pdf_import",
      "manual_assets",
      "ai_categorization",
      "voice_logs",
      "bank_feeds",
    ],
  },
  pro: {
    label: "Pro",
    limits: {
      maxAccounts: Infinity,
      maxAssets: Infinity,
      maxMembers: 5,
    },
    features: [
      "csv_import",
      "pdf_import",
      "manual_assets",
      "ai_categorization",
      "voice_logs",
      "bank_feeds",
    ],
  },
};

export function getPlanConfig(planId: string): PlanConfig {
  return PLANS[planId as PlanId] ?? PLANS.free;
}

export function getLimit(planId: string, limitKey: LimitKey): number {
  return getPlanConfig(planId).limits[limitKey];
}

export function isAtLimit(
  planId: string,
  currentCount: number,
  limitKey: LimitKey
): boolean {
  const limit = getLimit(planId, limitKey);
  if (limit === Infinity) return false;
  return currentCount >= limit;
}

function parseOverrides(featureOverrides: string): string[] {
  try {
    const parsed = JSON.parse(featureOverrides);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getWorkspaceFeatures(
  planId: string,
  featureOverrides: string
): string[] {
  const planFeatures = getPlanConfig(planId).features;
  const overrides = parseOverrides(featureOverrides);
  return [...new Set([...planFeatures, ...overrides])];
}

export function hasFeature(
  planId: string,
  featureOverrides: string,
  featureKey: string
): boolean {
  return getWorkspaceFeatures(planId, featureOverrides).includes(featureKey);
}
```

**Step 4: Update workspace types**

In `apps/web/lib/workspace-types.ts`, add `plan` and `feature_overrides` to
the `ApiContext` interface:

```typescript
export interface ApiContext {
  config: ApiConfig;
  user: AuthenticatedUser;
  workspaceId: string;
  role: WorkspaceMemberRole;
  plan: string;
  featureOverrides: string;
  databases: any;
}
```

**Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run lib/__tests__/plans.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/web/lib/plans.ts apps/web/lib/__tests__/plans.test.ts apps/web/lib/workspace-types.ts
git commit -m "feat: add plan configuration and quota helpers"
```

---

## Task 2: Add Plan Data to Workspace Collection and API Context

**Files:**
- Modify: `apps/web/lib/api-auth.ts:82-158` (getApiContext)
- Modify: `apps/web/lib/workspace-service.ts:6-11` (Workspace interface)
- Modify: `apps/web/lib/workspace-service.ts:114-152` (createWorkspaceForUser)
- Modify: `apps/web/lib/workspace-service.ts:159-176` (getWorkspaceById)
- Modify: `apps/web/lib/workspace-service.ts:71-109` (getWorkspacesForUser)
- Modify: `apps/web/lib/workspace-context.tsx:6-12` (client Workspace interface)
- Modify: `apps/web/app/api/workspaces/route.ts:62-80` (GET response shape)
- Modify: `apps/web/app/api/workspaces/route.ts:142-151` (POST create doc)

**Prerequisite:** Before this task, add `plan` (string, default `"free"`) and
`feature_overrides` (string, default `"[]"`) attributes to the `workspaces`
collection in the Appwrite console. Update existing workspace documents to have
these defaults. Document this in the step.

**Step 1: Add fields in Appwrite console**

Manual step — in Appwrite Console:
1. Go to `workspaces` collection → Attributes
2. Add string attribute `plan`, size 20, default `"free"`, required: false
3. Add string attribute `feature_overrides`, size 4096, default `"[]"`, required: false
4. Update existing workspace documents to set `plan: "free"` and `feature_overrides: "[]"`

**Step 2: Update server-side Workspace interface**

In `apps/web/lib/workspace-service.ts`, update the `Workspace` interface:

```typescript
export interface Workspace {
  $id: string;
  name: string;
  currency: string;
  owner_id: string;
  plan: string;
  feature_overrides: string;
}
```

Update `getWorkspaceById` to include the new fields in its return:

```typescript
return {
  $id: workspace.$id,
  name: workspace.name as string,
  currency: workspace.currency as string,
  owner_id: workspace.owner_id as string,
  plan: (workspace.plan as string) || "free",
  feature_overrides: (workspace.feature_overrides as string) || "[]",
};
```

Apply the same pattern to `getWorkspacesForUser` (the loop that builds workspace objects).

Update `createWorkspaceForUser` to include `plan: "free"` and `feature_overrides: "[]"`
in the createDocument call, and include them in the return object.

**Step 3: Update getApiContext to include plan data**

In `apps/web/lib/api-auth.ts`, after the membership check succeeds (around line 146),
fetch the workspace to get plan data and include it in the returned context:

```typescript
// Fetch workspace for plan data
const workspaceDoc = await adminDatabases.getDocument(
  config.databaseId,
  COLLECTIONS.WORKSPACES,
  activeWorkspaceId
);

return {
  config,
  user: { ... },
  workspaceId: activeWorkspaceId,
  role: membership.documents[0].role as WorkspaceMemberRole,
  plan: (workspaceDoc.plan as string) || "free",
  featureOverrides: (workspaceDoc.feature_overrides as string) || "[]",
  databases: adminDatabases,
};
```

**Step 4: Update client-side Workspace interface**

In `apps/web/lib/workspace-context.tsx`, update the Workspace interface:

```typescript
export interface Workspace {
  id: string;
  name: string;
  currency: string;
  owner_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  plan: string;
  feature_overrides: string;
}
```

**Step 5: Update GET /api/workspaces to include plan in response**

In `apps/web/app/api/workspaces/route.ts`, update the workspace object in the
GET handler loop (around line 69-75):

```typescript
workspaces.push({
  id: workspace.$id,
  name: workspace.name,
  currency: workspace.currency,
  owner_id: workspace.owner_id,
  role: membership.role,
  plan: (workspace.plan as string) || "free",
  feature_overrides: (workspace.feature_overrides as string) || "[]",
});
```

**Step 6: Update POST /api/workspaces to set plan on creation**

In the POST handler (around line 142-151), add `plan: "free"` and
`feature_overrides: "[]"` to the createDocument data, and include them in the
response object.

**Step 7: Run type-check and tests**

Run: `cd apps/web && npx tsc --noEmit && npm test`
Expected: PASS (fix any type errors from the new required fields)

**Step 8: Commit**

```bash
git add apps/web/lib/api-auth.ts apps/web/lib/workspace-service.ts apps/web/lib/workspace-context.tsx apps/web/app/api/workspaces/route.ts
git commit -m "feat: add plan and feature_overrides to workspace data model"
```

---

## Task 3: Server-Side Quota Enforcement

**Files:**
- Modify: `apps/web/app/api/assets/route.ts:10-74` (POST handler)
- Modify: `apps/web/app/api/workspaces/[id]/invitations/route.ts:55-129` (POST handler)
- Modify: `apps/web/app/api/workspaces/route.ts:102-203` (POST handler — workspace creation limit is not needed now but account limit on import is a future consideration)

Assets and members are the two create-time enforcement points. Accounts are
derived from transaction `account_name` values, not a separate collection —
so account limits are enforced at **import time** when new account names appear.
That's more complex and can be deferred to a follow-up. For now, enforce:
- **Assets**: Check count before creating a new asset
- **Members**: Check count (members + pending invitations) before creating an invitation

**Step 1: Add quota check to POST /api/assets**

In `apps/web/app/api/assets/route.ts`, after the `requireWorkspacePermission` call
and before creating the document, add:

```typescript
import { Query } from "node-appwrite";
import { isAtLimit } from "../../../lib/plans";

// Check asset quota
const existingAssets = await databases.listDocuments(config.databaseId, "assets", [
  Query.equal("workspace_id", workspaceId),
  Query.limit(1), // We only need the total count
]);
if (isAtLimit(ctx.plan, existingAssets.total, "maxAssets")) {
  return NextResponse.json(
    { error: "Asset limit reached. Upgrade your plan to add more assets." },
    { status: 403 }
  );
}
```

**Step 2: Add quota check to POST /api/workspaces/[id]/invitations**

In the invitations POST handler, after `requireWorkspacePermission` and before
`createInvitation`, add:

```typescript
import { isAtLimit } from "../../../../../lib/plans";
import { COLLECTIONS } from "../../../../../lib/collection-names";

// Check member quota (members + pending invitations)
const [members, pendingInvites] = await Promise.all([
  ctx.databases.listDocuments(ctx.config.databaseId, COLLECTIONS.WORKSPACE_MEMBERS, [
    Query.equal("workspace_id", workspaceId),
    Query.limit(1),
  ]),
  ctx.databases.listDocuments(ctx.config.databaseId, COLLECTIONS.WORKSPACE_INVITATIONS, [
    Query.equal("workspace_id", workspaceId),
    Query.equal("status", "pending"),
    Query.limit(1),
  ]),
]);
const totalMembers = members.total + pendingInvites.total;
if (isAtLimit(ctx.plan, totalMembers, "maxMembers")) {
  return NextResponse.json(
    { error: "Member limit reached. Upgrade your plan to invite more people." },
    { status: 403 }
  );
}
```

Note: The invitation route doesn't currently have `ctx.plan` available because
it uses a separate `workspaceId` from params. We need to fetch the workspace
plan for this route:

```typescript
import { getWorkspaceById } from "../../../../../lib/workspace-service";

const workspace = await getWorkspaceById(workspaceId);
const plan = workspace?.plan || "free";
```

**Step 3: Run tests and type-check**

Run: `cd apps/web && npx tsc --noEmit && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/app/api/assets/route.ts apps/web/app/api/workspaces/[id]/invitations/route.ts
git commit -m "feat: add server-side quota enforcement for assets and members"
```

---

## Task 4: Upgrade Modal Component

**Files:**
- Create: `packages/ui/src/components/UpgradeModal.tsx`
- Modify: `packages/ui/src/index.ts` (add export)
- Create: CSS styles in `apps/web/app/globals.css`

**Step 1: Create the UpgradeModal component**

Create `packages/ui/src/components/UpgradeModal.tsx`:

```typescript
"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  limitLabel: string;    // e.g. "accounts", "assets", "members"
  currentCount: number;
  maxCount: number;
  planLabel?: string;     // e.g. "Free"
};

export function UpgradeModal({
  open,
  onClose,
  limitLabel,
  currentCount,
  maxCount,
  planLabel = "Free",
}: UpgradeModalProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div className="upgrade-modal-overlay">
      <button
        className="upgrade-modal-backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div className="upgrade-modal" role="dialog" aria-modal="true">
        <div className="upgrade-modal-header">
          <h3>Plan limit reached</h3>
          <button className="ghost-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="upgrade-modal-body">
          <p>
            You&apos;ve reached the {planLabel} plan limit of{" "}
            <strong>
              {maxCount} {limitLabel}
            </strong>
            .
          </p>
          <div className="upgrade-modal-usage">
            <div className="upgrade-modal-bar">
              <div
                className="upgrade-modal-bar-fill"
                style={{ width: "100%" }}
              />
            </div>
            <span className="upgrade-modal-count">
              {currentCount}/{maxCount} {limitLabel} used
            </span>
          </div>
          <p className="upgrade-modal-cta-text">
            Upgrade to Pro for unlimited {limitLabel} and more.
          </p>
        </div>
        <div className="upgrade-modal-footer">
          <button className="ghost-btn" type="button" onClick={onClose}>
            Maybe later
          </button>
          <a className="primary-btn" href="/settings/billing">
            View plans
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
```

**Step 2: Add export to packages/ui/src/index.ts**

Add: `export { UpgradeModal } from "./components/UpgradeModal";`

**Step 3: Add CSS styles**

Add to `apps/web/app/globals.css`:

```css
/* Upgrade Modal */
.upgrade-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upgrade-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  cursor: default;
}

.upgrade-modal {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.upgrade-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.upgrade-modal-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.upgrade-modal-body {
  padding: 20px;
}

.upgrade-modal-body p {
  margin: 0 0 16px;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.upgrade-modal-usage {
  margin-bottom: 16px;
}

.upgrade-modal-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.upgrade-modal-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
}

.upgrade-modal-count {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.upgrade-modal-cta-text {
  font-weight: 500;
  color: var(--text) !important;
}

.upgrade-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}
```

**Step 4: Commit**

```bash
git add packages/ui/src/components/UpgradeModal.tsx packages/ui/src/index.ts apps/web/app/globals.css
git commit -m "feat: add UpgradeModal component for plan limit prompts"
```

---

## Task 5: Billing Settings Page

**Files:**
- Create: `apps/web/app/(shell)/settings/billing/page.tsx`
- Create: `apps/web/app/(shell)/settings/billing/BillingClient.tsx`

This page shows the workspace's current plan, usage vs limits, and an upgrade CTA.

**Step 1: Create the API endpoint for billing/usage data**

Create `apps/web/app/api/billing/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { getPlanConfig } from "../../../lib/plans";
import { COLLECTIONS } from "../../../lib/collection-names";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspacePermission(ctx.workspaceId, ctx.user.$id, "read");

    const planConfig = getPlanConfig(ctx.plan);

    // Count current usage in parallel
    const [assets, members, accountNames] = await Promise.all([
      ctx.databases.listDocuments(ctx.config.databaseId, COLLECTIONS.ASSETS, [
        Query.equal("workspace_id", ctx.workspaceId),
        Query.limit(1),
      ]),
      ctx.databases.listDocuments(
        ctx.config.databaseId,
        COLLECTIONS.WORKSPACE_MEMBERS,
        [Query.equal("workspace_id", ctx.workspaceId), Query.limit(1)]
      ),
      // Count unique account names from transactions
      (async () => {
        const names = new Set<string>();
        let offset = 0;
        while (true) {
          const resp = await ctx.databases.listDocuments(
            ctx.config.databaseId,
            "transactions",
            [
              Query.equal("workspace_id", ctx.workspaceId),
              Query.limit(100),
              Query.offset(offset),
              Query.select(["account_name"]),
            ]
          );
          for (const doc of resp.documents) {
            const name = String(doc.account_name ?? "").trim();
            if (name) names.add(name);
          }
          offset += resp.documents.length;
          if (resp.documents.length === 0 || offset >= resp.total) break;
        }
        return names.size;
      })(),
    ]);

    return NextResponse.json({
      plan: ctx.plan,
      planLabel: planConfig.label,
      limits: {
        maxAccounts: planConfig.limits.maxAccounts,
        maxAssets: planConfig.limits.maxAssets,
        maxMembers: planConfig.limits.maxMembers,
      },
      usage: {
        accounts: accountNames,
        assets: assets.total,
        members: members.total,
      },
    });
  } catch (error) {
    console.error("Billing GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Create the billing page (server component)**

Create `apps/web/app/(shell)/settings/billing/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { SectionHead } from "@tandemly/ui";
import { getApiContext } from "../../../../lib/api-auth";
import BillingClient from "./BillingClient";

export default async function BillingPage() {
  const ctx = await getApiContext();
  if (!ctx) redirect("/login");

  return (
    <>
      <SectionHead title="Plan & Billing" backHref="/settings" backLabel="Settings" />
      <BillingClient workspaceId={ctx.workspaceId} />
    </>
  );
}
```

**Step 3: Create the billing client component**

Create `apps/web/app/(shell)/settings/billing/BillingClient.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card } from "@tandemly/ui";

interface BillingData {
  plan: string;
  planLabel: string;
  limits: { maxAccounts: number; maxAssets: number; maxMembers: number };
  usage: { accounts: number; assets: number; members: number };
}

function UsageRow({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number;
}) {
  const isUnlimited = max === null || !isFinite(max);
  const pct = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
  const atLimit = !isUnlimited && current >= max;

  return (
    <div className="billing-usage-row">
      <div className="billing-usage-label">
        <span>{label}</span>
        <span className={atLimit ? "billing-at-limit" : ""}>
          {current}
          {isUnlimited ? "" : ` / ${max}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="billing-usage-bar">
          <div
            className={`billing-usage-bar-fill${atLimit ? " billing-usage-bar-full" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingClient({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <Card><p style={{ padding: 20 }}>Loading...</p></Card>;
  if (!data) return <Card><p style={{ padding: 20 }}>Failed to load billing data.</p></Card>;

  return (
    <>
      <Card title="Current Plan">
        <div className="billing-plan-badge">
          <span className="billing-plan-name">{data.planLabel}</span>
          {data.plan === "free" && (
            <span className="billing-upgrade-hint">
              Upgrade to Pro for unlimited accounts, assets, and more members.
            </span>
          )}
        </div>
      </Card>

      <Card title="Usage">
        <div className="billing-usage">
          <UsageRow label="Accounts" current={data.usage.accounts} max={data.limits.maxAccounts} />
          <UsageRow label="Assets" current={data.usage.assets} max={data.limits.maxAssets} />
          <UsageRow label="Members" current={data.usage.members} max={data.limits.maxMembers} />
        </div>
      </Card>
    </>
  );
}
```

**Step 4: Add CSS for billing page**

Add to `apps/web/app/globals.css`:

```css
/* Billing page */
.billing-plan-badge {
  padding: 16px;
}

.billing-plan-name {
  display: inline-block;
  padding: 4px 12px;
  background: var(--accent);
  color: #fff;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.billing-upgrade-hint {
  display: block;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.billing-usage {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.billing-usage-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.billing-usage-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.billing-at-limit {
  color: var(--danger, #e74c3c);
  font-weight: 600;
}

.billing-usage-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.billing-usage-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.billing-usage-bar-full {
  background: var(--danger, #e74c3c);
}
```

**Step 5: Add link to billing page from settings**

In `apps/web/app/(shell)/settings/page.tsx`, add a billing link to the System card
or as a new card:

```typescript
<Card title="Plan & Billing">
  <div className="list-row">
    <div>
      <div className="row-title">Subscription</div>
      <div className="row-sub">View your plan, usage, and billing</div>
    </div>
    <Link className="ghost-btn" href="/settings/billing">
      Manage
    </Link>
  </div>
</Card>
```

**Step 6: Run type-check and dev server test**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/web/app/api/billing/route.ts apps/web/app/(shell)/settings/billing/ apps/web/app/(shell)/settings/page.tsx apps/web/app/globals.css
git commit -m "feat: add billing settings page with plan and usage display"
```

---

## Task 6: Superadmin Guard

**Files:**
- Create: `apps/web/lib/admin-guard.ts`
- Create: `apps/web/lib/__tests__/admin-guard.test.ts`

**Step 1: Write the failing test**

Create `apps/web/lib/__tests__/admin-guard.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isSuperadmin } from "../admin-guard";

describe("isSuperadmin", () => {
  it("returns true when user has superadmin label", () => {
    expect(isSuperadmin(["superadmin"])).toBe(true);
  });

  it("returns true when superadmin is among multiple labels", () => {
    expect(isSuperadmin(["beta", "superadmin", "vip"])).toBe(true);
  });

  it("returns false when user has no labels", () => {
    expect(isSuperadmin([])).toBe(false);
  });

  it("returns false when user has other labels but not superadmin", () => {
    expect(isSuperadmin(["beta", "vip"])).toBe(false);
  });

  it("returns false for undefined/null labels", () => {
    expect(isSuperadmin(undefined as any)).toBe(false);
    expect(isSuperadmin(null as any)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run lib/__tests__/admin-guard.test.ts`
Expected: FAIL

**Step 3: Implement the admin guard**

Create `apps/web/lib/admin-guard.ts`:

```typescript
/**
 * Check if a user has the superadmin label.
 * Superadmin is a platform-level role stored in Appwrite user labels,
 * separate from workspace RBAC.
 */
export function isSuperadmin(labels: string[] | undefined | null): boolean {
  if (!Array.isArray(labels)) return false;
  return labels.includes("superadmin");
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run lib/__tests__/admin-guard.test.ts`
Expected: PASS

**Step 5: Add the superadmin label to your user in Appwrite**

Manual step — in Appwrite Console:
1. Go to Auth → Users → find your user
2. Add label `superadmin` to your user account

**Step 6: Commit**

```bash
git add apps/web/lib/admin-guard.ts apps/web/lib/__tests__/admin-guard.test.ts
git commit -m "feat: add superadmin guard for platform-level access control"
```

---

## Task 7: Admin API Endpoints

**Files:**
- Create: `apps/web/app/api/admin/workspaces/route.ts`
- Create: `apps/web/app/api/admin/workspaces/[id]/route.ts`

**Step 1: Create the admin workspaces list endpoint**

Create `apps/web/app/api/admin/workspaces/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext, createSessionClient } from "../../../../lib/api-auth";
import { isSuperadmin } from "../../../../lib/admin-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";
import { COLLECTIONS } from "../../../../lib/collection-names";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check superadmin via Appwrite user labels
    const session = await createSessionClient();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await session.account.get();
    if (!isSuperadmin(user.labels)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { databases, config } = ctx;

    // Get search param
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";

    // Fetch all workspaces
    const queries = [Query.orderDesc("$createdAt"), Query.limit(100)];
    if (search) {
      queries.push(Query.search("name", search));
    }

    const workspaces = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.WORKSPACES,
      queries
    );

    // For each workspace, get usage counts
    const results = await Promise.all(
      workspaces.documents.map(async (ws) => {
        const [members, assets] = await Promise.all([
          databases.listDocuments(config.databaseId, COLLECTIONS.WORKSPACE_MEMBERS, [
            Query.equal("workspace_id", ws.$id),
            Query.limit(1),
          ]),
          databases.listDocuments(config.databaseId, COLLECTIONS.ASSETS, [
            Query.equal("workspace_id", ws.$id),
            Query.limit(1),
          ]),
        ]);

        return {
          id: ws.$id,
          name: ws.name,
          owner_id: ws.owner_id,
          plan: ws.plan || "free",
          feature_overrides: ws.feature_overrides || "[]",
          memberCount: members.total,
          assetCount: assets.total,
        };
      })
    );

    return NextResponse.json({ workspaces: results });
  } catch (error) {
    console.error("Admin workspaces GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Create the admin workspace update endpoint**

Create `apps/web/app/api/admin/workspaces/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getApiContext, createSessionClient } from "../../../../../lib/api-auth";
import { isSuperadmin } from "../../../../../lib/admin-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../../lib/rate-limit";
import { COLLECTIONS } from "../../../../../lib/collection-names";
import { PLAN_IDS } from "../../../../../lib/plans";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const { id: workspaceId } = await context.params;
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await createSessionClient();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await session.account.get();
    if (!isSuperadmin(user.labels)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const update: Record<string, string> = {};

    // Validate plan
    if (body.plan !== undefined) {
      if (body.plan !== PLAN_IDS.FREE && body.plan !== PLAN_IDS.PRO) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }
      update.plan = body.plan;
    }

    // Validate feature_overrides
    if (body.feature_overrides !== undefined) {
      try {
        const parsed = JSON.parse(body.feature_overrides);
        if (!Array.isArray(parsed)) {
          return NextResponse.json(
            { error: "feature_overrides must be a JSON array" },
            { status: 400 }
          );
        }
        update.feature_overrides = body.feature_overrides;
      } catch {
        return NextResponse.json(
          { error: "feature_overrides must be valid JSON" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await ctx.databases.updateDocument(
      ctx.config.databaseId,
      COLLECTIONS.WORKSPACES,
      workspaceId,
      update
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin workspace PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Run type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/app/api/admin/
git commit -m "feat: add admin API endpoints for workspace management"
```

---

## Task 8: Admin Panel UI

**Files:**
- Create: `apps/web/app/(shell)/admin/page.tsx`
- Create: `apps/web/app/(shell)/admin/AdminClient.tsx`

**Step 1: Create the admin page (server component with superadmin gate)**

Create `apps/web/app/(shell)/admin/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { SectionHead } from "@tandemly/ui";
import { getApiContext, createSessionClient } from "../../../lib/api-auth";
import { isSuperadmin } from "../../../lib/admin-guard";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const ctx = await getApiContext();
  if (!ctx) redirect("/login");

  const session = await createSessionClient();
  if (!session) redirect("/login");

  const user = await session.account.get();
  if (!isSuperadmin(user.labels)) redirect("/dashboard");

  return (
    <>
      <SectionHead title="Admin — Workspaces" />
      <AdminClient />
    </>
  );
}
```

**Step 2: Create the admin client component**

Create `apps/web/app/(shell)/admin/AdminClient.tsx`. This component:
- Fetches `/api/admin/workspaces` on mount
- Shows a table/list of all workspaces with name, plan, member count, asset count
- Has a search box to filter
- Clicking a workspace opens a detail panel (using `DetailPanel` from `@tandemly/ui`)
  where you can change the plan and toggle feature overrides

The component should:
- Use `DetailPanel` for the edit view (consistent with other pages)
- Show plan as a `<select>` dropdown (free/pro)
- Show feature overrides as a checkbox list using `ALL_FEATURES` from `lib/plans.ts`
- Save changes via PATCH to `/api/admin/workspaces/[id]`

This is a larger UI component — implement it following the patterns in
`apps/web/app/(shell)/ledger/LedgerClient.tsx` and
`apps/web/app/(shell)/import-hub/ImportClient.tsx` for the detail panel integration.

**Step 3: Add CSS for admin panel**

Add to `apps/web/app/globals.css`:

```css
/* Admin panel */
.admin-search {
  padding: 12px 16px;
}

.admin-search input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}

.admin-workspace-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}

.admin-workspace-row:hover {
  background: var(--hover);
}

.admin-workspace-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-workspace-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.admin-workspace-meta {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.admin-plan-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.admin-plan-badge.free {
  background: var(--border);
  color: var(--text-muted);
}

.admin-plan-badge.pro {
  background: var(--accent);
  color: #fff;
}

.admin-detail-field {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.admin-detail-field label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.admin-detail-field select {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
}

.admin-feature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.admin-feature-item input[type="checkbox"] {
  accent-color: var(--accent);
}
```

**Step 4: Conditionally show Admin nav link for superadmins**

This is optional for now. The admin panel can be accessed directly via URL
(`/admin`). Adding it to the nav requires passing the superadmin status down
to the Sidebar, which can be done in a follow-up.

**Step 5: Run type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/app/(shell)/admin/ apps/web/app/globals.css
git commit -m "feat: add admin panel for workspace plan and feature management"
```

---

## Task 9: Wire Upgrade Modal into Existing UI

**Files:**
- Modify: Asset creation UI (find the component that handles "Add Asset" button)
- Modify: Member invitation UI (`apps/web/app/(shell)/settings/MembersSection.tsx`)

For each create action that has a quota:
1. Import `useWorkspace` to get the current workspace's plan
2. Before opening the create form, check if at limit
3. If at limit, show `<UpgradeModal>` instead

The exact implementation depends on how each form is currently triggered.
Follow the pattern:

```typescript
import { UpgradeModal } from "@tandemly/ui";
import { isAtLimit, getLimit } from "../../../lib/plans";

// In the component:
const { currentWorkspace } = useWorkspace();
const [showUpgrade, setShowUpgrade] = useState(false);

// When user clicks "Add Asset":
const handleAdd = () => {
  if (currentWorkspace && isAtLimit(currentWorkspace.plan, currentAssetCount, "maxAssets")) {
    setShowUpgrade(true);
    return;
  }
  // Open the normal form...
};

// In the JSX:
<UpgradeModal
  open={showUpgrade}
  onClose={() => setShowUpgrade(false)}
  limitLabel="assets"
  currentCount={currentAssetCount}
  maxCount={getLimit(currentWorkspace?.plan || "free", "maxAssets")}
/>
```

Apply this pattern to:
- Asset creation
- Member invitation (in MembersSection.tsx)

**Step 1: Wire into asset creation**

Find the asset add button/form component and add the check. The exact file
will need to be located — likely in `apps/web/app/(shell)/assets/` or
the dashboard.

**Step 2: Wire into member invitation**

In `apps/web/app/(shell)/settings/MembersSection.tsx`, before the invite
form submission, check member count against limit.

**Step 3: Test manually**

- Set your workspace to `plan: "free"` in Appwrite console
- Verify that when you're at 8 assets, trying to add another shows the modal
- Verify that when you're at 2 members, trying to invite shows the modal
- Set plan to `"pro"` and verify no limits

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire upgrade modal into asset and member creation flows"
```

---

## Task 10: Final Verification

**Step 1: Run full test suite**

```bash
cd apps/web
npm test
npx eslint app/ lib/
npx tsc --noEmit
npm run build
```

**Step 2: Manual E2E verification**

- Free workspace: verify asset limit (8), member limit (2)
- Pro workspace: verify no limits
- Billing page: shows correct plan and usage
- Admin panel: can change plan, toggle feature overrides
- Upgrade modal: appears correctly, links to billing page
- Feature overrides: workspace with `["bank_feeds"]` override has that feature

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
