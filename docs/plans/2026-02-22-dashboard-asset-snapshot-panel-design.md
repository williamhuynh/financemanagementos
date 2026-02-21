# Dashboard Asset Snapshot Detail Panel

**Date:** 2026-02-22
**Status:** Approved

## Summary

When a user clicks an asset snapshot card on the dashboard (e.g. "Property", "Cash"), a DetailPanel opens from the right listing the individual assets that comprise that category total.

## Design Decisions

- **Approach A (dashboard-local)**: Panel content is a simple read-only list rendered directly in `DashboardClient.tsx`. No new shared components or API endpoints — `assetOverview.assets` already contains all needed data.
- **Panel content per asset**: Name, latest value, owner, last updated.
- **Row click**: Navigates to the `/assets` page.
- **Panel header**: Category label as title, total value as hero amount at top of body.

## Data Flow

`DashboardClient` receives `assetOverview` (with `categories` and `assets`). On card click, filter `assets` by `asset.type === category.type`. No new API calls.

## Panel Layout

```
┌─────────────────────────┐
│  ✕  Property            │  ← DetailPanel title
├─────────────────────────┤
│  $500,000.00            │  ← Hero total value
│                         │
│  ┌─────────────────────┐│
│  │ Primary Residence   ││  ← Clickable asset row
│  │ Joint · $450,000    ││
│  │ Updated 2 weeks ago ││
│  └─────────────────────┘│
│  ┌─────────────────────┐│
│  │ Investment Property  ││
│  │ Partner · $50,000   ││
│  │ Updated 1 month ago ││
│  └─────────────────────┘│
│                         │
│  View all in Assets →   │  ← Link to /assets page
└─────────────────────────┘
```

## Interaction

- Click card → open panel (or close if same card clicked again)
- Card gets `selected` visual state when its panel is open
- Escape / close button closes panel (DetailPanel handles this)
- Asset row click → navigate to `/assets`

## Files Changed

1. **`packages/ui/src/components/Card.tsx`** — Add optional `onClick`, `selected`, `role`/`tabIndex` props
2. **`apps/web/app/(shell)/dashboard/DashboardClient.tsx`** — Add panel state, card click handlers, render `<DetailPanel>` with filtered asset list
3. **`apps/web/app/globals.css`** — Minimal styles for dashboard asset list rows (reuse `right-drawer-*` classes)
