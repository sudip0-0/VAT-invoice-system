# VAT Invoice System

Nepal-focused billing, VAT invoicing, inventory, and reporting app for small businesses. The app supports sales invoices, purchase bills, quotations, payments, party ledgers, stock tracking, printable invoices, and compliance-oriented reports.

## Highlights

- Offline email/password authentication in the desktop app
- Multi-business support with session + business-membership scoping (IPC data access is limited to businesses the signed-in user belongs to)
- Business onboarding with default tax-rate setup
- Sales invoices, purchase bills, quotations, and issued-invoice credit/debit correction notes
- VAT-aware line items, BS/AD dates, Nepal timezone handling, and NPR formatting
- Inventory, manual stock adjustments, and automatic stock movement on invoice issue/cancel
- Party balances and ledger views
- Payment in/out flows for both invoice-linked and standalone payments
- Dashboard and CSV-exportable reports
- Print/PDF invoice output and WhatsApp sharing
- Tamper-evident invoice audit events for issue, print/PDF, cancel, payment, correction note, and share/export actions

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
5. For issued invoice corrections, open the original invoice and create a credit/debit note instead of editing the issued invoice.
6. Record payments and monitor balances.
7. Use the dashboard and reports for VAT, stock, cash flow, party analysis, and Schedule 8/9/10 review aids.

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
- Electron data IPC requires an active session and enforces membership scoping (not a fine-grained RBAC matrix).
- Quality targets and wave gates live in `SCORECARD.md`.

### Sales, purchases, quotations, and correction notes

- Sales invoices, purchase bills, quotations, credit notes, and debit notes are all stored in `invoices`.
- The create, edit, and detail screens share the same data model and hook layer.
- Quotations can be converted into invoices from the detail view.
- Credit/debit notes are created from issued invoice detail screens, store the original invoice reference and reason, use separate fiscal-year sequences, and do not rewrite the original invoice.

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

Compliance-oriented reports include VAT Return (Schedule 10 review aid), Purchase/Sales Books (Schedule 8/9 review aid), CN/DN register, and fiscal sequence review helpers. Fields that the app cannot derive reliably are marked for accountant review.

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
- `invoice_events`
- `document_sequences`
- `stock_movements`

Important behavior:

- Row Level Security limits access by business membership.
- Profiles are auto-created on signup.
- Invoice issue/cancel transitions change stock in the database.
- The frontend inserts invoices as `draft` first, then updates status after line items are saved so stock triggers run with complete data.
- Invoice/document events carry a SHA-256 hash chain for tamper-evidence. Legacy imported/restored rows without hashes should be reviewed before audit reliance.

## Nepal-Specific Behavior

- Bikram Sambat date conversion and BS date picker
- Nepal timezone helpers
- South Asian number formatting for NPR
- Fiscal-year and VAT-period helpers
- Amount-in-words for printable invoices
- NPR rounding policy: compliance calculations round to nearest paisa (2 decimal places); helper tests reconcile totals using integer paisa.

## Known Gaps

- The automated test suite is still limited, but now includes focused coverage for shortcuts, VAT compliance helpers, BS calendar deadlines, VAT return aggregation/adjustments, correction remaining qty, audit hash chains, fiscal sequence review, membership create, encrypted backup crypto, monetary reconciliation, and report calculations.
- The repo has no full local seed/demo-data workflow yet beyond Settings → Create Demo Data.
- Many reports are computed in the frontend from operational data instead of a dedicated reporting backend.
- CBMS/e-billing integration is not implemented. Businesses that are required to use IRD-approved electronic billing or CBMS must obtain accountant/IRD confirmation before using this app as their statutory billing system.
- VAT return, purchase book, and sales book reports are compliance aids (including manual Schedule 10 adjustments), not a substitute for review against the official IRD return and annex forms before filing.

## Operator Checklist

1. Confirm business PAN/VAT registration before issuing VAT invoices.
2. Keep drafts editable, but do not directly edit issued VAT invoices.
3. Create credit/debit notes from the original issued invoice for returns or corrections, with a clear reason.
4. Review monthly VAT Return, Purchase/Sales Books, CN/DN register, and sequence review before filing.
5. Verify invoice audit hash chains after backup restore/import before relying on records.
6. Treat CBMS/e-billing as not configured and not implemented until IRD/accountant approval and real integration exist.

## Development Notes

- The original README was a Lovable template; this file documents the actual project.
- The UI is built around a Nepal small-business billing flow rather than a generic invoicing demo.
