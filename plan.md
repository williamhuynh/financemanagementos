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
const CURRENCY_LOCALE_MAP: Record<SupportedCurrency, string> = {
  AUD: "en-AU",
  NZD: "en-NZ",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "de-DE",  // Euro conventions: 1.234,56 €
};
```

### "Home currency" concept
The workspace currency is the **home currency** — net worth rollups, dashboard totals, and category spend summaries are all denominated in this currency. Individual transactions/assets can still have their own currency. The existing `value_aud` field on asset valuations continues to serve as the "converted to home currency" value; renaming it to `value_home` is a future migration (out of scope).

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
Replace hardcoded `"en-AU"` locale with `getLocaleForCurrency(currency)`.

**Files:** `lib/data.ts`
**Functions to change:**
- `formatAmount(value, currency)` — line 609: `Intl.NumberFormat("en-AU", ...)` → `Intl.NumberFormat(getLocaleForCurrency(currency), ...)`
- `formatCurrencyValue(amount, currency)` — line 620: same change
- `formatSignedCurrency(amount, currency)` — line 627: delegates to `formatCurrencyValue`, no direct change needed
- `formatAssetValue`, `formatNetWorth` — already pass currency through, will benefit from upstream fix

**Risk:** Medium — this is the core formatting change. Every place that calls these functions will now get locale-correct formatting. The existing tests for `maskCurrencyValue` should still pass since it operates on the formatted string. Need new tests for formatting functions with different currencies.

### Step 3: Replace `DEFAULT_ASSET_CURRENCY` with workspace currency passthrough
Currently `DEFAULT_ASSET_CURRENCY = "AUD"` is used in net worth calculations, asset category summaries, and chart series formatting. These functions need the workspace's home currency passed in.

**Changes in `lib/data.ts`:**
- `getAssetOverview(workspaceId)` → `getAssetOverview(workspaceId, homeCurrency)` — pass home currency to `formatNetWorth` calls instead of `DEFAULT_ASSET_CURRENCY`
- `buildNetWorthSeries(...)` → add `homeCurrency` parameter
- `buildAssetSeries(...)` → add `homeCurrency` parameter
- Asset item formatting (lines 2487-2493): use `homeCurrency` for AUD-equivalent display
- Category summaries (line 2541): use `homeCurrency`
- Net worth formatted (line 2599): use `homeCurrency`
- `getStatCards(workspaceId)` — needs to fetch workspace currency to pass to `getAssetOverview`
- `DEFAULT_ASSET_DEFINITIONS` array — default currency should come from workspace, but these are templates, so keep `"AUD"` as the constant default for new workspace creation; the display formatting picks up the actual asset's currency

**For functions that produce formatted values for dashboard/monthly-close summaries:**
- `getMonthlyCloseSummary` (lines 2822+): hardcoded `"AUD"` in formatted fields → pass workspace currency
- `buildMonthlySnapshotPayload` (line 2958+): same
- `getExpenseBreakdown` / `buildExpenseBreakdown`: hardcoded `"AUD"` in category amounts / totals → pass workspace currency
- `getCashFlowWaterfall` / `buildCashFlowWaterfall`: hardcoded `"AUD"` in waterfall formatted values → pass workspace currency

**Callers of these functions** (server components in `app/(shell)/`) already have access to workspace context or can look it up. I'll trace each caller to pass the currency through.

**Risk:** Medium-high — many call sites. Careful to ensure every function signature change is reflected in callers.

### Step 4: Fix API route hardcoded defaults

#### `app/api/cash-logs/commit/route.ts` (line 87)
- Change `currency: "AUD"` → look up workspace currency: fetch workspace doc, use `workspace.currency`
- Already has `workspaceId` from `getApiContext()`

#### `app/api/imports/route.ts` (line 316)
- Change `row.currency ?? "AUD"` → `row.currency ?? workspaceCurrency`
- Already has `workspaceId`, need to fetch workspace to get currency

#### `app/api/assets/route.ts` (line 38)
- Change `body.currency?.trim() || "AUD"` → `body.currency?.trim() || workspaceCurrency`
- Already has `workspaceId`, need to fetch workspace

#### `app/api/transcribe/route.ts` (line 51)
- Replace "Amounts are in Australian dollars" → `Amounts are in ${getCurrencyName(workspaceCurrency)}`
- Already has `workspaceId`, need to fetch workspace

**Risk:** Low-medium — straightforward lookups. One extra DB read per request (workspace doc), but these are infrequent operations.

### Step 5: Fix Dashboard client formatting
`app/(shell)/dashboard/DashboardClient.tsx` lines 295, 304: hardcoded `"AUD"` in `formatCurrencyValue` calls.
- The dashboard component likely receives data from a server component. Need to pass workspace currency through or have the server-side functions pre-format.
- Since dashboard already shows `cashFlow.netTotal` etc., and these come from server-side data functions that I'm updating in Step 3 to use workspace currency, the formatted values will already be correct.
- For the two direct `formatCurrencyValue` calls in the client: pass `workspace.currency` from the workspace context.

**Risk:** Low — client has workspace currency via `useWorkspace()`.

### Step 6: Update onboarding to limit currency choices
`app/onboarding/OnboardingClient.tsx` currently lists 10 currencies. Reduce to the 5 supported ones (AUD, NZD, USD, GBP, EUR) and import from `lib/currencies.ts`.

**Risk:** Low.

### Step 7: Update `ensureUserHasWorkspace` default
`lib/workspace-service.ts` line 241: hardcoded `"AUD"`. This is for users who skip onboarding (auto-created workspace). Keep AUD as the default — this is fine since it's the original default and new users go through onboarding where they pick their currency.

**Risk:** None — keeping existing default.

### Step 8: Add tests
New test file or additions to `lib/__tests__/data-transforms.test.ts`:

1. **`getLocaleForCurrency`** — verify each supported currency returns correct locale, unknown currency returns `"en-AU"` fallback
2. **`isSupportedCurrency`** — verify true for the 5, false for others
3. **`formatCurrencyValue`** — test with AUD, USD, GBP, EUR, NZD:
   - AUD/NZD/USD: `$` symbol, comma thousands, period decimal
   - GBP: `£` symbol
   - EUR: `€` symbol, period thousands, comma decimal (de-DE locale)
4. **`formatAmount`** — same currency variants
5. **`getCurrencyName`** — returns human-readable name for Whisper prompt

**Risk:** Low.

### Step 9: Run full test suite, lint, type-check, build
```sh
cd apps/web
npm test
npx eslint app/ lib/
npx tsc --noEmit
npm run build
```

---

## Files touched (summary)

| File | Change |
|------|--------|
| `lib/currencies.ts` | **NEW** — shared constants, types, helpers |
| `lib/data.ts` | Update formatting functions to use locale map; thread `homeCurrency` through asset/expense/cashflow functions |
| `lib/workspace-service.ts` | No change (keep AUD default for `ensureUserHasWorkspace`) |
| `app/api/cash-logs/commit/route.ts` | Fetch workspace currency instead of hardcoding AUD |
| `app/api/imports/route.ts` | Use workspace currency as fallback instead of AUD |
| `app/api/assets/route.ts` | Use workspace currency as fallback instead of AUD |
| `app/api/transcribe/route.ts` | Dynamic currency name in Whisper prompt |
| `app/(shell)/dashboard/DashboardClient.tsx` | Use workspace currency for client-side formatting |
| `app/onboarding/OnboardingClient.tsx` | Limit to 5 supported currencies, import from shared constants |
| `lib/__tests__/data-transforms.test.ts` | New tests for currency formatting + locale mapping |
| Callers of updated data functions | Pass workspace currency through where needed |

## What's NOT in scope
- Renaming `value_aud` → `value_home` in the DB schema (migration risk)
- Renaming `fetchAudRate` → `fetchHomeCurrencyRate` (deferred)
- Changing date display locale (stays `en-AU` for DD/MM/YYYY)
- Adding a settings page to change workspace currency post-creation
- Multi-currency transaction ledger (transactions already store their own currency)
- FX conversion display in the UI (already works for assets)
