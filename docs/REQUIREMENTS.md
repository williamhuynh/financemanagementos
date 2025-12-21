# Requirements

## Goals
- Consolidate monthly CSV/PDF statements into a single ledger.
- Categorize transactions with review for unknowns.
- Detect and exclude transfers between owned accounts.
- Track asset values and net worth over time.
- Support two users in a shared workspace.

## MVP Scope (In)
- CSV imports with column mapping and preview.
- Manual category assignment + rule-based auto-categorization.
- Transfer matching (same amount/opposite direction/date window).
- Dashboard with spend, net worth, and monthly trends.
- Asset classes with manual valuation updates.
- Appwrite auth, storage, and database.

## Out of Scope (Initial)
- Direct bank sync (Open Banking/Plaid).
- Automated portfolio pricing from brokers.
- Tax reporting and compliance exports.
- Multi-currency conversion beyond display-only.

## Success Criteria
- Monthly close completed in under 15 minutes after import.
- Unknown category rate under 10% after 3 months of use.
- Net worth and category summaries match manual checks within 1% variance.
