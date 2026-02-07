# Data Model

See [APPWRITE_SETUP.md](APPWRITE_SETUP.md) for the actual Appwrite collection definitions and [ROADMAP.md](ROADMAP.md) for current status.

## Entities
- User
- Workspace
- Institution
- Account
- ImportBatch
- RawTransaction
- LedgerTransaction
- Category
- CategoryRule
- TransferMatch
- Asset
- AssetValuation
- MonthlyClose
- MonthlySnapshot

## Relationships
- Workspace has many Accounts, Categories, Assets, and ImportBatches.
- Workspace has many MonthlyCloses and MonthlySnapshots.
- ImportBatch has many RawTransactions.
- RawTransaction maps to a LedgerTransaction (or flagged for review).
- LedgerTransaction may link to a TransferMatch (paired with another txn).
- CategoryRule applies within a Workspace and tags LedgerTransactions.

## Canonical Ledger Fields
- id, workspace_id, account_id
- txn_date, posted_date
- description, merchant
- amount, currency, direction (debit/credit)
- category_id, status (known/unknown/reviewed)
- transfer_match_id, import_batch_id

## Asset Fields
- id, workspace_id, type (cash/property/stocks/fund/super/other)
- name, provider, notes
- current_value, currency

## Valuation Fields
- asset_id, date, value, source (manual/import), notes

## Monthly Close Fields
- workspace_id, month (YYYY-MM), status (open/closed)
- closed_at, closed_by, reopened_at, reopened_by
- notes, snapshot_id

## Monthly Snapshot Fields
- workspace_id, month (YYYY-MM), generated_at
- net_worth_total, assets_total, liabilities_total
- cash_total, investments_total, property_total, other_assets_total
- category_totals (json), account_totals (json), asset_class_totals (json)
