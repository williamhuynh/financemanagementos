# Ingestion Pipeline

## Steps
1) Upload CSV/PDF to storage and create ImportBatch.
2) Parse rows into RawTransaction (store source fields and file reference).
3) Normalize fields into LedgerTransaction candidates.
4) Detect duplicates (hash by date+amount+description+account).
5) Run categorization rules and assign confidence.
6) Identify transfers (same amount opposite direction within date window).
7) Route unknowns to Review Queue.

## CSV Mapping
- Canonical fields: date, description, amount, currency, account.
- Support user column mapping per institution.
- Persist mappings for reuse.

## PDF Constraints
- Use OCR if needed; flag low-confidence parse results.
- Require manual confirmation for ambiguous fields.

## Duplicate Detection
- Use fuzzy match on description + amount + date.
- Show duplicates with accept/merge/dismiss options.

## Transfer Matching
- Pair debits/credits of same amount across owned accounts.
- Allow manual override and unpair.
