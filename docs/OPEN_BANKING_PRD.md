# Open Banking Integration PRD — Basiq (Alpha)

## 1. Overview

### Problem
Currently, all transaction and account data enters the system via manual CSV upload (or cash log text entry). This creates friction: users must log into each bank, download statements, and import them periodically. Australian Open Banking (Consumer Data Right / CDR) enables consent-based, API-driven access to bank data — eliminating the manual export/import cycle.

### Proposal
Integrate with **Basiq** (basiq.io), an ACCC-accredited CDR data recipient, to allow users to connect their Australian bank accounts and automatically ingest transactions and account data. This will run **alongside** the existing CSV import flow — not replace it.

### Scope: Alpha
This is an alpha/experimental feature. The goals are:

- Prove the integration works end-to-end in sandbox, then with a single live account
- Understand the data quality, refresh reliability, and CDR consent lifecycle
- Keep the blast radius small — alpha flag, single workspace, minimal UI
- Inform whether to invest in a full production rollout

### Why Basiq
- ACCC-accredited ADR — handles CDR compliance on our behalf
- Hosted Consent UI — we do not need to build CDR-compliant consent screens
- Covers 100+ Australian institutions via CDR and DDC connectors
- Free sandbox environment with test institution ("Hooli")
- Node.js SDK available; REST API is well-documented
- Industry standard in Australian fintech (1.5M+ users served)

---

## 2. User Stories

### Alpha Stories
| ID | Story | Priority |
|----|-------|----------|
| OB-1 | As a user, I can connect one bank account via Basiq so that my transactions sync automatically | Must |
| OB-2 | As a user, I can see the status of my bank connection (active, needs attention, syncing) | Must |
| OB-3 | As a user, I can trigger a manual refresh of my connected account's data | Must |
| OB-4 | As a user, I can disconnect my bank account and optionally purge the synced data | Must |
| OB-5 | As a user, imported Basiq transactions appear in my ledger with the same fields as CSV imports | Must |
| OB-6 | As a user, Basiq-imported transactions go through the same categorization pipeline as CSV imports | Should |
| OB-7 | As a user, I can see which transactions came from Basiq vs CSV in the ledger | Should |
| OB-8 | As a user, duplicate transactions between Basiq sync and manual CSV import are detected | Should |

### Future Stories (Post-Alpha)
| ID | Story | Priority |
|----|-------|----------|
| OB-9 | As a user, I can connect multiple bank accounts across institutions | - |
| OB-10 | As a user, my data refreshes automatically via Smart Cache (no manual trigger needed) | - |
| OB-11 | As a user, I receive a notification when my connection needs re-authentication | - |
| OB-12 | As a user, I can manage/extend/revoke my CDR consent from within the app | - |
| OB-13 | As a user, my account balances from Basiq update my Assets dashboard | - |

---

## 3. Architecture

### High-Level Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────┐
│   Frontend   │────>│  Next.js API │────>│  Basiq   │────>│  Bank    │
│  (Settings)  │     │   Routes     │     │   API    │     │  (CDR)   │
└──────┬───────┘     └──────┬───────┘     └──────────┘     └──────────┘
       │                    │
       │              ┌─────▼──────┐
       │              │  Appwrite  │
       └──────────────│  Database  │
                      └────────────┘
```

### Connection Flow (Step by Step)

```
1. User clicks "Connect Bank" in Settings → Open Banking tab
2. Frontend calls POST /api/open-banking/connect
3. Backend creates Basiq user (if first connection) → stores basiq_user_id
4. Backend generates CLIENT_ACCESS token scoped to that user
5. Frontend redirects to Basiq Consent UI with token
6. User selects institution, authenticates with bank, grants consent
7. Basiq redirects back to our app with connection result
8. Backend polls Basiq job until accounts + transactions are retrieved
9. Backend maps Basiq transactions → our transaction schema
10. Transactions appear in ledger; connection status shown in Settings
```

### Sync/Refresh Flow

```
1. User clicks "Refresh" OR background job triggers
2. Backend calls POST /users/{userId}/connections/{connId}/refresh
3. Backend polls job until complete
4. Backend fetches new/updated transactions since last sync
5. Deduplication check against existing transactions
6. New transactions inserted, categorization pipeline runs
7. Connection last_synced timestamp updated
```

### Component Breakdown

| Component | Location | Purpose |
|-----------|----------|---------|
| `BasiqService` | `lib/basiq/service.ts` | Server-side Basiq API client (token management, user/connection/transaction CRUD) |
| `basiq-token.ts` | `lib/basiq/token.ts` | Token caching and refresh logic (60-min expiry) |
| `basiq-mapper.ts` | `lib/basiq/mapper.ts` | Maps Basiq transaction/account schema → our schema |
| API: `/api/open-banking/connect` | `app/api/open-banking/connect/route.ts` | Initiate connection: create Basiq user, return Consent UI URL |
| API: `/api/open-banking/callback` | `app/api/open-banking/callback/route.ts` | Handle post-consent redirect, trigger initial sync |
| API: `/api/open-banking/sync` | `app/api/open-banking/sync/route.ts` | Manual refresh trigger |
| API: `/api/open-banking/status` | `app/api/open-banking/status/route.ts` | Connection status + last sync info |
| API: `/api/open-banking/disconnect` | `app/api/open-banking/disconnect/route.ts` | Disconnect + optional data purge |
| UI: Connection Manager | `app/(shell)/settings/OpenBankingSettings.tsx` | Connect/disconnect/status UI in Settings |
| UI: Sync indicator | `app/(shell)/import-hub/` | Show Basiq as a source alongside CSV |

---

## 4. Data Model Changes

### New Collection: `basiq_connections`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Appwrite document ID |
| `workspace_id` | string | Workspace this connection belongs to |
| `user_id` | string | Appwrite user who created it |
| `basiq_user_id` | string | Basiq's user ID for this connection |
| `basiq_connection_id` | string | Basiq's connection ID |
| `institution_id` | string | Basiq institution identifier |
| `institution_name` | string | Display name (e.g., "Commonwealth Bank") |
| `status` | string | `active` / `invalid` / `pending` / `disconnected` |
| `consent_expires_at` | string | ISO datetime when CDR consent expires |
| `last_synced_at` | string | ISO datetime of last successful sync |
| `last_sync_cursor` | string | Cursor/filter for incremental transaction fetch |
| `account_data` | string | JSON — cached account details from Basiq (id, name, accountNo, balance, type) |
| `error_message` | string | Last error if status is `invalid` |
| `created_at` | string | ISO datetime |
| `updated_at` | string | ISO datetime |

### Existing Collection Changes: `transactions`

No schema changes required. Basiq transactions map cleanly to existing fields:

| Our Field | Basiq Source | Notes |
|-----------|-------------|-------|
| `workspace_id` | (from connection) | Same multi-tenancy model |
| `import_id` | (synthetic) | Create an import record with `source_name: "basiq"` |
| `date` | `transactionDate` | YYYY-MM-DD |
| `description` | `description` | Raw bank description |
| `amount` | `amount` | Absolute value |
| `currency` | `account.currency` | Usually "AUD" |
| `account_name` | `account.name` or `institution_name + accountNo` | Derived from Basiq account |
| `source_account` | `account.accountNo` | Bank account number |
| `source_owner` | (user-specified at connection time) | "William", "Peggy", etc. |
| `category_name` | "Uncategorised" initially | Then AI categorization runs |
| `direction` | `direction` | "debit" / "credit" — direct mapping |
| `notes` | "" | Empty by default |
| `is_transfer` | false | Transfer matching runs post-import |
| `needs_review` | true | Until categorized |

### Existing Collection Changes: `imports`

A Basiq sync creates an import record for traceability:

| Field | Value |
|-------|-------|
| `source_name` | `"basiq"` |
| `source_account` | Institution name + account |
| `source_owner` | User-specified owner |
| `file_name` | `"basiq-sync-{connectionId}-{date}"` |
| `row_count` | Number of transactions synced |
| `status` | `"imported"` → `"processed"` after categorization |

### New Entry in `collection-names.ts`

```typescript
BASIQ_CONNECTIONS: 'basiq_connections',
```

---

## 5. Basiq API Integration Details

### Authentication & Token Management

```
Endpoint: POST https://au-api.basiq.io/token
Header: Authorization: Basic {BASIQ_API_KEY}
Header: basiq-version: 3.0
Body: scope=SERVER_ACCESS
```

**Token caching strategy:**
- Cache the SERVER_ACCESS token in a module-level variable with expiry timestamp
- Refresh when < 5 minutes remain (tokens last 60 minutes)
- Single token shared across all requests (Basiq best practice)
- CLIENT_ACCESS tokens generated per-user on demand (for Consent UI)

### Environment Variables (New)

```env
# Basiq Integration (Alpha)
BASIQ_API_KEY=               # Server API key from Basiq Dashboard
BASIQ_ENABLED=false          # Alpha feature flag — set to "true" to enable
BASIQ_ENVIRONMENT=sandbox    # "sandbox" or "production"
BASIQ_CONSENT_REDIRECT_URL=  # URL Basiq redirects to after consent (e.g., https://app.example.com/api/open-banking/callback)
```

### Key API Calls

**Create user:**
```
POST /users
Body: { "email": "<user_email>", "mobile": "" }
→ Returns: { "id": "basiq_user_id", ... }
```

**Generate client token (for Consent UI):**
```
POST /token
Body: scope=CLIENT_ACCESS&userId={basiq_user_id}
→ Returns: { "access_token": "...", "expires_in": 3600 }
```

**List accounts:**
```
GET /users/{basiq_user_id}/accounts
→ Returns: { "data": [{ "id", "accountNo", "name", "balance", "currency", "institution", ... }] }
```

**List transactions (with filtering):**
```
GET /users/{basiq_user_id}/transactions?filter=transaction.postDate.gt('{last_sync_date}')
→ Returns: { "data": [{ "id", "description", "amount", "direction", "transactionDate", "account", ... }] }
```

**Refresh connection:**
```
POST /users/{basiq_user_id}/connections/{connection_id}/refresh
→ Returns: { "id": "job_id", "steps": [...] }
```

**Poll job:**
```
GET /jobs/{job_id}
→ Returns: { "steps": [{ "title": "verify-credentials", "status": "success" }, ...] }
```

### Error Handling

| Basiq Error | Our Response |
|-------------|-------------|
| `403` / `429` — Rate limited | Retry with exponential backoff (max 3 retries) |
| Connection `invalid` status | Update local status, show "Reconnect" prompt to user |
| Job step failure | Log error, update connection status, surface to user |
| Token expired mid-request | Auto-refresh token and retry once |
| Network timeout | Retry with backoff; surface after 3 failures |

---

## 6. Deduplication Strategy

Since users may continue uploading CSV files alongside Basiq sync, deduplication is critical.

### Approach: Hash-Based Matching

Generate a dedup key for each transaction:
```
dedup_key = hash(date + amount + direction + normalise(description) + account_identifier)
```

**Normalisation rules for description:**
- Lowercase
- Strip whitespace
- Remove common bank prefixes ("EFTPOS", "VISA PURCHASE", "DIRECT DEBIT")

**Dedup logic on sync:**
1. For each incoming Basiq transaction, compute dedup_key
2. Query existing transactions for same workspace + account + date range (±2 days)
3. Compute dedup_key for each existing transaction
4. If match found → skip (do not insert duplicate)
5. If no match → insert as new transaction

**Edge cases:**
- Same amount + same day + different merchants → different descriptions prevent false match
- Same merchant + same amount + same day (e.g., two coffees) → rare; accept potential missed duplicate in alpha. Revisit with Basiq transaction ID matching in production.

---

## 7. Feature Flag: Alpha Gating

Consistent with the existing pattern of env-var-based feature toggling (like `OPENROUTER_API_KEY` enabling AI categorization):

```typescript
// lib/basiq/config.ts
export function isBasiqEnabled(): boolean {
  return process.env.BASIQ_ENABLED === 'true' && !!process.env.BASIQ_API_KEY;
}

export function isBasiqSandbox(): boolean {
  return process.env.BASIQ_ENVIRONMENT !== 'production';
}
```

**UI gating:**
- The "Open Banking" tab in Settings only renders if `isBasiqEnabled()` returns true (checked server-side, passed as prop)
- All `/api/open-banking/*` routes return `404` if Basiq is not enabled
- In sandbox mode, show a banner: "Sandbox Mode — Connected to test institution (Hooli)"

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Basiq API key exposure | Store only in server env vars. Never send to client. All Basiq API calls happen server-side. |
| CLIENT_ACCESS token scope | Generated per-user, short-lived (60 min). Only used for Consent UI redirect. |
| Bank credentials | Never touch our system. User authenticates directly with bank via Basiq's hosted Consent UI / CDR redirect. |
| Stored Basiq user IDs | Stored in Appwrite with same workspace-level access controls as all other data. |
| CDR consent data | Consent lifecycle managed by Basiq. We store expiry date and status only. |
| Connection invalidation | Monitored via status checks; user prompted to re-authenticate when needed. |
| Data at rest | Appwrite's existing encryption. Basiq transaction data stored as regular transactions — no additional PII beyond what CSV imports already contain. |
| Multi-tenancy | All Basiq connections scoped to `workspace_id` — same isolation model as everything else. |

---

## 9. CDR Compliance Notes

Since we are using Basiq as the accredited data recipient, most CDR compliance is handled by Basiq. However, we must:

1. **Operate under Basiq's accreditation** — Most likely as an "affiliate" or "representative" under their sponsorship model. Requires application to Basiq.
2. **Display CDR-compliant consent language** — Handled by Basiq's hosted Consent UI.
3. **Honour consent expiry** — When `consent_expires_at` passes, stop syncing and prompt user to re-consent.
4. **Support consent revocation** — User can disconnect at any time; we call Basiq's purge + delete endpoints.
5. **Data retention** — After consent revocation, CDR data should be deleted or de-identified per CDR rules. In alpha, we prompt the user to choose: keep imported transactions or delete them.

**For alpha:** No formal accreditation needed while using sandbox. Before going live, apply to Basiq's partnership program.

---

## 10. UI Design (Alpha — Minimal)

### Settings > Open Banking Tab

```
┌─────────────────────────────────────────────────┐
│  Open Banking (Alpha)                           │
│                                                 │
│  ┌─ Sandbox Mode ─────────────────────────────┐ │
│  │ Connected to test institution (Hooli)       │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  Status: ● Active                               │
│  Institution: Hooli Bank                        │
│  Account: Savings ****1234                      │
│  Last synced: 2 hours ago                       │
│  Consent expires: 90 days remaining             │
│                                                 │
│  [ Sync Now ]  [ Disconnect ]                   │
│                                                 │
│  ── OR ──                                       │
│                                                 │
│  No bank connected.                             │
│  [ Connect Bank Account ]                       │
│                                                 │
│  Owner: [ William ▾ ]                           │
│  (Assigns synced transactions to this owner)    │
└─────────────────────────────────────────────────┘
```

### Import Hub — Source Indicator

In the imports list and transaction ledger, show the source:

```
┌──────────────────────────────────────────────┐
│  Recent Imports                               │
│                                               │
│  📄 westpac-jan-2026.csv — 47 transactions    │
│  🏦 Basiq Sync (Hooli) — 23 transactions      │
│  📄 amex-dec-2025.csv — 31 transactions        │
└──────────────────────────────────────────────┘
```

### Transaction Ledger — Source Badge

Each transaction row can show a small badge: `CSV` or `Basiq` based on the import's `source_name`.

---

## 11. Implementation Phases

### Phase A: Foundation (Sandbox)

1. Add `BASIQ_*` environment variables and feature flag
2. Create `lib/basiq/` module: token management, API client, schema mapper
3. Create `basiq_connections` Appwrite collection
4. Build `/api/open-banking/connect` — create Basiq user, return Consent UI URL
5. Build `/api/open-banking/callback` — handle redirect, poll job, initial sync
6. Build `/api/open-banking/status` — return connection info
7. Build `/api/open-banking/sync` — manual refresh + incremental transaction fetch
8. Build `/api/open-banking/disconnect` — purge + delete connection
9. Build Settings UI: Open Banking tab with connect/status/disconnect
10. Test full flow with Basiq sandbox ("Hooli" test institution)

### Phase B: Transaction Pipeline Integration

1. Map Basiq transactions to our schema and create import records
2. Wire Basiq imports into the existing AI categorization pipeline
3. Implement deduplication logic for Basiq-vs-CSV overlap
4. Add source indicators to Import Hub and Ledger UI
5. Test deduplication with mixed Basiq + CSV data

### Phase C: Single Live Account

1. Apply to Basiq partnership (affiliate/representative model)
2. Switch `BASIQ_ENVIRONMENT=production`
3. Connect one real bank account (personal testing)
4. Validate: data accuracy, refresh reliability, consent lifecycle
5. Monitor: error rates, sync latency, data freshness

### Phase D: Hardening (Pre-Beta)

1. Add webhook listener for `transactions.updated` and `connection.invalidated`
2. Enable Smart Cache (request from Basiq — automatic 5x/day refresh)
3. Handle consent expiry and renewal flows
4. Add connection health monitoring and alerting
5. Stress-test deduplication with high transaction volumes
6. Write integration tests against sandbox

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Basiq sandbox behaves differently from production | Medium | Medium | Test with real account in Phase C before broader rollout |
| DDC connectors break when banks update portals | High | Low | Prefer CDR-connected institutions; DDC is a fallback |
| CDR consent expires and user doesn't re-consent | Medium | Low | Track expiry, notify user before expiry, graceful degradation |
| Duplicate transactions from Basiq + CSV | High | Medium | Hash-based dedup; show clear source indicators |
| Basiq rate limits hit during bulk sync | Low | Low | Respect 20 refreshes/day limit; use incremental sync |
| Basiq pricing ($500/mo minimum) is too high for personal use | - | High | Stay on sandbox as long as possible; evaluate cost-benefit before going live |
| Bank-side failures during sync | Medium | Low | Retry with backoff; surface error to user; don't lose existing data |
| Basiq API changes or deprecations | Low | Medium | Pin to API v3.0; monitor changelog |

### Cost Consideration (Important)
Basiq's production pricing starts at **$0.39/user/month with a $500/month minimum**. For a personal finance app, this is significant. The alpha phase should help determine whether the value justifies the cost. Alternatives to evaluate post-alpha:
- Direct CDR integration (requires own ACCC accreditation — complex)
- Other providers (Frollo, Yodlee)
- Staying with CSV-only if the manual workflow is acceptable

---

## 13. Testing Strategy

### Sandbox Testing
- Use Basiq's test institution "Hooli" with provided test credentials
- Hooli generates predictable test transactions for validation
- Test: connection creation, consent flow, transaction retrieval, refresh, disconnection
- Test: error scenarios (invalid credentials, expired consent, network failures)

### Integration Testing
- Verify Basiq transactions map correctly to our schema
- Verify categorization pipeline processes Basiq-sourced transactions
- Verify deduplication correctly handles CSV + Basiq overlap
- Verify import records are created with correct metadata

### Manual Testing (Live Account — Phase C)
- Connect a personal bank account
- Verify real transaction data accuracy against bank statement
- Verify refresh retrieves new transactions only (no duplicates)
- Test consent revocation and data cleanup
- Test reconnection after disconnection

---

## 14. Success Metrics (Alpha)

| Metric | Target |
|--------|--------|
| Can complete full connect → sync → view flow in sandbox | Yes |
| Basiq transactions appear correctly in ledger | 100% field accuracy |
| Deduplication catches obvious duplicates (same CSV + Basiq import) | >90% accuracy |
| Categorization pipeline works on Basiq transactions | Same quality as CSV |
| User can disconnect and optionally purge data | Works cleanly |
| Alpha can be disabled with zero impact on existing features | `BASIQ_ENABLED=false` returns to baseline |

---

## 15. Open Questions

1. **Partnership model** — Which Basiq partnership tier (affiliate vs representative) is appropriate for a personal finance tool? Need to contact Basiq sales.
2. **Multi-account in alpha?** — Start with single connection or allow multiple from day one? Recommendation: single connection for alpha simplicity.
3. **Account balance → Assets integration** — Should Basiq account balances auto-update the Assets dashboard? Deferred to post-alpha.
4. **Webhook infrastructure** — Do we need a publicly accessible webhook endpoint, or can we rely on polling in alpha? Recommendation: polling for alpha, webhooks for beta.
5. **Consent duration** — What consent period to request? CDR allows up to 12 months. Recommendation: 12 months for alpha convenience.
6. **Transaction history depth** — How far back does Basiq provide transactions on initial sync? Need to verify with sandbox testing (typically 90 days for CDR, varies for DDC).

---

## Appendix A: Basiq API Quick Reference

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get server token | POST | `/token` (scope=SERVER_ACCESS) |
| Get client token | POST | `/token` (scope=CLIENT_ACCESS, userId) |
| Create user | POST | `/users` |
| Get user | GET | `/users/{userId}` |
| List connections | GET | `/users/{userId}/connections` |
| Refresh connection | POST | `/users/{userId}/connections/{connId}/refresh` |
| Delete connection | DELETE | `/users/{userId}/connections/{connId}` |
| Purge connection data | POST | `/users/{userId}/connections/{connId}/purge` |
| List accounts | GET | `/users/{userId}/accounts` |
| List transactions | GET | `/users/{userId}/transactions` |
| Get job status | GET | `/jobs/{jobId}` |

Base URL: `https://au-api.basiq.io`
API version header: `basiq-version: 3.0`

## Appendix B: Basiq Transaction → Our Transaction Mapping

```typescript
function mapBasiqTransaction(
  basiqTxn: BasiqTransaction,
  connection: BasiqConnection,
  importId: string,
): TransactionInput {
  return {
    workspace_id: connection.workspace_id,
    import_id: importId,
    date: basiqTxn.transactionDate.split('T')[0], // YYYY-MM-DD
    description: basiqTxn.description,
    amount: Math.abs(parseFloat(basiqTxn.amount)).toString(),
    currency: basiqTxn.account?.currency || 'AUD',
    account_name: `${connection.institution_name} ${basiqTxn.account?.name || ''}`.trim(),
    source_account: basiqTxn.account?.accountNo || '',
    source_owner: connection.source_owner, // set at connection time
    category_name: 'Uncategorised',
    direction: basiqTxn.direction, // "debit" or "credit" — direct mapping
    notes: '',
    is_transfer: 'false',
    needs_review: 'true',
  };
}
```

## Appendix C: Related Existing Files

| File | Relevance |
|------|-----------|
| `apps/web/lib/collection-names.ts` | Add `BASIQ_CONNECTIONS` |
| `apps/web/app/api/imports/route.ts` | Reference for import creation + categorization pipeline |
| `apps/web/app/(shell)/import-hub/ImportClient.tsx` | Reference for import UI patterns |
| `apps/web/lib/api-auth.ts` | Auth context for new API routes |
| `apps/web/lib/workspace-guard.ts` | Permission checks for new endpoints |
| `apps/web/app/(shell)/settings/` | Location for Open Banking settings UI |
| `.env.example` | Add `BASIQ_*` variables |
| `docs/ROADMAP.md` | Phase 3 mentions "Provider integrations" — this is it |
