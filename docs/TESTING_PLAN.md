# Testing Plan

## Fixtures
- CSV samples per institution for parsing and normalization.
- Edge-case samples: refunds, reversals, split transactions.

## Unit Tests
- CSV mapping and normalization.
- Categorization rules and confidence scoring.
- Transfer matching heuristics.

## Integration Tests
- Import flow (upload -> preview -> ledger).
- Review queue actions.
- Monthly close summary generation.

## Validation
- Compare dashboard totals to manual checks.
- Verify duplicate detection reduces false positives.
