# Workspace-Level Custom Categories

## Problem

Categories are currently hardcoded in three places (`lib/data.ts`, `lib/cash-logs-service.ts`, `app/api/categories/route.ts`) as identical 20-item arrays. Every workspace sees the same list. Different families have different spending patterns and need to customise their category set — adding, renaming, and removing categories.

Removing a category creates a data integrity issue: existing transactions reference the deleted category by name (`category_name` string field on the `transactions` collection). These orphaned references need to be handled.

---

## Current State

- **Storage**: The `categories` collection already exists in Appwrite with fields: `workspace_id`, `name`, `group`, `color`.
- **Retrieval**: `getCategories(workspaceId)` in `data.ts` already reads from the collection and falls back to `DEFAULT_CATEGORIES` when the collection is empty.
- **API**: `GET /api/categories` exists (read-only). No create/update/delete endpoints.
- **Transaction field**: `category_name` is a plain string — no foreign key or ID reference.
- **Special categories**: "Transfer" is always force-appended. "Uncategorised" triggers `needs_review = true`.
- **Duplicated constant**: `DEFAULT_CATEGORIES` is copy-pasted in 3 files.
- **Income detection**: `isIncomeCategory()` in `data.ts` and `cash-logs/commit/route.ts` hardcodes `name.includes("income")`. Drives dashboard spend/income split.
- **Navigation**: Settings page already exists at `/settings` with a nav item. Currently shows workspace members and system health.

So the foundation (collection + read path) is already in place. What's missing is the write path, the UI to manage categories, seed logic for new workspaces, the remapping flow for deletions, and group-based income detection.

---

## Design Decisions

### 1. Categories stay as name strings (no ID indirection)

Transactions store `category_name` as a plain string. Introducing an ID-based foreign key would require migrating every existing transaction, changing every filter/sort/display that uses the name, and complicating the AI categorization prompts (which output names). The cost far outweighs the benefit.

### 2. Rename is a first-class operation

Unlike the previous plan which treated rename as "delete + create + remap", rename is now a dedicated `PATCH` operation. The API updates the category document's name AND bulk-updates all transactions referencing the old name. This is a single user action instead of three.

### 3. "Transfer" and "Uncategorised" are system categories

These two categories cannot be renamed, deleted, or hidden. They have special behaviour hardcoded in the app:
- "Transfer" — set automatically by transfer detection, disables category dropdown
- "Uncategorised" — triggers `needs_review = true`, feeds the review queue

They'll be guarded in the API (reject rename/delete requests for these names).

### 4. Default categories are seeded per-workspace

When a workspace has zero rows in the `categories` collection, the current code falls back to `DEFAULT_CATEGORIES`. Instead, we'll **seed the defaults into the collection** on workspace creation. This means:
- Every workspace has explicit rows from day one
- Users see exactly what they can edit/delete
- No implicit fallback confusion

### 5. Category deletion requires explicit remapping

When a user deletes a category that has existing transactions, they must choose a replacement category. The API performs a bulk update (`category_name = old → new`) before deleting the category row.

### 6. The `group` field drives income/expense classification

The existing `group` field on the categories collection becomes meaningful. Valid values: `"income"`, `"expense"`, or `null` (for system categories like Transfer). `isIncomeCategory()` is updated to check group instead of pattern-matching the name. This means a family can name their income category "Salary" or anything else — what matters is the group.

Default categories are seeded with appropriate groups:
- `"income"`: "Income - Primary", "Income - Secondary"
- `"expense"`: all others except Transfer and Uncategorised
- `null`: "Transfer", "Uncategorised"

### 7. Lazy seed for existing workspaces (race-safe)

Existing workspaces with an empty categories collection get seeded on first categories API call. To avoid race conditions (two concurrent requests both seeding), the seed function checks the count inside a try/catch — if a duplicate is created, the next read deduplicates. Alternatively, the seed is only triggered from the `GET /api/categories` endpoint (single entry point), and the function checks count before inserting.

---

## Implementation Plan

### Step 1: Consolidate `DEFAULT_CATEGORIES` into a single source

**Files changed**: `lib/categories.ts` (new), `lib/data.ts`, `lib/cash-logs-service.ts`, `app/api/categories/route.ts`, `app/api/imports/route.ts`

- Create `lib/categories.ts` exporting:
  ```typescript
  export const DEFAULT_CATEGORIES = [
    { name: "Income - Primary", group: "income" },
    { name: "Income - Secondary", group: "income" },
    { name: "Housing", group: "expense" },
    { name: "Transportation", group: "expense" },
    { name: "Groceries", group: "expense" },
    { name: "Food", group: "expense" },
    { name: "Utilities", group: "expense" },
    { name: "Medical, Healthcare & Fitness", group: "expense" },
    { name: "Savings, Investing, & Debt Payments", group: "expense" },
    { name: "Personal Spending", group: "expense" },
    { name: "Recreation & Entertainment", group: "expense" },
    { name: "Travel & Holidays", group: "expense" },
    { name: "Miscellaneous", group: "expense" },
    { name: "Work Expenses - Primary", group: "expense" },
    { name: "Work Expenses - Secondary", group: "expense" },
    { name: "Finance", group: "expense" },
    { name: "Parents Expenses", group: "expense" },
    { name: "Mortgage Repayments", group: "expense" },
    { name: "Transfer", group: null },
    { name: "Uncategorised", group: null },
  ] as const;

  export const DEFAULT_CATEGORY_NAMES = DEFAULT_CATEGORIES.map(c => c.name);

  export const SYSTEM_CATEGORIES = ["Transfer", "Uncategorised"] as const;

  export type CategoryGroup = "income" | "expense" | null;
  ```
- Replace all 3 inline `DEFAULT_CATEGORIES` string arrays with imports of `DEFAULT_CATEGORY_NAMES` from this file.

### Step 2: Seed categories on workspace creation + lazy seed

**Files changed**: Workspace creation code, `lib/data.ts`, `app/api/categories/route.ts`

**On workspace creation:**
- After creating a workspace document, bulk-insert `DEFAULT_CATEGORIES` into the `categories` collection with `workspace_id`.
- Each row: `{ workspace_id, name, group, color: null }`

**Lazy seed for existing workspaces:**
- In `GET /api/categories`: if query returns 0 documents for this workspace, call `seedDefaultCategories(workspaceId)`.
- `seedDefaultCategories` re-checks the count before inserting (guard against race conditions).
- Keep the `DEFAULT_CATEGORY_NAMES` fallback in `getCategories()` as a last-resort safety net, but log a warning if it's hit (means seed failed).

### Step 3: Update `getCategories()` to return structured data

**Files changed**: `lib/data.ts`

Currently `getCategories()` returns `string[]`. Add a new function:

```typescript
export type WorkspaceCategory = {
  id: string;
  name: string;
  group: CategoryGroup;
  color: string | null;
  is_system: boolean;
};

export async function getCategoriesWithMeta(workspaceId: string): Promise<WorkspaceCategory[]> {
  // Reads from categories collection, returns full objects
  // is_system is computed: true if name is "Transfer" or "Uncategorised"
}
```

Keep the existing `getCategories()` returning `string[]` for backward compat — all existing UI code (filters, dropdowns, AI prompts) uses string arrays and doesn't need to change.

### Step 4: Update income detection to use `group` field

**Files changed**: `lib/data.ts`, `app/api/cash-logs/commit/route.ts`

**Current** (hardcoded pattern match):
```typescript
export function isIncomeCategory(category: string) {
  const normalized = category.trim().toLowerCase();
  return normalized === "income" || normalized.startsWith("income -");
}
```

**New approach**: `isIncomeCategory` needs access to the workspace's category metadata. Two options:

**Option A — Lookup-based** (preferred): Change callers to pass the categories list:
```typescript
export function isIncomeCategory(
  categoryName: string,
  categories: WorkspaceCategory[]
): boolean {
  const cat = categories.find(
    c => c.name.toLowerCase() === categoryName.trim().toLowerCase()
  );
  return cat?.group === "income";
}
```

This affects `getSpendByCategory()`, `getWaterfallData()`, `getReportExpenseData()`, and `cash-logs/commit/route.ts`. Each already has access to `workspaceId` and can call `getCategoriesWithMeta()`.

**Fallback**: If the category name isn't found in the workspace list (e.g., old snapshot data), fall back to the current pattern match (`name.includes("income")`) so existing behaviour doesn't break for edge cases.

**Tests**: Update `data-transforms.test.ts` — the `isIncomeCategory` tests need to pass a categories array.

### Step 5: Categories CRUD API

**Files changed**: `app/api/categories/route.ts` (extend), `app/api/categories/[id]/route.ts` (new)

#### `GET /api/categories` — List categories (extend existing)

- Add transaction counts per category (batch query).
- Return: `{ categories: [{ id, name, group, color, is_system, transaction_count }] }`
- Transaction count: single query `SELECT category_name, COUNT(*)` — Appwrite doesn't support GROUP BY, so query all distinct category names from the workspace's categories, then for each, run `Query.equal("category_name", name) + Query.limit(0)` and read `total` from the response. This is N queries for N categories, but N is small (<30) and the queries are lightweight (count only, no documents returned).
- `is_system` is computed (true if name is "Transfer" or "Uncategorised"), not stored.

#### `POST /api/categories` — Add a category

- Permission: `admin`
- Body: `{ name: string; group?: "income" | "expense"; color?: string }`
- Validation:
  - Name is non-empty, trimmed, max 100 chars
  - Name doesn't duplicate an existing category in this workspace (case-insensitive)
  - Name is not a system category name
  - Group defaults to `"expense"` if not provided
- Creates a document in the `categories` collection.
- Returns `{ category: { id, name, group, color } }`

#### `PATCH /api/categories/[id]` — Rename / update a category

- Permission: `admin`
- Body: `{ name?: string; group?: "income" | "expense"; color?: string }`
- **Rename logic** (when `name` is provided and different from current):
  1. Validate new name (non-empty, no duplicate, not a system category name).
  2. Cannot rename system categories ("Transfer", "Uncategorised").
  3. Batch-update all transactions where `category_name === old_name` to `category_name = new_name` (paginate with `Query.cursorAfter()` in batches of 100).
  4. Update the category document.
  5. Return `{ ok: true, renamed_count: N }`.
- **Group/color update** (no rename): just update the document. No transaction changes needed.
- Cannot change a system category's group (Transfer and Uncategorised must stay `null`).

#### `DELETE /api/categories/[id]` — Remove a category

- Permission: `admin`
- Body: `{ remap_to: string }` — the category name to reassign orphaned transactions to.
  - `remap_to` must be an existing category in this workspace.
  - Cannot delete system categories ("Transfer", "Uncategorised").
  - Cannot remap to the category being deleted.
- Process:
  1. Look up the category being deleted to get its `name`.
  2. Batch-update all matching transactions: set `category_name = remap_to`. (Paginate with `Query.cursorAfter()` in batches of 100.)
  3. If `remap_to === "Uncategorised"`, also set `needs_review = true` on those transactions.
  4. Delete the category document.
  5. Return `{ ok: true, remapped_count: N }`.

### Step 6: Category Management UI

**Files changed**: `app/(shell)/settings/page.tsx` (add categories section), `app/(shell)/settings/CategoriesSection.tsx` (new client component)

Put category management **on the existing Settings page** as a new section (like MembersSection), not a separate sub-page. This is consistent with the current settings pattern and means no new nav items or routing needed.

#### UI Layout

- **Section header**: "Categories" with an "Add Category" button (visible to admin/owner only).
- **List**: All categories as rows inside a Card. Each row shows:
  - Category name
  - Group badge: "Income" or "Expense" (small pill/tag)
  - Transaction count (e.g., "47 transactions")
  - Rename button — opens inline edit
  - Delete button — disabled for system categories, disabled when the category is the only non-system one
  - System categories shown with a lock icon, no edit/delete controls
- **Add flow**: Clicking "Add Category" shows an inline form at the top of the list. Fields: name (required), group (income/expense toggle, defaults to expense).
- **Rename flow**: Clicking rename makes the name field editable inline. On save, calls `PATCH /api/categories/[id]` with the new name. Shows result: "Renamed. 47 transactions updated."
- **Group change flow**: Clicking the group badge toggles between income/expense (for non-system categories). Calls `PATCH`.
- **Delete flow**:
  1. User clicks delete on a category.
  2. If 0 transactions use it → simple confirm dialog → delete.
  3. If >0 transactions → show a remap dialog:
     - "X transactions are categorised as [deleted category]. Choose a replacement category:"
     - Dropdown of remaining categories (excluding the one being deleted).
     - "Remap & Delete" button.
     - On confirm, calls `DELETE /api/categories/[id]` with `{ remap_to }`.
  4. Show a success toast: "Category deleted. X transactions remapped to [new category]."

#### Permissions

- Viewers/editors see the category list (read-only, no add/edit/delete buttons).
- Admins and owners see full CRUD controls.

### Step 7: Update AI categorization

**Files changed**: `app/api/cash-logs/process/route.ts`

- `guessCategory()` fallback: accept a categories list parameter, only return categories that exist in the workspace's list, fall back to "Uncategorised" if a keyword match doesn't map to a valid workspace category.
- Import routes (`app/api/imports/route.ts`) already use `getCategories(workspaceId)` for AI prompts — no change needed beyond the constant consolidation from Step 1.

### Step 8: Verify filter UIs

**Files changed**: Minimal — verification pass

These components already receive categories from server-side data fetching (`getCategories()`). Once the data layer returns workspace-specific categories, the dropdowns automatically show the right list. Verify:
- `LedgerFilters.tsx` — category filter dropdown
- `TransactionDetail.tsx` — category edit dropdown
- `ReviewClient.tsx` — category assignment dropdown
- `SpendByCategoryControls.tsx` — category checkboxes on dashboard
- `ExpenseCategoryList.tsx` — expense report breakdown

Check that none of these hardcode category names (beyond "Transfer" / "Uncategorised" which are system categories and will always exist).

### Step 9: Tests

**Files changed**: `lib/__tests__/categories.test.ts` (new), `lib/__tests__/data-transforms.test.ts` (update)

- **New tests** (`categories.test.ts`):
  - `DEFAULT_CATEGORIES` includes all system categories
  - `SYSTEM_CATEGORIES` can't overlap with user-creatable names
  - Seed function creates correct number of rows
  - Category name validation (empty, too long, duplicate, system name)
- **Updated tests** (`data-transforms.test.ts`):
  - `isIncomeCategory` tests updated to pass categories array
  - New test: custom income category (e.g., "Salary" with group "income") returns true
  - New test: category named "Income" but with group "expense" returns false (group wins)
  - Fallback test: unknown category name falls back to pattern match

---

## Handling Edge Cases

### Transactions imported before category customization
If a workspace was used before this feature and transactions have categories from `DEFAULT_CATEGORIES`, those categories will already be seeded into the collection (Step 2). No migration issue.

### Workspace with empty categories collection (existing workspaces)
Lazy seed on first `GET /api/categories` call. The seed function checks count before inserting. If a race condition creates duplicates, the GET response deduplicates by name (first-write-wins).

### Category name conflicts
Enforce case-insensitive uniqueness. "groceries" and "Groceries" are the same category. The API normalizes by comparing lowercased names but preserves the user's original casing.

### Bulk remap performance
Appwrite has no bulk update. The delete/rename endpoints loop through transactions in batches of 100, updating each. For a workspace with thousands of transactions in one category, this could take several seconds. Mitigations:
- Return `remapped_count` / `renamed_count` so the UI can show feedback.
- Start synchronous — most workspaces won't have thousands of transactions in a single category.
- If we find this is too slow (>30s), we can make it async with a status polling endpoint later.

### Monthly snapshots
`monthly_snapshots` stores `category_totals` as a JSON blob with category names as keys. Old snapshots will reference deleted/renamed category names. This is acceptable — snapshots are point-in-time records. They should reflect what the categories were at that time. No remap needed on snapshots.

### `isIncomeCategory` fallback for unknown names
If a category name appears in a transaction but isn't found in the workspace's categories list (e.g., legacy data, or snapshot aggregation), fall back to the current pattern match (`name.includes("income")`). This preserves backward compatibility.

---

## Migration Plan for Existing Workspaces

1. **No breaking changes**: The `DEFAULT_CATEGORY_NAMES` fallback remains in `getCategories()` as a safety net.
2. **Lazy seeding**: On first `GET /api/categories` call for a workspace with an empty collection, seed defaults with correct groups.
3. **No schema changes**: The `categories` collection already has `workspace_id`, `name`, `group`, `color` fields.
4. **No transaction migration**: `category_name` strings are unchanged. Only future renames/deletions trigger bulk updates.
5. **Income detection**: After seeding, `isIncomeCategory()` uses group from the categories collection. For workspaces that haven't been seeded yet, the fallback pattern match preserves current behaviour.

---

## Files Summary

| File | Change |
|------|--------|
| `lib/categories.ts` | **New** — single source for `DEFAULT_CATEGORIES` (with groups), `SYSTEM_CATEGORIES`, types |
| `lib/data.ts` | Import from `lib/categories.ts`, remove inline array, add `getCategoriesWithMeta()`, update `isIncomeCategory()` to use group field |
| `lib/cash-logs-service.ts` | Import from `lib/categories.ts`, remove inline array |
| `app/api/categories/route.ts` | Import from `lib/categories.ts`, add `POST`, return full objects with transaction counts, add lazy seed |
| `app/api/categories/[id]/route.ts` | **New** — `PATCH` (rename + group/color update) and `DELETE` (with remap) |
| `app/api/imports/route.ts` | Import from `lib/categories.ts`, remove inline array |
| `app/api/cash-logs/process/route.ts` | Update `guessCategory()` to accept category list parameter |
| `app/api/cash-logs/commit/route.ts` | Update local `isIncomeCategory()` to use group-based check |
| Workspace creation code | Add category seeding after workspace creation |
| `app/(shell)/settings/page.tsx` | Add CategoriesSection |
| `app/(shell)/settings/CategoriesSection.tsx` | **New** — client component with full CRUD UI |
| `lib/__tests__/categories.test.ts` | **New** — tests for defaults, validation, seed logic |
| `lib/__tests__/data-transforms.test.ts` | Update `isIncomeCategory` tests for new signature |

---

## Implementation Order

1. `lib/categories.ts` + consolidate imports (zero risk, pure refactor)
2. `getCategoriesWithMeta()` + update `isIncomeCategory()` to use group field (with fallback)
3. Update tests for new `isIncomeCategory` signature
4. Categories CRUD API (`POST`, `PATCH` with rename, `DELETE` with remap)
5. Lazy seed logic for existing workspaces + seed on workspace creation
6. Category management UI (CategoriesSection on Settings page)
7. Update `guessCategory()` fallback in cash logs
8. Verify filter UIs work with custom categories
9. Full test pass
