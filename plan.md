# Plan: Fix Hardcoded Currency & Locale

## Problem
The app hardcodes `"AUD"` and `"en-AU"` throughout. The workspace already stores a `currency` field, but it's not plumbed to formatting functions, fallback defaults, or AI prompts. Changing the workspace currency from AUD would produce wrong formatting or stale AUD references.

## Scope
- Supported currencies: **AUD, NZD, USD, GBP, EUR** only (user request to limit scope)
- No new DB schema changes (workspace already has `currency` field; `value_aud` field name stays)
- Date formatting locale stays `en-AU` for now (DD/MM/YYYY is a display convention, not currency-dependent — ISO stored in DB)
- Currency is set at workspace creation and **not changeable afterwards** (no migration path for existing data)

## Design Decisions

### Currency → Locale mapping
`Intl.NumberFormat` needs a locale to format correctly. We use **English locales for all currencies** to keep consistent symbol-first, period-decimal formatting across the app:

```typescript
const CURRENCY_CONFIG: Record<SupportedCurrency, { name: string; symbol: string; locale: string }> = {
  AUD: { name: "Australian Dollar",   symbol: "$",  locale: "en-AU" },
  NZD: { name: "New Zealand Dollar",  symbol: "$",  locale: "en-NZ" },
  USD: { name: "US Dollar",           symbol: "$",  locale: "en-US" },
  GBP: { name: "British Pound",       symbol: "£",  locale: "en-GB" },
  EUR: { name: "Euro",                symbol: "€",  locale: "en-IE" },
};
```

**Why `en-IE` for EUR, not `de-DE`?** Verified in Node 20:
- `de-DE/EUR` → `"1.234,56 €"` (number first, comma decimal, symbol last) — breaks `maskCurrencyValue`, breaks any code assuming symbol-first format, jarring UX
- `en-IE/EUR` → `"€1,234.56"` (symbol first, period decimal) — consistent with all other currencies, no parsing breakage

All 5 currencies now produce consistent `SYMBOL + number` format.

### "Home currency" concept
The workspace currency is the **home currency** — net worth rollups, dashboard totals, and category spend summaries are all denominated in this currency. Individual transactions/assets can still have their own currency.

The existing `value_aud` DB field stores "value converted to home currency". The field name is a misnomer for non-AUD workspaces but renaming it is a migration (out of scope). For AUD workspaces, behavior is identical to today.

### FX conversion must target workspace currency (not always AUD)
`fetchAudRate()` in `app/api/assets/values/route.ts` currently converts every asset value to AUD. This must be generalized to convert to the workspace's home currency, otherwise net worth is numerically wrong for non-AUD workspaces (e.g., a GBP workspace would display AUD numbers with a £ symbol).

### TypeScript as safety net
Make the `currency` parameter **required** (remove `= "AUD"` defaults) on `formatAmount`, `formatCurrencyValue`, `formatSignedCurrency`, `buildSpendByCategory`. `tsc --noEmit` will flag every call site that doesn't pass a currency — turning a manual audit of ~40 sites into a compiler-checked refactor.

### Export pure build functions for testing
The internal `build*` functions (`buildExpenseBreakdown`, `buildCashFlowWaterfall`) are pure computation — no DB access. Export them so downstream tests can verify the formatted output pipeline with non-AUD currencies end-to-end.

### Currency not changeable post-creation
There is no UI to change workspace currency after creation. This is intentional: existing `value_aud` entries and transaction currency fields are denominated in the original currency. Changing it would make historical data numerically wrong without a migration. Document this as a known constraint.

---

## Step-by-step changes

### Step 1: Create shared currency constants (`lib/currencies.ts`)
**New file.** Single source of truth for supported currencies, locale mapping, and metadata.

```typescript
export const SUPPORTED_CURRENCIES = ["AUD", "NZD", "USD", "GBP", "EUR"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_CONFIG: Record<SupportedCurrency, { name: string; symbol: string; locale: string }> = {
  AUD: { name: "Australian Dollar",   symbol: "$",  locale: "en-AU" },
  NZD: { name: "New Zealand Dollar",  symbol: "$",  locale: "en-NZ" },
  USD: { name: "US Dollar",           symbol: "$",  locale: "en-US" },
  GBP: { name: "British Pound",       symbol: "£",  locale: "en-GB" },
  EUR: { name: "Euro",                symbol: "€",  locale: "en-IE" },
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

**Risk:** Medium — core formatting change. Deliberately breaks the build until Step 3 is complete.

### Step 3: Fix `maskCurrencyValue` regex
The regex at line 639 is `/^(-?)(\$|[A-Z]{3})\s?([\d,]+\.?\d*)/`. Verified in Node 20:
- `"£1,234.56"` — **no match** (£ is not `$` or `[A-Z]{3}`)
- `"€1,234.56"` — **no match** (€ is not `$` or `[A-Z]{3}`)

Fix: expand the symbol class to `([$£€]|[A-Z]{3})`.

This is a standalone bug fix that must happen before the formatting changes take effect, otherwise GBP/EUR masking silently degrades (falls through to the generic first-2-chars fallback instead of the currency-aware path).

**Risk:** Low — small regex change, existing `$` behavior unchanged.

### Step 4: Fix all call sites in `lib/data.ts` (compiler-guided)
Run `tsc --noEmit` and fix every error. Each call site falls into one of two categories:

**Category A — Transaction-level formatting (use the transaction's own currency):**
These already have `txn.currency` available. Pass it through. Fallback to `homeCurrency` (not hardcoded "AUD").
- Line 1080: `txn.currency || homeCurrency`
- Line 1216: same pattern

**Category B — Summary/rollup formatting (use workspace home currency):**
These aggregate across transactions and need the workspace's home currency.

In `buildExpenseBreakdown` (add `homeCurrency: string` parameter):
- Lines 1102, 1116, 1127: replace `"AUD"` → `homeCurrency`

In `buildCashFlowWaterfall` (add `homeCurrency: string` parameter):
- Lines 1245, 1278, 1286: replace `"AUD"` → `homeCurrency`

In asset functions:
- `buildNetWorthSeries`, `buildAssetSeries` — add `homeCurrency` parameter, replace `DEFAULT_ASSET_CURRENCY`
- Asset item formatting (lines 2487-2493), category summaries (line 2541), net worth (line 2599): use `homeCurrency`

In monthly close summaries (lines 2822-2955):
- All `formatCurrencyValue(x, "AUD")` and `formatNetWorth(x, "AUD")` → workspace currency
- `getMonthlyCloseSummary` needs `homeCurrency` parameter or workspace lookup

**Callers of updated exported functions** — the `get*` functions:
- `getExpenseBreakdown(workspaceId, homeCurrency, selectedMonth)`
- `getCashFlowWaterfall(workspaceId, homeCurrency, selectedMonth)`
- `getAssetOverview(workspaceId, homeCurrency)`
- `getStatCards(workspaceId)` — fetch workspace to get currency
- `getMonthlyCloseSummary(workspaceId, homeCurrency, selectedMonth)`

**Server component callers** (`dashboard/page.tsx`, `assets/page.tsx`, `reports/page.tsx`):
Each currently calls `getApiContext()` which returns `workspaceId` but NOT the workspace currency.
Each needs an additional call: `const workspace = await getWorkspaceById(context.workspaceId)` to get `workspace.currency`, then pass it to data functions. This is one extra DB read per page load — acceptable since it's cached within the render pass.

**Risk:** Medium-high in line count, but **low in missed sites** (compiler catches every one). Real risk is plumbing the wrong variable — downstream tests guard against this.

### Step 5: Generalize FX conversion (`app/api/assets/values/route.ts`)
`fetchAudRate(currency)` always converts to AUD. For non-AUD workspaces, `value_aud` must store the home-currency equivalent.

**Changes:**
- Rename function: `fetchAudRate(currency)` → `fetchHomeCurrencyRate(fromCurrency, homeCurrency)`
- If `fromCurrency === homeCurrency`, return `{ rate: 1, source: "local" }`
- Otherwise: fetch both rates from openexchangerates (USD-based), compute cross rate `rates[homeCurrency] / rates[fromCurrency]`
- Caller: look up workspace currency via `getWorkspaceById(workspaceId)`, pass as `homeCurrency`
- The math is identical to today's cross-rate logic (line 61: `audRate / baseRate`), just generalized

For AUD workspaces, behavior is identical — the function returns the same rates as before.

**Risk:** Medium — touches FX logic but the math is a straightforward generalization. The old code already handles cross-rates; we're just parameterizing the target currency.

### Step 6: Fix API route hardcoded defaults

#### `app/api/cash-logs/commit/route.ts` (line 87)
- `currency: "AUD"` → `workspace.currency`
- Add `getWorkspaceById(workspaceId)` call

#### `app/api/imports/route.ts` (line 316)
- `row.currency ?? "AUD"` → `row.currency ?? workspaceCurrency`
- Add workspace lookup

#### `app/api/assets/route.ts` (line 38)
- `body.currency?.trim() || "AUD"` → `body.currency?.trim() || workspaceCurrency`
- Add workspace lookup

#### `app/api/transcribe/route.ts` (line 51)
- `"Amounts are in Australian dollars"` → `` `Amounts are in ${getCurrencyName(workspaceCurrency)}` ``
- Add workspace lookup

**Risk:** Low-medium — straightforward lookups. One extra DB read per request, but these are infrequent.

### Step 7: Fix Dashboard client formatting
`app/(shell)/dashboard/DashboardClient.tsx` lines 295, 304: hardcoded `"AUD"` in `formatCurrencyValue` calls.
- Since currency is now required (no default), these will be TypeScript errors after Step 2.
- Pass `workspace.currency` from workspace context (`useWorkspace()` hook).

**Risk:** Low.

### Step 8: Update onboarding to limit currency choices
`app/onboarding/OnboardingClient.tsx` currently lists 10 currencies. Replace inline array with import from `lib/currencies.ts`. Map `CURRENCY_CONFIG` entries to the `{ code, name, symbol }` shape.

**Risk:** Low.

### Step 9: Keep `ensureUserHasWorkspace` default
`lib/workspace-service.ts` line 241: hardcoded `"AUD"`. Keep as-is — auto-created workspaces default to AUD. Users choose currency during onboarding.

**Risk:** None.

### Step 10: Write tests

#### Group A: Unit tests for `lib/currencies.ts` (`lib/__tests__/currencies.test.ts`)
1. `getLocaleForCurrency` — each of 5 returns correct locale; unknown returns `"en-AU"`
2. `isSupportedCurrency` — `true` for 5, `false` for "CAD", "JPY", etc.
3. `getCurrencyName` — human-readable name; unknown returns code itself
4. `SUPPORTED_CURRENCIES` — exactly the 5 expected codes

#### Group B: Downstream tests (`lib/__tests__/currency-formatting.test.ts`)
Export `buildExpenseBreakdown`, `buildCashFlowWaterfall`, `formatAmount` from `data.ts`.

**Test cases:**

1. **`formatCurrencyValue` with all 5 currencies:**
   ```
   formatCurrencyValue(1234.56, "AUD") → "$1,234.56"
   formatCurrencyValue(1234.56, "USD") → "$1,234.56"
   formatCurrencyValue(1234.56, "GBP") → "£1,234.56"
   formatCurrencyValue(1234.56, "NZD") → "$1,234.56"
   formatCurrencyValue(1234.56, "EUR") → "€1,234.56"
   ```
   Use `toContain` for symbol assertions where exact match is fragile (Intl may insert narrow/non-breaking spaces between currency symbol and number in some environments).

2. **`formatCurrencyValue` edge cases:**
   - Zero: `formatCurrencyValue(0, "GBP")` → contains "£" and "0.00"
   - Negative: `formatCurrencyValue(-500, "EUR")` → contains "€" and "500.00"
   - Large numbers: `formatCurrencyValue(1000000, "USD")` → contains "$" and "1,000,000.00"

3. **`maskCurrencyValue` with all symbol types:**
   - `"$1,234.56"` → `"$12***"` (existing behavior, unchanged)
   - `"-$500.00"` → `"-$50***"` (existing)
   - `"£1,234.56"` → `"£12***"` (new — validates regex fix)
   - `"€1,234.56"` → `"€12***"` (new — validates regex fix)
   - `"NZD 1,234.56"` → `"NZD12***"` (3-letter code path)

4. **`buildExpenseBreakdown` with GBP home currency:**
   - Pass mock transactions (all `currency: "GBP"`)
   - Assert `totalFormatted` contains "£"
   - Assert each category's `formattedAmount` contains "£"

5. **`buildExpenseBreakdown` with EUR home currency:**
   - Assert `totalFormatted` contains "€"

6. **`buildCashFlowWaterfall` with GBP home currency:**
   - Assert income/expense/net steps' `formattedValue` contains "£"

7. **`buildCashFlowWaterfall` with mixed transaction currencies:**
   - Transactions have `currency: "USD"`, home currency is "GBP"
   - Individual transaction `amount` uses "$" (transaction's own currency)
   - Summary steps (Income/Net/category totals) use "£" (home currency)

### Step 11: Run full test suite, lint, type-check, build
```sh
cd apps/web
npm test
npx eslint app/ lib/
npx tsc --noEmit
npm run build
```

---

## Execution order

1. **Step 1** — create `lib/currencies.ts`
2. **Step 10 Group A** — unit tests for currencies.ts (validates Step 1)
3. **Step 2** — update formatting functions (makes currency required, intentionally breaks build)
4. **Step 3** — fix `maskCurrencyValue` regex (standalone fix)
5. **Step 10 Group B** — downstream tests defining target contract. Export build functions.
6. **Step 4** — fix all call sites in data.ts (compiler-guided, tests validate incrementally)
7. **Step 5** — generalize FX conversion
8. **Steps 6, 7, 8** — API routes, dashboard, onboarding (parallelizable)
9. **Step 9** — verify workspace-service default
10. **Step 11** — full CI suite

---

## Files touched (summary)

| File | Change |
|------|--------|
| `lib/currencies.ts` | **NEW** — shared constants, types, helpers |
| `lib/data.ts` | Remove AUD defaults; dynamic locale; fix maskCurrencyValue regex; thread `homeCurrency` through build/get functions; export build functions |
| `app/api/assets/values/route.ts` | Generalize `fetchAudRate` → `fetchHomeCurrencyRate` |
| `app/api/cash-logs/commit/route.ts` | Fetch workspace currency instead of hardcoding AUD |
| `app/api/imports/route.ts` | Use workspace currency as fallback |
| `app/api/assets/route.ts` | Use workspace currency as fallback |
| `app/api/transcribe/route.ts` | Dynamic currency name in Whisper prompt |
| `app/(shell)/dashboard/page.tsx` | Add `getWorkspaceById` call, pass currency to data functions |
| `app/(shell)/dashboard/DashboardClient.tsx` | Use workspace currency for client-side formatting |
| `app/(shell)/assets/page.tsx` | Add `getWorkspaceById` call, pass currency |
| `app/(shell)/reports/page.tsx` | Add `getWorkspaceById` call, pass currency |
| `app/onboarding/OnboardingClient.tsx` | Limit to 5 supported currencies |
| `lib/__tests__/currencies.test.ts` | **NEW** — currency constant unit tests |
| `lib/__tests__/currency-formatting.test.ts` | **NEW** — downstream formatting pipeline tests |

## What's NOT in scope
- Renaming `value_aud` DB field → `value_home` (migration risk, field name is cosmetic)
- Changing date display locale (stays `en-AU` for DD/MM/YYYY)
- Adding a settings page to change workspace currency post-creation
- Migrating existing workspace data when currency changes (currency is immutable post-creation)
- Cross-currency transaction aggregation with conversion (transactions in a workspace should all be in the workspace currency; mixed currencies are summed at face value — pre-existing behavior)

## Regression risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Forget to pass currency at a call site | Make currency required (no default) → TypeScript catches it |
| Pass wrong currency variable (e.g., asset currency instead of home currency) | Downstream tests verify formatted output end-to-end |
| `maskCurrencyValue` fails on £/€ symbols | Step 3 fixes regex; Step 10 adds explicit tests |
| Net worth wrong for non-AUD workspaces | Step 5 generalizes FX conversion to target home currency |
| Test fragility from Intl.NumberFormat whitespace variations | Use `toContain` for symbol assertions, not exact string matches |
| Changing workspace currency breaks historical data | Currency is immutable post-creation (no UI exists to change it) |
| Existing AUD users see different formatting | AUD locale is `en-AU` — identical to today |
| Server components lack workspace currency | Each page.tsx adds `getWorkspaceById` call (cached in render pass) |

## Issues found during review (resolved above)

1. **EUR locale was `de-DE`** → produces `"1.234,56 €"` (number-first, comma decimal). Changed to `en-IE` → `"€1,234.56"` (symbol-first, period decimal). Avoids breaking masking, parsing, and UI consistency.

2. **`maskCurrencyValue` regex silently fails on £/€** → falls through to generic fallback. Added as explicit Step 3 fix.

3. **FX conversion always targets AUD** → net worth would be AUD-denominated but labelled with workspace symbol. Moved from "out of scope" to Step 5.

4. **No guard against currency change** → documented as intentional constraint (immutable post-creation).

5. **Server components don't have workspace currency** → each `page.tsx` needs explicit `getWorkspaceById` call. Made specific in Step 4.
