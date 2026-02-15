# Plan: Fix Hardcoded Currency & Locale

## Problem
The app hardcodes `"AUD"` and `"en-AU"` throughout. The workspace already stores a `currency` field, but it's not plumbed to formatting functions, fallback defaults, or AI prompts. Changing the workspace currency from AUD would produce wrong formatting or stale AUD references.

## Scope
- Supported currencies: **AUD, NZD, USD, GBP, EUR** only (user request to limit scope)
- No new DB schema changes (workspace already has `currency` field)
- No FX conversion changes (asset `value_aud` / `fetchAudRate` stays — rename deferred)
- Date formatting locale stays `en-AU` for now (DD/MM/YYYY is a display convention, not currency-dependent — ISO stored in DB)

## Design Decisions

### Currency → Locale mapping
`Intl.NumberFormat` needs a locale to know how to format (e.g., `$1,234.56` vs `1.234,56 €`). We'll add a mapping:

```typescript
const CURRENCY_CONFIG: Record<SupportedCurrency, { name: string; symbol: string; locale: string }> = {
  AUD: { name: "Australian Dollar",   symbol: "$",  locale: "en-AU" },
  NZD: { name: "New Zealand Dollar",  symbol: "$",  locale: "en-NZ" },
  USD: { name: "US Dollar",           symbol: "$",  locale: "en-US" },
  GBP: { name: "British Pound",       symbol: "£",  locale: "en-GB" },
  EUR: { name: "Euro",                symbol: "€",  locale: "de-DE" },
};
```

### "Home currency" concept
The workspace currency is the **home currency** — net worth rollups, dashboard totals, and category spend summaries are all denominated in this currency. Individual transactions/assets can still have their own currency. The existing `value_aud` field on asset valuations continues to serve as the "converted to home currency" value; renaming it to `value_home` is a future migration (out of scope).

### TypeScript as safety net for Step 3
**Key improvement:** Make the `currency` parameter **required** (remove the `= "AUD"` defaults) on core formatting functions: `formatAmount`, `formatCurrencyValue`, `formatSignedCurrency`, `buildSpendByCategory`. This way `tsc --noEmit` will flag every single call site that doesn't pass a currency, turning a manual audit of ~40 call sites into a compiler-checked refactor. Much safer than grepping.

### Export pure build functions for testing
The internal `build*` functions (`buildExpenseBreakdown`, `buildCashFlowWaterfall`, `buildNetWorthSeries`, `buildSpendByCategory`) are pure computation — no DB access — but currently unexported. We'll export them so we can write downstream tests that verify the complete formatted output pipeline with non-AUD currencies. These are the highest-value tests because they exercise the full chain: raw transactions → formatting → final UI-ready output.

### Whisper prompt
The transcribe route will look up workspace currency and reference it dynamically instead of hardcoding "Australian dollars".

---

## Step-by-step changes

### Step 1: Create shared currency constants (`lib/currencies.ts`)
**New file.** Single source of truth for supported currencies, the locale mapping, and currency metadata.

```typescript
export const SUPPORTED_CURRENCIES = ["AUD", "NZD", "USD", "GBP", "EUR"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_CONFIG: Record<SupportedCurrency, { name: string; symbol: string; locale: string }> = {
  AUD: { name: "Australian Dollar",   symbol: "$",  locale: "en-AU" },
  NZD: { name: "New Zealand Dollar",  symbol: "$",  locale: "en-NZ" },
  USD: { name: "US Dollar",           symbol: "$",  locale: "en-US" },
  GBP: { name: "British Pound",       symbol: "£",  locale: "en-GB" },
  EUR: { name: "Euro",                symbol: "€",  locale: "de-DE" },
};

export function getLocaleForCurrency(currency: string): string {
  const config = CURRENCY_CONFIG[currency as SupportedCurrency];
  return config?.locale ?? "en-AU";
}

export function getCurrencyName(currency: string): string {
  const config = CURRENCY_CONFIG[currency as SupportedCurrency];
  return config?.name ?? currency;
}

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency);
}
```

**Risk:** Low — new file, no existing code changes.

### Step 2: Update formatting functions in `lib/data.ts`
Two changes per function:
1. Replace hardcoded `"en-AU"` locale with `getLocaleForCurrency(currency)`
2. **Remove the default parameter** — make currency required

**Functions to change:**
- `formatAmount(value: string, currency: string)` — line 609: remove `= "AUD"`, use dynamic locale
- `formatCurrencyValue(amount: number, currency: string)` — line 620: same
- `formatSignedCurrency(amount: number, currency: string)` — line 627: remove `= "AUD"` (delegates to `formatCurrencyValue`)
- `buildSpendByCategory(items, currency: string)` — line 960: remove `= "AUD"`
- `formatAssetValue`, `formatNetWorth` — already require currency, benefit from upstream locale fix

After this step, `tsc --noEmit` will produce compile errors at every call site that relied on the default `"AUD"`. This is intentional — Step 3 fixes them all.

**Risk:** Medium — this is the core formatting change. Deliberately breaks the build until Step 3 is complete.

### Step 3: Fix all call sites (compiler-guided)
Run `tsc --noEmit` and fix every error. Each call site falls into one of two categories:

**Category A — Transaction-level formatting (use the transaction's own currency):**
These already have `txn.currency` available. Just pass it through. Fallback to workspace home currency (not hardcoded "AUD").
- Line 1080: `formatSignedCurrency(signedAmount, txn.currency || "AUD")` → `txn.currency || homeCurrency`
- Line 1216: same pattern

**Category B — Summary/rollup formatting (use workspace home currency):**
These aggregate across transactions and need the workspace's home currency.

In `buildExpenseBreakdown` (lines 1041-1129):
- Line 1102: `formatSignedCurrency(signedAmount, "AUD")` → `homeCurrency`
- Line 1116: `formatSignedCurrency(category.amount, "AUD")` → `homeCurrency`
- Line 1127: `formatCurrencyValue(totalSpendAbs, "AUD")` → `homeCurrency`
- Add `homeCurrency: string` parameter to function signature

In `buildCashFlowWaterfall` (lines 1175-1291):
- Line 1245: `formatSignedCurrency(amount, "AUD")` → `homeCurrency`
- Line 1278: `formatSignedCurrency(incomeTotal, "AUD")` → `homeCurrency`
- Line 1286: `formatSignedCurrency(netTotal, "AUD")` → `homeCurrency`
- Add `homeCurrency: string` parameter

In asset functions:
- `buildNetWorthSeries` — line 2347: `DEFAULT_ASSET_CURRENCY` → `homeCurrency` parameter
- `buildAssetSeries` — similarly
- Asset item formatting (lines 2487-2493): `DEFAULT_ASSET_CURRENCY` → `homeCurrency`
- Category summaries (line 2541): `DEFAULT_ASSET_CURRENCY` → `homeCurrency`
- Net worth formatted (line 2599): `DEFAULT_ASSET_CURRENCY` → `homeCurrency`

In monthly close summaries (lines 2822-2955):
- All `formatCurrencyValue(x, "AUD")` and `formatNetWorth(x, "AUD")` → workspace currency
- `getMonthlyCloseSummary` needs `homeCurrency` parameter or workspace lookup

**Callers of updated exported functions** — the `get*` functions that call `build*` functions:
- `getExpenseBreakdown(workspaceId)` → `getExpenseBreakdown(workspaceId, homeCurrency, selectedMonth)` — caller passes workspace currency
- `getCashFlowWaterfall(workspaceId)` → same pattern
- `getAssetOverview(workspaceId)` → `getAssetOverview(workspaceId, homeCurrency)`
- `getStatCards(workspaceId)` — fetch workspace to get currency, pass to `getAssetOverview`
- `getMonthlyCloseSummary(workspaceId)` → add `homeCurrency` or do workspace lookup inside

**Server component callers** in `app/(shell)/` already have workspace context or can look it up. Thread the currency from workspace to each data function call.

**Risk:** Medium-high in terms of line count, but **low in terms of missed sites** because the compiler catches every one. The real risk is introducing a bug in the plumbing (e.g., passing the wrong variable). The downstream tests from Step 2.5 guard against this.

### Step 4: Fix API route hardcoded defaults

#### `app/api/cash-logs/commit/route.ts` (line 87)
- Change `currency: "AUD"` → look up workspace currency: `workspace.currency`
- Already has `workspaceId` from `getApiContext()`, use `getWorkspaceById(workspaceId)`

#### `app/api/imports/route.ts` (line 316)
- Change `row.currency ?? "AUD"` → `row.currency ?? workspaceCurrency`
- Already has `workspaceId`, add workspace lookup

#### `app/api/assets/route.ts` (line 38)
- Change `body.currency?.trim() || "AUD"` → `body.currency?.trim() || workspaceCurrency`
- Already has `workspaceId`, add workspace lookup

#### `app/api/transcribe/route.ts` (line 51)
- Replace `"Amounts are in Australian dollars"` → `"Amounts are in ${getCurrencyName(workspaceCurrency)}"`
- Already has `workspaceId`, add workspace lookup

**Risk:** Low-medium — straightforward lookups. One extra DB read per request (workspace doc), but these are infrequent operations.

### Step 5: Fix Dashboard client formatting
`app/(shell)/dashboard/DashboardClient.tsx` lines 295, 304: hardcoded `"AUD"` in `formatCurrencyValue` calls.
- Since currency is now required (no default), these will be TypeScript errors after Step 2.
- Pass `workspace.currency` from workspace context (`useWorkspace()` hook).

**Risk:** Low — client has workspace currency via `useWorkspace()`.

### Step 6: Update onboarding to limit currency choices
`app/onboarding/OnboardingClient.tsx` currently lists 10 currencies. Replace the inline array with an import from `lib/currencies.ts` (which has the 5 supported ones). Map `CURRENCY_CONFIG` to the `{ code, name, symbol }` shape the dropdown expects.

**Risk:** Low.

### Step 7: Update `ensureUserHasWorkspace` default
`lib/workspace-service.ts` line 241: hardcoded `"AUD"`. This is for users who skip onboarding (auto-created workspace). Keep AUD as the default — this is fine since it's the original default and new users go through onboarding where they pick their currency.

**Risk:** None — keeping existing default.

### Step 8: Write tests (in parallel with Step 3)

Tests are split into two groups:

#### Group A: Unit tests for `lib/currencies.ts` (new file: `lib/__tests__/currencies.test.ts`)
Pure, fast, no mocking needed:
1. `getLocaleForCurrency` — each of the 5 returns correct locale; unknown currency returns `"en-AU"` fallback
2. `isSupportedCurrency` — `true` for the 5, `false` for "CAD", "JPY", random strings
3. `getCurrencyName` — returns human-readable name for each; unknown returns the code itself
4. `SUPPORTED_CURRENCIES` — contains exactly the 5 expected codes

#### Group B: Downstream integration tests for build functions (new file: `lib/__tests__/currency-formatting.test.ts`)
These test the **complete output pipeline** — they exercise formatting + aggregation together. This is where regressions are most likely to hide.

**Export** these previously-internal functions from `data.ts`:
- `buildExpenseBreakdown`
- `buildCashFlowWaterfall`
- `formatCurrencyValue` (already exported)
- `formatAmount` (currently not exported — export it)

**Test cases:**

1. **`formatCurrencyValue` with all 5 currencies:**
   ```
   formatCurrencyValue(1234.56, "AUD") → "$1,234.56"
   formatCurrencyValue(1234.56, "USD") → "$1,234.56"
   formatCurrencyValue(1234.56, "GBP") → "£1,234.56"
   formatCurrencyValue(1234.56, "NZD") → "$1,234.56"
   formatCurrencyValue(1234.56, "EUR") → "1.234,56 €" (de-DE locale)
   ```

2. **`formatCurrencyValue` edge cases:**
   - Zero: `formatCurrencyValue(0, "GBP")` → "£0.00"
   - Negative: `formatCurrencyValue(-500, "EUR")` → "-500,00 €"
   - Large numbers: `formatCurrencyValue(1000000, "USD")` → "$1,000,000.00"

3. **`buildExpenseBreakdown` with GBP workspace currency:**
   - Pass mock transactions (all with `currency: "GBP"`)
   - Assert `totalFormatted` contains "£", not "$"
   - Assert each category's `formattedAmount` contains "£"
   - Assert individual transaction `amount` contains "£"

4. **`buildExpenseBreakdown` with EUR workspace currency:**
   - Pass mock transactions with `currency: "EUR"`
   - Assert `totalFormatted` uses comma decimal / period thousands ("€")
   - This is the most visually different case — catches locale bugs

5. **`buildCashFlowWaterfall` with GBP workspace currency:**
   - Pass mock income + expense transactions
   - Assert income step `formattedValue` contains "£"
   - Assert expense steps contain "£"
   - Assert net step contains "£"

6. **`buildCashFlowWaterfall` with mixed transaction currencies:**
   - Transactions have individual currency (e.g., "USD"), home currency is "GBP"
   - Assert individual transaction `amount` uses the transaction's own currency ("$")
   - Assert summary steps (Income/Net/category totals) use home currency ("£")

7. **`maskCurrencyValue` with non-$ symbols:**
   - Update existing tests to also cover `"£1,234.56"` → `"£12***"` and `"1.234,56 €"` handling
   - This validates the regex in `maskCurrencyValue` handles GBP/EUR formatted strings

**Risk:** Low for the tests themselves. The main value is catching bugs in Step 3.

### Step 9: Run full test suite, lint, type-check, build
```sh
cd apps/web
npm test
npx eslint app/ lib/
npx tsc --noEmit
npm run build
```

---

## Execution order

The steps above are numbered for clarity but the optimal execution order is:

1. **Step 1** — create `lib/currencies.ts` (no dependencies)
2. **Step 8 Group A** — write unit tests for `currencies.ts` (validates Step 1)
3. **Step 2** — update formatting functions (makes currency required, breaks build intentionally)
4. **Step 8 Group B** — write downstream tests with expected output for non-AUD currencies. These tests define the contract we're targeting. Export the needed build functions.
5. **Step 3** — fix all call sites (compiler-guided). Run tests after each file to catch mistakes incrementally.
6. **Steps 4, 5, 6** — fix API routes, dashboard, onboarding (can be done in parallel)
7. **Step 7** — verify workspace-service default (just confirm, no code change)
8. **Step 9** — full CI suite

This way tests are written **before or alongside** the riskiest refactor (Step 3), and failing tests give us immediate signal if something breaks.

---

## Files touched (summary)

| File | Change |
|------|--------|
| `lib/currencies.ts` | **NEW** — shared constants, types, helpers |
| `lib/data.ts` | Remove AUD defaults from formatting functions; use dynamic locale; thread `homeCurrency` through build/get functions; export `buildExpenseBreakdown`, `buildCashFlowWaterfall`, `formatAmount` |
| `lib/workspace-service.ts` | No change (keep AUD default for `ensureUserHasWorkspace`) |
| `app/api/cash-logs/commit/route.ts` | Fetch workspace currency instead of hardcoding AUD |
| `app/api/imports/route.ts` | Use workspace currency as fallback instead of AUD |
| `app/api/assets/route.ts` | Use workspace currency as fallback instead of AUD |
| `app/api/transcribe/route.ts` | Dynamic currency name in Whisper prompt |
| `app/(shell)/dashboard/DashboardClient.tsx` | Use workspace currency for client-side formatting |
| `app/onboarding/OnboardingClient.tsx` | Limit to 5 supported currencies, import from shared constants |
| `lib/__tests__/currencies.test.ts` | **NEW** — unit tests for currency constants/helpers |
| `lib/__tests__/currency-formatting.test.ts` | **NEW** — downstream integration tests for formatting pipeline |
| Server components calling `get*` functions | Pass workspace currency through |

## What's NOT in scope
- Renaming `value_aud` → `value_home` in the DB schema (migration risk)
- Renaming `fetchAudRate` → `fetchHomeCurrencyRate` (deferred)
- Changing date display locale (stays `en-AU` for DD/MM/YYYY)
- Adding a settings page to change workspace currency post-creation
- Multi-currency transaction ledger (transactions already store their own currency)
- FX conversion display in the UI (already works for assets)

## Regression risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Forget to pass currency at a call site | Make currency required (no default) → TypeScript catches it |
| Pass wrong currency variable (e.g., asset currency instead of home currency) | Downstream tests verify formatted output end-to-end |
| EUR formatting breaks `maskCurrencyValue` regex | Explicit test for `"1.234,56 €"` masking |
| Mixed-currency transactions show wrong symbol | Test case 6: mixed currencies in waterfall |
| Existing AUD users see different formatting | AUD locale is `en-AU` — same as before, no visible change |
| Build functions export breaks encapsulation | Minor — they're pure functions, exporting is fine for testability |
