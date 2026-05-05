# VAT Invoice System

Nepal-focused billing, VAT invoicing, inventory, and reporting app for small businesses. The app supports sales invoices, purchase bills, quotations, payments, party ledgers, stock tracking, printable invoices, and compliance-oriented reports.

## Highlights

- Offline email/password authentication in the desktop app
- Multi-business support with role-based access
- Business onboarding with default tax-rate setup
- Sales invoices, purchase bills, and quotations from a shared invoice engine
- VAT-aware line items, BS/AD dates, Nepal timezone handling, and NPR formatting
- Inventory, manual stock adjustments, and automatic stock movement on invoice issue/cancel
- Party balances and ledger views
- Payment in/out flows for both invoice-linked and standalone payments
- Dashboard and CSV-exportable reports
- Print/PDF invoice output and WhatsApp sharing

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- shadcn/ui and Radix UI
- Electron local SQLite storage through the desktop database adapter
- Vitest + Testing Library

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Install and run

```sh
npm install
npm run dev
```

Useful scripts:

```sh
npm run build
npm run build:dev
npm run lint
npm run test
npm run preview
```

## Main Workflow

1. Sign up or sign in.
2. Create a business from `/setup-business`.
3. Add parties and inventory items.
4. Create sales invoices, purchase bills, or quotations.
5. Record payments and monitor balances.
6. Use the dashboard and reports for VAT, stock, cash flow, and party analysis.

## Project Structure

- `src/App.tsx` - route tree and app providers
- `src/contexts/` - auth and active business state
- `src/pages/` - main screens
- `src/hooks/` - local database-backed data and reporting hooks
- `src/components/` - layouts, dialogs, invoice print view, and shared UI
- `src/lib/` - Nepal date, BS calendar, NPR formatting, and amount-in-words utilities
- `src/integrations/local-db/` - typed desktop database adapter
- `electron/db/schema.sql` - local SQLite schema and indexes

## Core Modules

### Authentication and business scoping

- The desktop auth adapter handles email/password login locally.
- Each user can belong to one or more businesses through `business_users`.
- The active business is stored on `profiles.active_business_id`.

### Sales, purchases, and quotations

- Sales invoices, purchase bills, and quotations are all stored in `invoices`.
- The create, edit, and detail screens share the same data model and hook layer.
- Quotations can be converted into invoices from the detail view.

### Inventory and stock

- `items` stores products and services.
- Manual stock adjustments create `stock_movements`.
- The desktop database layer updates stock automatically when an invoice is issued or cancelled.

### Parties and payments

- `parties` represents customers, vendors, or both.
- Payments can be linked to invoices or recorded as standalone transactions.
- Party ledger and balance views are derived from invoices and payments.

### Reporting

Reports are grouped into:

- Sales and Purchase
- Profit and Analysis
- Financial
- Party and Outstanding
- Tax and Compliance
- Inventory

Most reports can be filtered by date and exported as CSV.

## Database Overview

Main tables:

- `profiles`
- `businesses`
- `business_users`
- `tax_rates`
- `item_categories`
- `items`
- `parties`
- `invoices`
- `invoice_items`
- `payments`
- `stock_movements`

Important behavior:

- Row Level Security limits access by business membership.
- Profiles are auto-created on signup.
- Invoice issue/cancel transitions change stock in the database.
- The frontend inserts invoices as `draft` first, then updates status after line items are saved so stock triggers run with complete data.

## Nepal-Specific Behavior

- Bikram Sambat date conversion and BS date picker
- Nepal timezone helpers
- South Asian number formatting for NPR
- Fiscal-year and VAT-period helpers
- Amount-in-words for printable invoices

## Known Gaps

- The automated test suite is still limited, but now includes focused coverage for shortcuts, VAT compliance helpers, BS calendar deadlines, VAT return aggregation, and report calculations.
- The repo has no full local seed/demo-data workflow yet.
- Many reports are computed in the frontend from operational data instead of a dedicated reporting backend.
- CBMS/e-billing integration is not implemented. Businesses that are required to use IRD-approved electronic billing or CBMS must obtain accountant/IRD confirmation before using this app as their statutory billing system.
- VAT return, purchase book, and sales book reports are compliance aids, not a substitute for review against the official IRD return and annex forms before filing.

## Development Notes

- The original README was a Lovable template; this file documents the actual project.
- The UI is built around a Nepal small-business billing flow rather than a generic invoicing demo.
