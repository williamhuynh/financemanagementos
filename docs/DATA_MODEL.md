# Data Model (Draft)

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

## Relationships
- Workspace has many Accounts, Categories, Assets, and ImportBatches.
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
