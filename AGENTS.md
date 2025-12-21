# Repository Guidelines

## Project Overview
This project is a family finance and wealth management PWA. The goal is to
ingest monthly CSV/PDF statements from multiple institutions, normalize them
into a single ledger, support categorization and transfer detection, and track
asset values over time. Design and UX should favor fast month-end review and
clear visibility into net worth, spending, and asset allocation.
When imports arrive without categories, the server can auto-categorize via
OpenRouter and flag anything still unknown for review.

## Design Direction (Dark Neo)
- Visual style: dark charcoal base, soft gradients, glass-like cards, warm
  amber accents, and muted greens for assets.
- Typography: Bricolage Grotesque for headings, Manrope for body/UI.
- Experience: modern, sleek, and data-dense where needed, but not spreadsheet-
  bound.
- See `docs/DESIGN.md` for the evolving UI reference.
- Wireframe layout notes live in `docs/WIREFRAMES.md`.
- Planning references: `docs/REQUIREMENTS.md`, `docs/INFORMATION_ARCHITECTURE.md`,
  `docs/DATA_MODEL.md`, `docs/INGESTION_PIPELINE.md`, `docs/ARCHITECTURE.md`,
  `docs/UX_SPEC.md`, `docs/TESTING_PLAN.md`, `docs/ROADMAP.md`,
  `docs/APPWRITE_SETUP.md`.

## Project Structure & Module Organization
This repository uses a lightweight monorepo layout:
- `apps/web/` for the Next.js PWA shell and routes
- `packages/ui/` for the shared UI component library consumed by the web app
- `src/` for shared application code (when introduced)
- `tests/` for automated tests
- `assets/` for static files (images, fixtures, sample data)
- `docs/` for product/design notes and architecture references
- `screenshots/` for design inspirations and references
Document any deviations (for example, new packages) in the README so contributors can navigate quickly.

## Build, Test, and Development Commands
The Next.js app lives in `apps/web/`. Use these commands from that directory:
- `npm run dev` to start the local development server
- `npm run build` for production builds
- `npm run start` to serve the production build
- Appwrite helpers: `node scripts/appwrite-mvp-setup.mjs`, `node scripts/appwrite-schema-mvp.mjs`, `node scripts/appwrite-seed-mvp.mjs`

## Coding Style & Naming Conventions
Until tooling is added, follow the defaults for the chosen language and keep formatting consistent within each file:
- Indentation: 2 or 4 spaces, no tabs
- File naming: `kebab-case` or `snake_case`, choose one and stick to it
- Class/Type names: `PascalCase`; functions and variables: `camelCase`
If you add a formatter or linter (for example, `prettier`, `eslint`, or `ruff`), run it before committing and note the exact commands.

## Testing Guidelines
No testing framework is configured. When tests are introduced:
- Name tests with the pattern `*.test.*` or `test_*.py` and group them under `tests/`.
- Keep coverage expectations explicit (for example, minimum 80% line coverage).
- Document the exact test command and any required environment variables.

## Commit & Pull Request Guidelines
There is no commit history yet, so no existing convention is available. Use a clear, conventional format such as:
- `feat: add budget import flow`
- `fix: handle null account balances`
For pull requests, include a short summary, list of changes, and testing steps. Add screenshots or sample outputs when UI or reports change.

## Security & Configuration Tips
Store secrets in environment variables or local config files excluded from version control (for example, `.env`). Never commit API keys or customer data. Document required configuration keys in the README.
- Appwrite expects `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, and `NEXT_PUBLIC_APPWRITE_DATABASE_ID` for local wiring.
- OpenRouter uses `OPENROUTER_API_KEY` and optional `OPENROUTER_MODEL` for
  server-side auto-categorization.
