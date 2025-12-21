# Design Direction: Dark Neo

## Intent
Create a modern, sleek PWA for family finance that feels premium and calm while
supporting fast month-end review, categorization, and portfolio tracking.

## Visual System
- Base: charcoal background with soft gradients and subtle grain.
- Surfaces: glass-like panels with low-contrast borders and soft glow.
- Accent: warm amber for primary actions and highlights.
- Data colors: muted greens for assets, warm reds for liabilities, and a
  restrained set of supporting hues for charts.

## Color Palette (starting point)
- Base 900: #0E1116
- Base 800: #141923
- Surface: #1A212E
- Border: #263043
- Text primary: #E8EEF6
- Text secondary: #A9B3C6
- Accent: #F2A43B
- Accent soft: #F6C16B
- Asset: #4CC38A
- Liability: #E26A5A
- Warning: #F29D49

## Typography
- Headings: Bricolage Grotesque
- Body/UI: Manrope
- Use tight letter-spacing for headings and generous line-height for body.

## Core Screens
1) Dashboard: net worth hero, asset/liability cards, spend donut, monthly trend,
   waterfall, and portfolio split.
2) Ledger: rich list rows (merchant, amount, account, category chip, notes) with
   filters and bulk actions.
3) Review Queue: unknown category cards with quick-tagging and transfer pairing.
4) Assets: asset class cards with valuation history and quick update modal.
5) Import Hub: upload, mapping preview, duplicate detection, and reconciliation.

## Components
- Cards: 12-16px radius, low-elevation shadows, soft ambient glow.
- Chips: category pills with color-coded borders and background tint.
- Buttons: primary filled (amber), secondary glass, danger in warm red.
- Charts: minimal gridlines, direct labeling, and consistent color mapping.

## UX Principles
- Month selector anchored globally to scope the entire experience.
- One-click categorization and batch edits for speed.
- Clear transfer pairing UI with confirm/undo actions.
- Every workflow ends with a summary state and an export option.
