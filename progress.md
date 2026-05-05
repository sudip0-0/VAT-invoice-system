# App Progress

This file tracks the current implementation state of the VAT Invoice System based on what is present in the repository today. It is a build tracker for contributors, not a roadmap or release log.

**Snapshot Date:** April 25, 2026

## Status Legend

- `Done` = implemented end-to-end in the current repo and clearly usable
- `Partial` = present and functional, but still missing polish, coverage, or important completeness
- `Missing` = not present, placeholder-level, or not meaningfully implemented

## Overall Summary

| Subsystem | Status | Current state | Next focus |
| --- | --- | --- | --- |
| Auth and business onboarding | Partial | Supabase auth flows, protected routes, and business setup are in place | Add coverage and close product gaps around business/user management |
| Dashboard | Done | KPI cards, recent invoices, and low-stock alerts are implemented | Add coverage and validate behavior on larger datasets |
| Invoices and bills | Done | Sales and purchase creation, editing, detail view, payments, cancel, print, and share are implemented | Add tests and resolve schema/UI gaps for unsupported invoice types |
| Quotations | Done | Quotation create/list/detail flow and conversion to invoice are implemented | Add lifecycle coverage and clarify quote-specific edge cases |
| Inventory and stock movements | Done | Item CRUD, manual stock adjustment, automatic stock updates, and movement history are implemented | Add verification around stock-trigger correctness |
| Parties and ledgers | Done | Party CRUD, party detail, ledger view, and CSV export are implemented | Add reconciliation-oriented coverage and edge-case checks |
| Payments | Done | Invoice-linked and standalone payment flows with in/out views are implemented | Decide whether non-completed payment states need first-class UI support |
| Reports | Partial | Broad reporting surface exists with CSV export and some charts | Harden simplified reports and reduce client-side reporting risk |
| Settings and profile | Partial | Business profile, tax rates, user profile, and password change are implemented | Add missing operational settings and business-management UI |
| Infrastructure, docs, and tests | Partial | Vite, TypeScript, Supabase migrations, and basic docs exist | Replace placeholder tests and add operational docs and CI |

## Auth and Business Onboarding

**Status:** `Partial`

Implemented now:

- Email/password sign in, sign up, forgot-password, and reset-password screens exist.
- Protected routing and "require active business" gating are wired into the app shell.
- Business setup creates the business, owner membership, active business, and default tax rates.
- Profile creation is automated in Supabase via signup trigger.

Main gaps or risks:

- Business membership management is backend-capable, but there is no UI for inviting or managing users.
- The context exposes active-business switching, but no switcher is surfaced in the route tree.
- Auth and onboarding flows have no meaningful automated coverage.

Immediate next actions:

- Add smoke coverage for auth, protected routing, and business setup.
- Either add business/user management UI or document the app as effectively single-business in the current UX.

## Dashboard

**Status:** `Done`

Implemented now:

- Dashboard shows today's sales, receivables, payables, low-stock count, recent invoices, and monthly summary metrics.
- Metrics are scoped to the active business and use Nepal-local date helpers.
- Dashboard links conceptually match the rest of the operational data model.

Main gaps or risks:

- Dashboard calculations are derived from client-side fetched data rather than a dedicated summary backend.
- There is no automated coverage for dashboard totals or date-boundary behavior.

Immediate next actions:

- Add a dashboard smoke/integration test around core KPI calculations.
- Validate query behavior with larger invoice, item, and payment volumes.

## Invoices and Bills

**Status:** `Done`

Implemented now:

- Sales invoices and purchase bills can be created, listed, viewed, edited, cancelled, and filtered.
- Line items support quantity, rate, discounts, VAT, BS/AD dates, notes, and balance tracking.
- Invoice detail supports printing/PDF, WhatsApp sharing, payment recording, and cancellation.
- Invoice creation uses a draft-first flow so database stock triggers run after line items exist.
- Global keyboard shortcuts are available on authenticated screens: `Ctrl/Cmd + Shift + S` (new sale), `Ctrl/Cmd + Shift + P` (new purchase), and `Ctrl/Cmd + Shift + R` (open most recent invoice).

Main gaps or risks:

- The schema includes additional invoice types such as returns and delivery challan, but the UI currently exposes sales, purchases, and quotations only.
- Validation is mostly concentrated in the frontend flow, with limited automated regression protection.
- Invoice numbering is business-driven, but there is no explicit conflict or concurrency hardening documented in the UI layer.
- Shortcuts intentionally skip editable fields to avoid accidental navigation, but this still needs routine desktop QA in real data-entry workflows.

Immediate next actions:

- Add coverage for create, edit, cancel, and payment-state transitions.
- Decide whether schema-only invoice types should be implemented in the UI or removed from active scope.

## Quotations

**Status:** `Done`

Implemented now:

- Quotations have dedicated create and list screens.
- Quotation detail uses the shared invoice detail flow.
- Quotations can be converted into invoices from the detail page.

Main gaps or risks:

- Quote lifecycle is lightweight: there is no dedicated acceptance, rejection, or expiry workflow beyond status and due date.
- The feature depends on shared invoice behavior, so regressions in invoice flows can affect quotations.

Immediate next actions:

- Add coverage for quotation creation and quotation-to-invoice conversion.
- Clarify whether quotation-specific lifecycle states are intentionally out of scope.

## Inventory and Stock Movements

**Status:** `Done`

Implemented now:

- Inventory supports products and services, add/edit/delete flows, search, low-stock filtering, and category fetching.
- Product stock can be adjusted manually from the UI.
- Database triggers update stock on invoice issue/cancel and persist stock movement records.
- Stock movement history is viewable and filterable by item.

Main gaps or risks:

- There is no bulk import, stocktake, or reconciliation workflow.
- Stock correctness relies on trigger logic that is not covered by automated tests in this repo.
- The movement reason model is simple and geared toward current invoice/adjustment cases.

Immediate next actions:

- Add integration coverage around issue/cancel stock adjustments and manual stock updates.
- Add a documented verification path for stock accuracy during development and QA.

## Parties and Ledgers

**Status:** `Done`

Implemented now:

- Parties can be created, edited, soft-deleted, searched, and filtered by type.
- Party balances are derived from invoices and standalone payments.
- Party detail shows contact info, financial fields, a derived ledger, and CSV export.
- Standalone payments can also be recorded directly from a party detail screen.

Main gaps or risks:

- Ledger calculations are assembled from operational data in the frontend rather than from a dedicated ledger table.
- There is no explicit reconciliation or statement-closing workflow.
- Edge cases around mixed customer/vendor behavior depend on computed logic rather than a formal accounting model.

Immediate next actions:

- Add regression coverage around party balance and ledger calculations.
- Review mixed-role party behavior against expected accounting rules.

## Payments

**Status:** `Done`

Implemented now:

- Invoice-linked payments can be recorded from invoice detail.
- Standalone payments can be recorded from the payments page and from party detail.
- Payment in/out views, search, and high-level payment summaries are implemented.
- Completed payments update invoice paid amount, balance due, and invoice status.

Main gaps or risks:

- The schema supports `pending`, `failed`, and `refunded`, but the current UI is centered on completed flows.
- Payment classification logic for standalone transactions relies on party type and invoice type inference.
- There is no broader audit or settlement workflow beyond the payments table views.

Immediate next actions:

- Add tests around payment recording and invoice balance updates.
- Decide whether non-completed payment states should remain schema-only or become supported UI flows.

## Reports

**Status:** `Partial`

Implemented now:

- The reports area covers sales/purchase, VAT, profit and loss, bill-wise profit, cash flow, party statements, stock summaries, trial balance, VAT annexes, and more.
- Date presets, custom ranges, CSV export, and some chart visualizations are implemented.
- Party ledger and reporting hooks are already grouped into reusable hook layers.

Main gaps or risks:

- Several reports are explicitly simplified in code comments or UI notes.
- Reporting logic is mostly computed in the frontend from operational queries rather than a dedicated reporting backend.
- The reports surface is broad, but there is no automated coverage for calculation accuracy or performance.

Immediate next actions:

- Prioritize validation for VAT, P&L, trial balance, and balance sheet outputs.
- Break out and test the highest-risk report calculations before expanding report scope further.

## Settings and Profile

**Status:** `Partial`

Implemented now:

- Business profile editing is available.
- Tax-rate listing, adding, deleting, and active toggling are available.
- User profile editing and password change are available.

Main gaps or risks:

- There is no UI for team management, role assignment, or active-business switching.
- Settings are focused on profile and tax basics; broader operational settings are absent.
- Tax-rate management has no dedicated coverage despite affecting invoice behavior.

Immediate next actions:

- Add regression coverage for business profile and tax-rate changes.
- Decide whether business/team administration belongs in settings or elsewhere in the product.

## Infrastructure, Docs, and Tests

**Status:** `Partial`

Implemented now:

- The app uses Vite, TypeScript, React Router, TanStack Query, Tailwind, and Supabase.
- Supabase migrations define the main schema, RLS policies, and stock-related triggers.
- `README.md` documents the app at a high level.

Main gaps or risks:

- Automated coverage remains very limited; the repo now has a basic Vitest example plus focused shortcut tests.
- No CI workflow is present in the repository.
- There is no repo-level deployment runbook, local seed/demo-data flow, or operational troubleshooting guide.

Immediate next actions:

- Expand from basic/shortcut tests to meaningful smoke and integration coverage.
- Add a lightweight CI workflow for build, lint, and test.
- Add contributor-facing docs for setup verification and demo data.

## Current Priorities / Next Steps

- Expand basic test coverage (currently minimal and shortcut-focused) across auth, invoice flows, payments, stock updates, and high-risk reports.
- Decide whether schema-defined but UI-missing features such as additional invoice/payment states are real near-term scope or should be trimmed.
- Harden report accuracy, especially where the code already labels logic as simplified.
- Add contributor/operations docs for CI, setup validation, and repeatable demo or seed data.
- Close the gap between backend business membership support and the currently exposed single-business UX.

## Maintenance Note

Update this file whenever a major route, subsystem status, or implementation boundary changes. Do not use it as a dated change log; keep it as a current snapshot of repo reality.
