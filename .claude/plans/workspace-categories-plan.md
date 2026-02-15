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

So the foundation (collection + read path) is already in place. What's missing is the write path, the UI to manage categories, seed logic for new workspaces, and the remapping flow for deletions.

---

## Design Decisions

### 1. Categories stay as name strings (no ID indirection)

Transactions store `category_name` as a plain string. Introducing an ID-based foreign key would require migrating every existing transaction, changing every filter/sort/display that uses the name, and complicating the AI categorization prompts (which output names). The cost far outweighs the benefit.

**Consequence**: Renaming a category IS a "delete old + create new + remap" operation. This is fine — renaming is rare and the remap flow handles it.

### 2. "Transfer" and "Uncategorised" are system categories

These two categories cannot be renamed, deleted, or hidden. They have special behaviour hardcoded in the app:
- "Transfer" — set automatically by transfer detection, disables category dropdown
- "Uncategorised" — triggers `needs_review = true`, feeds the review queue

They'll be flagged as `is_system: true` in the categories collection (or simply guarded in the API).

### 3. Default categories are seeded per-workspace

When a workspace has zero rows in the `categories` collection, the current code falls back to `DEFAULT_CATEGORIES`. Instead, we'll **seed the defaults into the collection** on workspace creation. This means:
- Every workspace has explicit rows from day one
- Users see exactly what they can edit/delete
- No implicit fallback confusion

### 4. Category deletion requires explicit remapping

When a user deletes a category that has existing transactions, they must choose a replacement category. The API performs a bulk update (`category_name = old → new`) before deleting the category row. This is a single atomic-ish operation (Appwrite doesn't have transactions, so we update in batches then delete the category).

---

## Implementation Plan

### Step 1: Consolidate `DEFAULT_CATEGORIES` into a single source

**Files changed**: `lib/categories.ts` (new), `lib/data.ts`, `lib/cash-logs-service.ts`, `app/api/categories/route.ts`, `app/api/imports/route.ts`

- Create `lib/categories.ts` exporting:
  ```typescript
  export const DEFAULT_CATEGORIES: string[] = [ ... ];
  export const SYSTEM_CATEGORIES = ["Transfer", "Uncategorised"] as const;
  ```
- Replace all 3 inline copies with imports from this file.

### Step 2: Seed categories on workspace creation

**Files changed**: `app/api/workspaces/route.ts` (or wherever workspace creation happens), `lib/data.ts`

- After creating a workspace document, bulk-insert `DEFAULT_CATEGORIES` into the `categories` collection with `workspace_id`.
- Each row: `{ workspace_id, name, group: null, color: null }`
- Remove the `names.length ? names : DEFAULT_CATEGORIES` fallback in `getCategories()` — the collection will always have rows. Keep the fallback only as a safety net (log a warning if hit).

### Step 3: Categories CRUD API

**Files changed**: `app/api/categories/route.ts` (extend), `app/api/categories/[id]/route.ts` (new)

#### `POST /api/categories` — Add a category
- Permission: `admin`
- Body: `{ name: string; group?: string; color?: string }`
- Validation:
  - Name is non-empty, trimmed, max 100 chars
  - Name doesn't duplicate an existing category in this workspace (case-insensitive)
  - Name is not a system category name
- Creates a document in the `categories` collection.
- Returns `{ category: { id, name, group, color } }`

#### `PATCH /api/categories/[id]` — Update a category (group/color only)
- Permission: `admin`
- Body: `{ group?: string; color?: string }`
- Cannot change `name` — renaming is delete + create + remap (see design decision #1). Simpler to enforce this than to handle partial remap states.
- Cannot modify system categories' core properties.

#### `DELETE /api/categories/[id]` — Remove a category
- Permission: `admin`
- Body: `{ remap_to: string }` — the category to reassign orphaned transactions to.
  - `remap_to` must be an existing category in this workspace.
  - Cannot delete system categories ("Transfer", "Uncategorised").
  - Cannot delete the `remap_to` target in the same request.
- Process:
  1. Look up the category being deleted to get its `name`.
  2. Count transactions with `category_name === deleted_name` in this workspace.
  3. Batch-update all matching transactions: set `category_name = remap_to`. (Paginate with `Query.cursorAfter()` in batches of 100 to stay under Appwrite limits.)
  4. If `remap_to === "Uncategorised"`, also set `needs_review = true` on those transactions.
  5. Delete the category document.
  6. Return `{ ok: true, remapped_count: N }`.

#### `GET /api/categories` — List categories (already exists, minor changes)
- Add `id` to the response so the UI can reference categories for edit/delete.
- Return: `{ categories: [{ id, name, group, color, is_system }] }`
- `is_system` is computed (true if name is "Transfer" or "Uncategorised"), not stored.

### Step 4: Category Management UI

**Files changed**: New page `app/(shell)/settings/categories/page.tsx` + `CategoriesClient.tsx`

A settings sub-page (linked from a future settings area, or a dedicated nav item) where admins can manage workspace categories.

#### UI Layout
- **Header**: "Manage Categories" with an "Add Category" button.
- **List**: All categories shown as rows/cards. Each row shows:
  - Category name
  - Group (if set)
  - Color swatch (if set)
  - Transaction count badge (how many transactions use this category)
  - Edit button (group/color only) — opens inline edit or a small modal
  - Delete button — disabled for system categories
- **Add flow**: Clicking "Add Category" opens an inline form or modal. Fields: name (required), group (optional), color (optional picker).
- **Delete flow**:
  1. User clicks delete on a category.
  2. If 0 transactions use it → confirm and delete immediately (no remap needed, but API still requires `remap_to` — default to "Uncategorised").
  3. If >0 transactions → show a dialog:
     - "X transactions are categorised as [deleted category]. Choose a replacement category:"
     - Dropdown of remaining categories (excluding the one being deleted).
     - "Remap & Delete" button.
     - On confirm, calls `DELETE /api/categories/[id]` with `{ remap_to }`.
  4. Show a success toast: "Category deleted. X transactions remapped to [new category]."

#### Permissions
- Viewers/editors see the category list (read-only, no add/edit/delete buttons).
- Admins and owners see full CRUD controls.

### Step 5: Update AI categorization to use workspace categories

**Files changed**: `app/api/imports/route.ts`, `app/api/cash-logs/process/route.ts`

These already call `getCategories(workspaceId)` or `fetchCategories(workspaceId)` to get the category list and pass it to the AI prompt. Once `getCategories` reads from the seeded collection, the AI will automatically use the workspace's custom categories. **No changes needed** — just verify the flow works end-to-end after seeding is in place.

The `guessCategory()` fallback in `cash-logs/process/route.ts` has hardcoded keyword→category mappings. Update it to:
- Accept a categories list parameter.
- Only return categories that exist in the workspace's list.
- Fall back to "Uncategorised" if a keyword match doesn't map to a valid workspace category.

### Step 6: Update category filter UIs

**Files changed**: `app/(shell)/ledger/LedgerFilters.tsx`, `app/(shell)/ledger/TransactionDetail.tsx`, `app/(shell)/review/ReviewClient.tsx`, `app/(shell)/dashboard/SpendByCategoryControls.tsx`

These components already receive categories from server-side data fetching. Once the data layer returns workspace-specific categories, the dropdowns automatically show the right list. **Minimal changes needed** — verify that:
- Filter dropdowns don't hardcode any category names.
- The "all categories" / unfiltered state still works.
- Category display in reports/exports reflects workspace categories.

---

## Handling Edge Cases

### Transactions imported before category customization
If a workspace was used before this feature and transactions have categories from `DEFAULT_CATEGORIES`, those categories will already be seeded into the collection (Step 2). No migration issue.

### Workspace with empty categories collection (existing workspaces)
For existing workspaces that have zero rows in `categories`, the `getCategories()` fallback still returns `DEFAULT_CATEGORIES`. Add a one-time migration: when any categories API endpoint is hit and the collection is empty for that workspace, auto-seed the defaults. This is a lazy migration — no batch script needed.

### Category name conflicts
Enforce case-insensitive uniqueness. "groceries" and "Groceries" are the same category. The API normalizes to the casing provided by the user on creation.

### Bulk remap performance
Appwrite has no bulk update. The delete endpoint loops through transactions in batches of 100, updating each. For a workspace with thousands of transactions in one category, this could be slow. Mitigations:
- Show a progress indicator in the UI ("Remapping X transactions...").
- The API returns after all updates complete (synchronous). If we find this is too slow (>30s), we can make it async with a status polling endpoint later. Start synchronous — most workspaces won't have thousands of transactions in a single category.

### Monthly snapshots
`monthly_snapshots` stores `category_totals` as a JSON blob with category names as keys. Old snapshots will reference deleted category names. This is acceptable — snapshots are point-in-time records. They should reflect what the categories were at that time. No remap needed on snapshots.

---

## Migration Plan for Existing Workspaces

1. **No breaking changes**: The `DEFAULT_CATEGORIES` fallback remains in `getCategories()` as a safety net.
2. **Lazy seeding**: On first categories API call for a workspace with an empty collection, seed defaults automatically.
3. **No schema changes**: The `categories` collection already has the needed fields.
4. **No transaction migration**: `category_name` strings are unchanged. Only future deletions trigger remapping.

---

## Files Summary

| File | Change |
|------|--------|
| `lib/categories.ts` | **New** — single source for `DEFAULT_CATEGORIES` and `SYSTEM_CATEGORIES` |
| `lib/data.ts` | Import from `lib/categories.ts`, remove inline array |
| `lib/cash-logs-service.ts` | Import from `lib/categories.ts`, remove inline array |
| `app/api/categories/route.ts` | Import from `lib/categories.ts`, add `POST`, return IDs, add lazy seed |
| `app/api/categories/[id]/route.ts` | **New** — `PATCH` and `DELETE` with remap logic |
| `app/api/imports/route.ts` | Import from `lib/categories.ts`, remove inline array |
| `app/api/cash-logs/process/route.ts` | Update `guessCategory()` to accept category list parameter |
| Workspace creation code | Add category seeding after workspace creation |
| `app/(shell)/settings/categories/page.tsx` | **New** — settings page for category management |
| `app/(shell)/settings/categories/CategoriesClient.tsx` | **New** — client component with CRUD UI |
| Tests | Add tests for category CRUD validation, remap logic |

---

## Implementation Order

1. `lib/categories.ts` + consolidate imports (zero risk, pure refactor)
2. Categories CRUD API (POST, PATCH, DELETE)
3. Lazy seed logic for existing workspaces
4. Seed on workspace creation
5. Category management UI page
6. Update `guessCategory()` fallback
7. Verify filter UIs work with custom categories
8. Tests
