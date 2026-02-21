# Dashboard Asset Snapshot Detail Panel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clicking an asset snapshot card on the dashboard opens a DetailPanel listing the individual assets in that category.

**Architecture:** Dashboard-local. `DashboardClient` already has `assetOverview.assets` — filter by `type` on card click. Panel content is a read-only list rendered inline. No new API calls, no new shared components.

**Tech Stack:** React, Next.js App Router, `@tandemly/ui` DetailPanel, existing CSS classes.

**Design doc:** `docs/plans/2026-02-22-dashboard-asset-snapshot-panel-design.md`

---

### Task 1: Make Card component interactive

**Files:**
- Modify: `packages/ui/src/components/Card.tsx`

**Step 1: Add optional interactive props to CardProps**

Add `onClick`, `selected`, and keyboard accessibility to the Card component:

```tsx
type CardProps = {
  title: string;
  value?: string;
  sub?: string;
  tone?: CardTone;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
};
```

**Step 2: Update Card render to use interactive props**

When `onClick` is provided, add `role="button"`, `tabIndex={0}`, cursor pointer, `onKeyDown` for Enter/Space, and apply a `selected` CSS class when `selected` is true:

```tsx
export function Card({ title, value, sub, tone = "default", children, className, onClick, selected }: CardProps) {
  const toneClass = tone === "default" ? "" : tone;
  const selectedClass = selected ? "selected" : "";
  const interactiveProps = onClick
    ? {
        onClick,
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  return (
    <article
      className={`card ${toneClass} ${selectedClass} ${className ?? ""}`.trim()}
      {...interactiveProps}
    >
      <div className="card-title">{title}</div>
      {value ? <div className="card-value">{value}</div> : null}
      {sub ? <div className="card-sub">{sub}</div> : null}
      {children}
    </article>
  );
}
```

**Step 3: Commit**

```bash
git add packages/ui/src/components/Card.tsx
git commit -m "feat: add optional onClick and selected props to Card component"
```

---

### Task 2: Add selected card CSS and dashboard asset list styles

**Files:**
- Modify: `apps/web/app/globals.css`

**Step 1: Add card interactive + selected styles**

Add near the existing `.card` styles:

```css
.card[role="button"] {
  cursor: pointer;
}

.card.selected {
  border-color: var(--accent, #f2a43b);
  box-shadow: 0 0 0 1px rgba(242, 164, 59, 0.3);
}
```

**Step 2: Add dashboard asset list row styles**

Add styles for the asset rows inside the detail panel. Reuse `right-drawer-*` classes for labels/values and add a clickable row block:

```css
.dash-asset-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.dash-asset-row:hover {
  background: rgba(255, 255, 255, 0.02);
  border-color: var(--accent, #f2a43b);
}

.dash-asset-row-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.dash-asset-row-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
}
```

**Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style: add card selected state and dashboard asset list row styles"
```

---

### Task 3: Wire up DetailPanel in DashboardClient

**Files:**
- Modify: `apps/web/app/(shell)/dashboard/DashboardClient.tsx`

**Step 1: Add imports**

Add `DetailPanel` to the `@tandemly/ui` import and add `useRouter` from `next/navigation`. Add `AssetItem` to the type import from `lib/data`:

```tsx
import {
  Card,
  DetailPanel,
  DonutChart,
  SectionHead,
  TrendRangeToggle
} from "@tandemly/ui";
```

```tsx
import { useRouter } from "next/navigation";
```

```tsx
import type {
  NetWorthPoint,
  AssetCategorySummary,
  AssetItem,
  AssetOverview,
  ExpenseBreakdown,
  CashFlowWaterfall
} from "../../../lib/data";
```

**Step 2: Add panel state**

Inside `DashboardClient`, add state for the selected category type (string | null):

```tsx
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
const router = useRouter();
```

**Step 3: Add click handler and derived data**

```tsx
const handleCardClick = (categoryType: string) => {
  setSelectedCategory((prev) => (prev === categoryType ? null : categoryType));
};

const selectedCategoryData = selectedCategory
  ? assetOverview.categories.find((c) => c.type === selectedCategory) ?? null
  : null;

const selectedAssets = selectedCategory
  ? assetOverview.assets.filter((a) => a.type === selectedCategory)
  : [];
```

**Step 4: Update Card rendering to be interactive**

Replace the existing Card mapping (lines 229-240) with:

```tsx
<div className="grid cards">
  {assetOverview.categories.map((category: any, index: number) => (
    <Card
      key={category.type}
      title={category.label}
      value={maskCurrencyValue(category.formattedValue, isVisible)}
      sub={category.subLabel}
      tone={category.tone as "glow" | "negative"}
      className={`card-${index}`}
      onClick={() => handleCardClick(category.type)}
      selected={selectedCategory === category.type}
    />
  ))}
</div>
```

**Step 5: Add DetailPanel at the end of the JSX (before closing `</>`):**

```tsx
<DetailPanel
  open={selectedCategory !== null}
  onClose={() => setSelectedCategory(null)}
  title={selectedCategoryData?.label ?? ""}
>
  {selectedCategoryData && (
    <>
      <div className="right-drawer-detail">
        <div className="card-value" style={{ fontSize: "22px" }}>
          {maskCurrencyValue(selectedCategoryData.formattedValue, isVisible)}
        </div>
      </div>

      {selectedAssets.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {selectedAssets.map((asset: AssetItem) => (
            <div
              key={asset.id}
              className="dash-asset-row"
              onClick={() => router.push("/assets")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push("/assets");
                }
              }}
            >
              <div className="dash-asset-row-name">{asset.name}</div>
              <div className="dash-asset-row-meta">
                <span>{asset.owner || "Joint"}</span>
                <span>{maskCurrencyValue(asset.formattedValue, isVisible)}</span>
              </div>
              <div className="dash-asset-row-meta">
                <span>{asset.lastUpdatedLabel}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No assets in this category yet.</div>
      )}

      <div className="right-drawer-actions">
        <button
          className="btn btn-ghost"
          onClick={() => router.push("/assets")}
          type="button"
        >
          View all in Assets →
        </button>
      </div>
    </>
  )}
</DetailPanel>
```

**Step 6: Verify build**

```bash
cd apps/web && npm run build
```

Expected: Build succeeds with no errors.

**Step 7: Commit**

```bash
git add apps/web/app/(shell)/dashboard/DashboardClient.tsx
git commit -m "feat: add asset snapshot detail panel to dashboard"
```

---

### Task 4: Manual smoke test and final verification

**Step 1: Run dev server and verify**

```bash
cd apps/web && npm run dev
```

Test checklist:
- Click a category card → panel opens with correct category title, total value, and asset list
- Click same card → panel closes (toggle)
- Click different card → panel switches to new category
- Click asset row → navigates to /assets
- Click "View all in Assets →" → navigates to /assets
- Press Escape → panel closes
- Verify mobile responsive (≤720px): panel slides over with backdrop
- Cards show selected border when panel is open

**Step 2: Run lint and type check**

```bash
cd apps/web && npx eslint app/\(shell\)/dashboard/DashboardClient.tsx && npx tsc --noEmit
```

**Step 3: Final commit if any lint fixes needed**

```bash
git add -A && git commit -m "fix: lint fixes for dashboard asset panel"
```
