# Wireframes (Text)

## Global Shell
Top bar: month selector | global search | import button | user switcher
Left rail: Dashboard, Ledger, Review, Assets, Monthly Close, Settings

## Dashboard
Hero: Net Worth + delta + last sync
Row 1: Asset cards (Cash, Investments, Property) | Liability card
Row 2: Spend by Category (donut) | Portfolio Split (donut)
Row 3: Monthly Trend (line) | Waterfall (income -> expenses -> net)
Footer: Recent imports + alerts (duplicates, unknown categories)

## Ledger
Header: filters (date, account, category, amount range) + bulk actions
List rows:
- Merchant / Description
- Amount (color-coded)
- Category chip + quick edit
- Account + tags
- Status (matched transfer, needs review)
Right drawer (on select): full details, notes, split, transfer match

## Review Queue
Tabs: Unknown Category | Potential Transfers | Duplicates
Card stack:
- Summary (merchant, amount, date, account)
- Suggested category + confidence
- Quick actions (accept, change, split, transfer)
Batch bar: apply category, merge, dismiss

## Assets
Grid: Asset class cards (Cash, Property, Stocks, Funds, Super)
Each card: current value, MoM change, last updated, update button
Detail view: valuation timeline + sources + notes

## Import Hub
Step 1: upload CSV/PDF (drag/drop)
Step 2: column mapping preview (source -> canonical)
Step 3: duplicate detection summary
Step 4: review queue link + import complete

## Monthly Close
Monthly close summary: income, expenses, transfers excluded, net cash flow
Category breakdown table + chart
Export buttons (CSV/PDF)
