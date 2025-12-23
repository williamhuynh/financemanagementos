# Architecture (Draft)

## Frontend
- PWA shell with offline-friendly caching for recent views.
- Pages: Dashboard, Ledger, Review Queue, Assets, Import Hub, Reports.
- Shared component library for cards, chips, charts, and list rows.

## Backend (Appwrite)
- Auth: email/password + magic link.
- Database: Appwrite database collections per workspace.
- Storage: statement uploads and asset documents.
- Functions: ingestion normalization, OCR hooks, and batch processing.

## Background Jobs
- Import parsing and normalization.
- Categorization and transfer matching.
- Monthly snapshot generation for reports (on close, with optional re-run on reopen).

## Observability
- Import logs per batch.
- Metrics: unknown category rate, transfer match rate, duplicate rate.
