# UX Specification (Draft)

## Global
- Month selector scopes Dashboard, Ledger, and Monthly Close.
- Month status indicator (Open/Closed) with close timestamp and owner.
- Global search for merchant, category, account, and notes.
- Review badge with count of unresolved items.

## Dashboard
- Net worth hero with delta and last sync timestamp.
- Cards for Cash, Investments, Property, Liabilities.
- Charts: spend by category, portfolio split, monthly trend, waterfall.

## Ledger
- Compact list rows with amount emphasis and category chips.
- Inline edits for category and notes.
- Bulk actions: categorize, mark transfer, exclude, export.

## Review Queue
- Tabs: Unknowns, Transfers, Duplicates.
- Quick actions: accept suggestion, change category, split, match transfer.

## Assets
- Card grid by asset class with current value and change.
- Detail view with valuation timeline and source notes.

## Import Hub
- Stepper UI with mapping, preview, and duplicate checks.
- Post-import summary and link to Review Queue.

## Monthly Close (Soft)
- Close checklist: imports complete, review queue empty/acknowledged, assets updated.
- "Close Month" action stores a snapshot of key totals and marks the month Closed.
- Reopen action allowed with warning; reopening flags the month as Open and notes changes.
