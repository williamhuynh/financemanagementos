# Appwrite Setup

See [ROADMAP.md](ROADMAP.md) for current status. See [DATA_MODEL.md](DATA_MODEL.md) for entity relationships.

## Environment

- Endpoint: `https://syd.cloud.appwrite.io/v1`
- Project ID: `6947c187003d96c84953`
- Database ID: `6947c201003b6ad09920`

### Required Environment Variables

```env
# Appwrite
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=6947c187003d96c84953
NEXT_PUBLIC_APPWRITE_DATABASE_ID=6947c201003b6ad09920
APPWRITE_API_KEY=<server API key with database write access>

# Auth
SESSION_SECRET=<32+ char random string for iron-session>
INVITATION_SECRET=<32+ char random string for HMAC-SHA256 token hashing>

# AI (optional)
OPENROUTER_API_KEY=<for auto-categorization>
OPENROUTER_MODEL=<model ID, optional>

# App
NEXT_PUBLIC_APP_URL=<base URL for invitation links>
```

## Collections

The database has 14 collections. All data collections include a `workspace_id` field for multi-tenant isolation.

### Core workspace collections
- **workspaces** — name, currency, owner_id
- **workspace_members** — workspace_id, user_id, role (unique index on workspace_id + user_id)
- **workspace_invitations** — workspace_id, email, role, token_hash, expires_at, created_by_id

### Financial data collections
- **accounts** — workspace_id, name, institution, type, currency, last4
- **transactions** — workspace_id, import_id, date, description, amount, currency, account_name, source_account, source_owner, category_name, direction, notes, is_transfer, needs_review
- **categories** — workspace_id, name, group, color
- **category_rules** — workspace_id, pattern, match_type, category_name, priority
- **imports** — workspace_id, source_name, source_account, source_owner, file_name, row_count, status, uploaded_at
- **transfer_pairs** — workspace_id, from_transaction_id, to_transaction_id, matched_at

### Asset collections
- **assets** — workspace_id, name, type, owner, status, currency, disposed_at, deleted_at
- **asset_values** — workspace_id, asset_id, asset_name, asset_type, value, currency, original_value, original_currency, value_aud, fx_rate, fx_source, recorded_at, source, notes, deleted_at

### Reporting collections
- **monthly_closes** — workspace_id, month, status, closed_at, closed_by, reopened_at, reopened_by, notes, snapshot_id
- **monthly_snapshots** — month, generated_at, net_worth_total, assets_total, liabilities_total, income_total, expense_total, category_totals, account_totals, asset_class_totals

### Standalone collections
- **cash_logs** — workspace_id, text, date, month, status, source, isIncome, parsed_items

## Scripted Setup

From `apps/web/`:

```bash
# Create core schema (accounts, transactions, imports, assets, workspaces, etc.)
node scripts/appwrite-schema-mvp.mjs

# Create cash_logs collection
node scripts/appwrite-schema-cash-logs.mjs

# Create database indexes (18 total, including unique constraints)
node scripts/appwrite-create-indexes.mjs

# Seed sample data (optional, for development)
node scripts/appwrite-seed-mvp.mjs
```

## Indexes

18 indexes total:
- **Unique constraints:** `workspace_members(workspace_id, user_id)`, `monthly_closes(workspace_id, month)`
- **Performance indexes:** `workspace_id` on all data collections, composite `transactions(workspace_id, date)`
- **Note:** `workspace_invitations.idx_email` may need re-creation if Appwrite attribute provisioning was pending
