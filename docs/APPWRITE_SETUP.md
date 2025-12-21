# Appwrite Setup (MVP)

Use this guide to create the MVP collections that map to the current UI data
layer in `apps/web/lib/data.ts`. Keep naming consistent to avoid extra mapping.

## Environment
- Endpoint: `https://syd.cloud.appwrite.io/v1`
- Project ID: `6947c187003d96c84953`
- Database ID: `6947c201003b6ad09920`

Optional script env for automated setup (uses `node-appwrite`):
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_API_KEY` (server API key with database write access)

## Collections
Create these collections with the listed attributes.

### dashboard_cards
- `title` (string, required)
- `value` (string, required)
- `sub` (string, required)
- `tone` (string, optional)

### ledger_rows
- `title` (string, required)
- `sub` (string, required)
- `category` (string, required)
- `amount` (string, required)
- `tone` (string, required)
- `chip` (string, optional)
- `highlight` (boolean, optional)

### review_items
- `title` (string, required)
- `sub` (string, required)
- `amount` (string, required)
- `actions` (string array, required)

### asset_cards
- `title` (string, required)
- `value` (string, required)
- `sub` (string, required)

### report_stats
- `title` (string, required)
- `value` (string, required)
- `sub` (string, required)

## Notes
- The UI expects human-readable strings for `value` and `amount` (for example,
  `$72,279`). When we move to real ingestion, we can store numeric values and
  format them on the client.
- No indexes are required for the MVP; add them once filtering and sorting are
  wired to the backend.

## Scripted Setup
Run the following from `apps/web` to create the MVP collections:
```bash
node scripts/appwrite-mvp-setup.mjs
```

Create the core MVP schema (accounts, transactions, imports, assets, rules):
```bash
node scripts/appwrite-schema-mvp.mjs
```

Seed sample data into the collections:
```bash
node scripts/appwrite-seed-mvp.mjs
```
