# VAT Compliance Checklist and Gap Audit

Compliance audit artifact for the desktop VAT invoice system. Phase 1 recorded observed compliance coverage and gaps before code changes. Phase 2 has begun with small surgical fixes noted below.

## Legal Baseline Used

- Nepal IRD Value Added Tax Rules, 2053 (1997), especially Rule 17 and Schedule 5B for tax invoice format.
- VAT Rules Schedule 6 for abbreviated tax invoice, Schedule 8 and 9 for purchase/sales books, and Schedule 10 for VAT return.
- IRD PAN guidance that PAN must be used in bills, invoices, books, tax documents, and related records.

Primary source:
- https://www.ird.gov.np/public/pdf/1825021765.pdf
- https://ird.gov.np/faq/?gid=97

## Prompt-to-Artifact Completion Audit

| Objective requirement | Artifact / evidence | Status |
| --- | --- | --- |
| Audit before code changes against official IRD sources | Legal baseline and Phase 1 findings in this file; official IRD VAT Rules/FAQ sources listed above | Done |
| Inspect README and progress docs | `README.md`, `progress.md` updated to current implementation boundaries | Done |
| Inspect schema and desktop DB adapter | `electron/db/schema.sql`, `electron/db/index.cjs` changed for sequence, audit, cancellation, print, HSN, and tax-type fields | Done |
| Inspect local DB types | `src/integrations/local-db/types.ts` updated for new fields/tables | Done |
| Inspect business setup/settings | PAN requirement for VAT-registered businesses implemented in setup/settings | Done |
| Inspect invoice, purchase, payment, inventory, report pages/hooks | Invoice/purchase/quotation/report/payment-related hooks and pages reviewed during Phase 1; selected fixes implemented | Done |
| Inspect printable invoice | `src/components/invoices/PrintInvoice.tsx` updated for buyer PAN snapshot, HSN snapshot, statutory VAT label, print-count flow, and exempt line summary | Done |
| Inspect Nepal date/report utilities | `src/lib/bs-calendar.ts`, VAT return/report helpers updated and tested | Done |
| Add/update tests where feasible | `src/test/vat-compliance.test.ts`, `src/test/bs-calendar.test.ts`, `src/test/vat-return.test.ts` | Done |
| Run `npm test` | Passed: 7 test files, 26 tests | Done |
| Run `npm run lint` | Passed with 12 pre-existing warnings | Done |
| Run `npx tsc --noEmit` | Passed | Done |
| Run `npm run build` | Passed with existing Vite/bundle warnings | Done |
| Credit/debit note workflows | `CorrectionNotesPage.tsx`, `InvoiceDetailPage.tsx`, `PrintInvoice.tsx`, schema fields, separate CN/DN sequences, VAT return tests, partial line picker | Done — accountant review still required for statutory use |
| Tamper-evident audit trail | `invoice_events.previous_hash/event_hash`, `audit-chain.ts`, invoice hash-chain verification UI, restore warning | Done for local tamper-evidence; not legal signing |
| Monetary precision | NPR paisa policy/helpers in `vat-compliance.ts`; create/edit/quotation/purchase totals reconcile via helper | Done; persisted storage migration remains future work |
| CBMS/e-billing boundary | Settings CBMS tab, README/compliance warnings | Done; integration not implemented |
| Mark uncertain rules for accountant/IRD confirmation | See compliance gap table and "Still partial or not implemented" sections | Done |

## Compliance Gap Audit Table

| Requirement | Source | Current implementation | Gap | Fix | Affected files | Verification | Accountant/IRD confirmation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VAT invoices only by VAT-registered businesses | VAT Act/Rules registration and tax-invoice requirements | VAT invoice issue/create/update blocked unless active business is VAT registered; setup/settings require PAN when VAT registered | Historical records may predate validation | Enforced validation and docs | `src/lib/vat-compliance.ts`, invoice pages, business setup/settings | `vat-compliance.test.ts`; app validation gates | Confirm edge cases for deregistration/history |
| 13% VAT unless explicitly zero-rated/exempt/non-taxable | VAT Act/Rules standard VAT treatment and schedules | Line-level `tax_type` drives statutory 13% VAT or zero VAT classification | Correct classification is an accounting/legal decision | Added `invoice_items.tax_type`, UI selectors, statutory helper | schema, DB adapter, types, invoice/purchase/quotation/edit pages | `vat-compliance.test.ts`, typecheck/build | Confirm supply classifications and any zero-rated evidence requirements |
| Discounts reduce taxable value | VAT Rules tax invoice values and VAT calculation practice | Line helper calculates discount before taxable/VAT amount; document totals reconcile through integer-paisa helpers | Money still persisted as `REAL` until reviewed migration | Centralized NPR paisa rounding/reconciliation helpers | `src/lib/vat-compliance.ts`, invoice flows | `vat-compliance.test.ts`, `compliance-hardening.test.ts` | Confirm rounding policy for paisa/rupee presentation |
| Printed invoice includes Schedule 5 style fields | VAT Rules Rule 17 and Schedule 5B | Seller/buyer details, PAN, date, invoice no, line details, HSN, quantity, unit, rate, discount, taxable, VAT, total, words, signature area | Payment mode is derived, not explicitly stored; electronic signature/hash absent | Improved stored buyer PAN and HSN snapshots; print count recorded | `PrintInvoice.tsx`, invoice schema/hook | Build/typecheck; manual print review still required | Confirm exact print format and any business-specific fields |
| Unique/sequential invoice numbers | VAT Rules invoice/book record expectations | New documents use fiscal-year `document_sequences`; invoice-number and fiscal serial unique indexes added for sales, purchases, quotations, credit notes, and debit notes | Historical backfill and concurrency stress testing remain | Added sequence table, document serial, fiscal year, sequence review helper | schema, DB adapter, `useInvoices.ts`, `fiscal-sequence-review.ts` | tests/build; DB unique indexes | Confirm fiscal-year reset policy and legacy backfill |
| Issued VAT invoices not silently edited | Record preservation/correction expectations | Issued/partially-paid/paid VAT invoices blocked from direct edit; credit/debit notes are separate documents referencing original invoice | Partial amount/line correction entry remains basic and requires review | Added direct-edit guard, correction-note workflow, and audit event logging | `useInvoices.ts`, invoice detail/list/print pages | `vat-compliance.test.ts`, `compliance-hardening.test.ts`; typecheck/build | Confirm correction workflow design with accountant/IRD |
| Buyer PAN on VAT sales invoice | IRD PAN guidance and tax invoice buyer details | Buyer PAN required to issue VAT sales invoices; drafts can remain incomplete | Abbreviated/cash-sale exceptions not implemented | Added issue guard | invoice create/edit pages, `vat-compliance.ts` | `vat-compliance.test.ts` | Confirm exceptions and threshold behavior |
| Print/export records | Auditability expectations and electronic billing risk controls | Print count, last printed timestamp, cancellation reason, cancellation timestamp, invoice events, and per-invoice SHA-256 hash chain added | Not an IRD-approved digital signature or e-billing control | Added fields, event log, hash verification UI | schema, DB adapter, `useInvoices.ts`, `audit-chain.ts`, invoice detail | `compliance-hardening.test.ts`; build/typecheck | Confirm if IRD-approved billing requires more controls |
| VAT periods and 25-day deadline | VAT Rules return timing and BS monthly periods | VAT period stored and VAT summary shows/export due date as next BS month 25th | Full Schedule 10 filing workflow incomplete | Added deadline helper and report display/export | `bs-calendar.ts`, `ReportsPage.tsx` | `bs-calendar.test.ts` | Confirm filing calendar for special periods/holidays |
| VAT reports/books | VAT Rules Schedule 8/9/10 | VAT annex exports include fiscal year, period, taxpayer PAN, document serial; VAT return includes document counts, CN/DN impact, and manual accountant adjustments (imports/capitalized/voucher/refund) | Still not an official filing substitute | Added annex metadata, adjustment table, and tested VAT return/CN/DN aggregation | report hooks/pages, `vat-return.ts`, `vat_return_adjustments` | `vat-return.test.ts`, `vat-return-adjustments.test.ts`, `compliance-hardening.test.ts`, build/typecheck | Accountant review required before filing |
| Cancellations/returns/corrections | VAT correction expectations | Cancellation reason/timestamp and audit log present; CN/DN route, detail action, print title/reference, original invoice ID/number, reason, and separate sequences added; partial-line quantity picker with remaining-qty caps | Amount-only (non-qty) corrections may still need accountant workflow outside the app | Implemented correction note list/detail/create-from-original with line selection | schema, `useInvoices.ts`, `correction-notes.ts`, `CorrectionNotesPage.tsx`, `PrintInvoice.tsx` | `correction-notes.test.ts`, `compliance-hardening.test.ts`; build/typecheck | Required before using corrections statutorily |
| CBMS/electronic billing | IRD electronic invoice/CBMS pages | README, compliance docs, and Settings CBMS tab clearly state CBMS/e-billing not configured or implemented | No approval/submission metadata or API | Boundary/status UI and documentation only | `SettingsPage.tsx`, `README.md`, `compliance.md` | Doc/UI review; build/typecheck | Must obtain IRD/accountant confirmation before statutory use where required |

## Prioritized Implementation Plan

1. Accountant-review partial CN/DN: quantity-based line picker is available; confirm office policy for rate-only / amount-only adjustments.
2. Schedule 10 review aid now stores manual import/capitalized/voucher/refund adjustments; still not an IRD filing submission.
3. Strengthen audit controls further: device/user attribution, signed exports, import event logging, and independent backup verification.
4. Migrate persisted monetary columns from `REAL` to integer paisa only after a reviewed data migration plan.
5. Backfill existing invoices: accountant-reviewed fiscal year, document serial, HSN/tax classification, and cancellation/print metadata where possible.
6. Expand tests: issue/cancel stock movements for paid/partial states, invoice lifecycle, payment balance updates, VAT reports, and print data snapshots.
7. CBMS/e-billing only after confirmation: add IRD-approved billing metadata/integration if the business falls under mandatory electronic billing.

## Operator Checklist for Nepali VAT Businesses

- Confirm the business PAN/VAT number and VAT registration status before issuing VAT invoices.
- Use VAT 13% for ordinary taxable supplies; choose zero-rated/exempt/non-taxable only with accountant-supported evidence.
- Enter buyer PAN/VAT number before issuing VAT sales invoices unless an accountant confirms a valid exception.
- Do not directly edit issued VAT invoices; cancel with a reason or create a credit/debit note from the original invoice detail page.
- Review invoice sequence continuity by fiscal year before filing or audit; legacy documents should not be renumbered automatically.
- Verify invoice audit hash chains after backup restore/import before relying on records.
- Export VAT summaries/annexes monthly and file by the 25th day of the following BS month after accountant review.
- Do not treat this app as CBMS/e-billing compliant until IRD approval/integration is explicitly implemented.

## Completion Checklist

- [x] Inspect invoice storage schema: `electron/db/schema.sql`.
- [x] Inspect local database mutation behavior: `electron/db/index.cjs`.
- [x] Inspect invoice creation flow: `src/pages/InvoiceCreatePage.tsx`.
- [x] Inspect invoice edit flow: `src/pages/InvoiceEditPage.tsx`.
- [x] Inspect invoice numbering and mutations: `src/hooks/useInvoices.ts`.
- [x] Inspect invoice detail, print, PDF, cancel, and share flow: `src/pages/InvoiceDetailPage.tsx`.
- [x] Inspect printable invoice template: `src/components/invoices/PrintInvoice.tsx`.
- [x] Inspect VAT reports and annexes: `src/hooks/useReports.ts`, `src/hooks/useReportsExtra.ts`, `src/hooks/useReportsExtra2.ts`, `src/pages/ReportsPage.tsx`.
- [x] Inspect business, party, and item setup fields: `src/pages/BusinessSetupPage.tsx`, `src/pages/SettingsPage.tsx`, `src/components/parties/PartyDialog.tsx`, `src/components/inventory/ItemDialog.tsx`.
- [x] Produce gaps only; no code changes in Phase 1.

## Tax Invoice Field Checklist

| Requirement | Current Coverage | Evidence | Gap |
| --- | --- | --- | --- |
| Seller name | Present | `PrintInvoice.tsx` header | None observed |
| Seller address | Present | `PrintInvoice.tsx` header | None observed |
| Seller phone | Present | `PrintInvoice.tsx` header | None observed |
| Seller PAN/VAT number | Required for VAT-registered businesses | `businesses.pan_number`, setup/settings validation, print header | Existing historical business records may still need review |
| Buyer name | Present if party/cash customer has value | invoice buyer fields, print customer details | Cash customer may be generic or incomplete |
| Buyer address | Present if stored | buyer fields, party fields | Optional |
| Buyer PAN | Required when issuing VAT sales invoices | `buyer_pan`, `parties.pan_number`, VAT issue guard | Drafts can still be incomplete; abbreviated/cash exceptions need confirmation |
| Invoice number | Present with fiscal-year document serial for new documents | `invoice_number`, `document_serial`, `document_sequences` | Historical documents may need backfill/review |
| Date of transaction / issue | Present in AD and BS | `issued_date_ad`, `issued_date_bs` | None observed |
| Payment mode | Partially present | print derives Cash/Credit from balance due | Does not preserve selected payment mode as invoice data |
| Item details | Present | invoice items table and print | Description is limited; HSN/HSCode is now snapshotted when an inventory item is selected |
| Quantity | Present | invoice items | None observed |
| Unit | Present | invoice items | None observed |
| Rate | Present | invoice items | None observed |
| Discount | Present | invoice and item discount fields | None observed |
| Taxable amount | Present | invoice and print summary | Floating-point rounding policy not explicit |
| VAT amount/rate | Present for VAT invoices | VAT 13% line and `invoice_items.tax_type` | Zero-rated/exempt/non-taxable classifications still need operator/accountant correctness |
| Grand total | Present | invoice and print summary | Floating-point rounding policy not explicit |
| Amount in words | Present | `amountInWords` in print/detail | None observed |
| Seller signature | Present as signature area | print footer | No digital authorization/audit signature |

## High-Priority Gaps

### 1. Issued VAT invoices remain editable

Issued invoices can be edited unless they are cancelled or paid. The edit page blocks only cancelled invoices, and the detail page allows edits for statuses other than cancelled or paid.

Evidence:
- `src/pages/InvoiceEditPage.tsx`
- `src/pages/InvoiceDetailPage.tsx`

Risk:
- Issued tax invoices should be preserved. Corrections should generally be done through credit/debit notes rather than silent mutation.

Recommended remediation:
- Lock issued, partially paid, and paid tax invoices from direct edits.
- Allow draft edits before issuance.
- Add correction workflow through credit notes/debit notes with original invoice references.

Phase 2 status:
- Direct edits are now blocked for issued/partially-paid/paid VAT invoices in the UI and mutation hook.
- Correction workflow now creates separate credit/debit notes from the issued invoice detail screen, stores original invoice ID/number and reason, uses separate fiscal-year sequences, and prints the note as a note rather than rewriting the issued invoice.

### 2. Invoice numbering sequence is shared across sales, purchases, and quotations

`reserveNextInvoiceNumber` reserves a single `businesses.next_invoice_num` and `formatDocumentNumber` uses it for sales, purchases, and quotations.

Evidence:
- `src/hooks/useInvoices.ts`
- `electron/db/schema.sql`

Risk:
- VAT sales invoice numbering can have gaps caused by purchases or quotations.
- Purchase bills and quotations should not consume the statutory sales tax invoice sequence.

Recommended remediation:
- Separate counters by document type and fiscal year, at minimum sales tax invoice sequence separate from quotation and purchase sequences.
- Consider storing immutable sequence metadata such as fiscal year, document type, and numeric serial.

Phase 2 Batch 2 status:
- Implemented document-type counters for sales invoices, purchase bills, quotations, credit notes, and debit notes.
- Existing `next_invoice_num` remains for backward compatibility and mirrors the sales counter.
- Fiscal-year-specific `document_sequences` and invoice `fiscal_year` / `document_serial` metadata are now implemented for newly created documents.
- Added fiscal sequence review helper to flag gaps, duplicates, missing fiscal year/serial, and legacy review records without renumbering historical records automatically.

### 3. Printed invoice does not use stored HSN/HSCode

Items have an `hsn_code` field, and the item dialog captures HSN Code. The invoice item snapshot does not store it, and the printable invoice hardcodes the HSCode column as `-`.

Evidence:
- `electron/db/schema.sql`
- `src/components/inventory/ItemDialog.tsx`
- `src/components/invoices/PrintInvoice.tsx`

Risk:
- Goods classification data may be missing from printed invoices and historical invoice snapshots.

Recommended remediation:
- Snapshot item code/HSN at invoice issue time.
- Print the stored code instead of looking up live item data or hardcoding `-`.

Phase 2 Batch 1 status:
- Implemented for `hsn_code`; item code remains a future enhancement if it is required on the operator's invoice format.

### 4. Credit/debit note support is basic but now first-class

Reports use `sale_return` and `purchase_return`, and the app now exposes credit/debit notes from issued invoice detail pages. The schema stores original invoice reference, reason, adjustment type, and separate note sequence metadata.

Evidence:
- `src/hooks/useReportsExtra.ts`
- `src/pages/InvoiceCreatePage.tsx`
- `electron/db/schema.sql`

Risk:
- The workflow clones the original invoice lines/totals into a separate correction note. Partial returns, partial value corrections, and accountant-specific adjustment categories still need review before statutory reliance.

Recommended remediation:
- Add partial-line/partial-amount correction editing after accountant review.
- Confirm printed note wording and field requirements with the taxpayer's accountant.

### 5. Electronic billing is absent; audit controls are tamper-evident but not IRD e-billing

The app stores data locally in SQLite and supports backup/restore. Invoice events now include a per-document SHA-256 hash chain for draft/create, issue, print/PDF, cancel, payment, correction-note, and share/export events. There is still no IRD-approved electronic billing integration, digital signature certificate, or CBMS submission metadata.

Evidence:
- `electron/db/schema.sql`
- `electron/db/index.cjs`
- `src/pages/SettingsPage.tsx`

Risk:
- Auditability is improved but remains local tamper-evidence, not legal certification.
- May not satisfy stricter e-billing requirements for taxpayers required to use approved electronic billing.

Recommended remediation:
- Add signed export/backup verification and restore/import event logging beyond the current restore warning.
- Store richer previous/next value snapshots where needed.
- If targeting IRD e-billing, add approval/configuration and submission metadata only after confirming exact integration obligations.

## Medium-Priority Gaps

### 6. Buyer PAN is optional for VAT invoices

Party PAN and cash customer PAN are optional, and the print template falls back to `-`.

Evidence:
- `src/components/parties/PartyDialog.tsx`
- `src/pages/InvoiceCreatePage.tsx`
- `src/components/invoices/PrintInvoice.tsx`

Recommended remediation:
- Require buyer PAN when issuing VAT invoices to VAT-registered buyers and for transactions where PAN is legally required.
- Add validation without blocking legitimate small cash/abbreviated cases if those are supported.

### 7. VAT-registered businesses can issue non-VAT invoices without supply classification

If the business is VAT registered, users can uncheck `VAT Invoice (13%)`. This may be valid for exempt or zero-rated supplies, but the app does not preserve enough line-level supply classification to distinguish taxable, exempt, zero-rated, and non-taxable treatment cleanly.

Evidence:
- `src/pages/InvoiceCreatePage.tsx`
- `src/pages/InvoiceEditPage.tsx`
- `electron/db/schema.sql`

Recommended remediation:
- Replace a single invoice-level VAT toggle with line-level tax classification where needed.
- Store tax type and rate per line, not only computed VAT amount.

Phase 2 status:
- Implemented `invoice_items.tax_type` with VAT 13%, zero-rated, exempt, and non-taxable options on sales, purchases, quotations, and invoice edits.
- VAT annex and print summaries now separate exempt/non-taxable line totals from taxable supplies for new and migrated lines.
- Operator/accountant review is still required to choose the correct legal classification for each supply.

### 8. VAT return report is not Schedule-10 complete

The app includes VAT summary, VAT return, and VAT annex views, but the return data does not cover every Schedule-10 field such as document counts, voucher/payment details, refund reason, import/capitalized purchase buckets, or full monthly BS-period structure.

Evidence:
- `src/hooks/useReportsExtra.ts`
- `src/pages/ReportsPage.tsx`

Recommended remediation:
- Add a dedicated Schedule-10 export/check view.
- Include document counts, purchase invoice count, credit/debit note count, payment voucher details, refund fields, and separate taxable import/capitalized purchase fields.

Phase 2 status:
- VAT return summary now includes sales invoice, purchase invoice, credit note, debit note, and total document counts for the selected period.
- VAT return aggregation now separates exempt/non-taxable line totals inside VAT invoices.
- Payment voucher details, refund fields, imports/capitalized purchase buckets, and the full official Schedule 10 filing layout are still not implemented.

### 9. Purchase and sales books are not first-class IRD-format books

VAT Annex reports exist, but there is no dedicated monthly purchase book and sales book matching Schedule 8 and Schedule 9 as first-class outputs.

Evidence:
- `src/hooks/useReportsExtra2.ts`
- `src/pages/ReportsPage.tsx`

Recommended remediation:
- Add monthly purchase book and sales book reports with taxpayer registration number, period, invoice date/number, party registration number, total, exempt, taxable, and VAT columns.

### 10. Monetary calculations use floating point without explicit rounding policy

Invoice calculations use JavaScript numbers and schema stores monetary values as `REAL`.

Evidence:
- `src/pages/InvoiceCreatePage.tsx`
- `src/pages/InvoiceEditPage.tsx`
- `electron/db/schema.sql`

Risk:
- Paisa-level drift between line totals, VAT totals, printed invoices, and VAT returns.

Recommended remediation:
- Define a currency rounding policy.
- Store money in integer paisa or use a decimal-safe calculation helper.
- Recalculate and validate invoice totals before issue.

## Current Strengths

- Seller and buyer details are printed when available.
- Tax invoice heading appears for VAT invoices.
- Invoice number, BS date, AD date, line quantity/unit/rate, discount, taxable amount, VAT, grand total, amount in words, and signature areas are present.
- VAT period is stored for VAT invoices.
- Reports include VAT summary, VAT return summary, and VAT annex-style views.
- Local backup and restore exist for desktop data.

## Suggested Phase 2 Order

1. Lock issued invoices and introduce correction workflow.
2. Split sales tax invoice numbering from purchases/quotations.
3. Snapshot and print item classification fields.
4. Add buyer PAN validation rules for VAT issuance.
5. Add credit/debit note data model and UI.
6. Add audit log and cancellation reason.
7. Improve VAT books and Schedule-10 report completeness.
8. Move money calculations to explicit decimal/integer-paisa handling.

## Phase 2 Batch 1 Changes

Implemented:

- Added `src/lib/vat-compliance.ts` with the statutory 13% VAT rate, discount-before-VAT line calculation, VAT-registration issuance guard, and direct-edit guard for issued VAT invoices.
- Sales invoice create/edit now use the statutory 13% constant instead of a configurable VAT rate when the VAT invoice box is checked.
- VAT invoice creation/update is blocked when the active business is not marked VAT registered.
- Business setup/settings require a PAN/VAT number when the business is marked VAT registered.
- Invoice detail and edit pages no longer expose direct edits for issued/partially-paid/paid VAT invoices. The hook also blocks direct mutation.
- The print template prefers the stored invoice buyer PAN snapshot over the current party PAN.
- Invoice lines now snapshot item HSN/HSCode and the print template uses that stored value.
- Sales invoices, purchase bills, and quotations now reserve from separate document counters so purchases/quotations no longer consume the sales invoice counter.
- VAT summary report now exports and displays the BS return due date as the 25th day of the following BS month for each stored VAT period.
- Invoice cancellation now requires a stored cancellation reason and cancellation timestamp.
- Print/PDF actions now increment a stored invoice print count and last-printed timestamp.
- Issuing VAT sales invoices now requires a buyer PAN/VAT number; drafts can still be saved while details are incomplete.
- Invoice issue/update/cancel/print/payment actions are now recorded in `invoice_events` and shown in the invoice detail audit log.
- New documents now reserve serials from `document_sequences` keyed by business, document type, and fiscal year, and store `fiscal_year` plus `document_serial` on the invoice.
- VAT annex sales/purchase exports now include fiscal year, VAT period, taxpayer PAN, and document serial metadata for closer Schedule 8/9 review.
- A unique `(business_id, invoice_number)` index is added for new/valid databases to enforce invoice-number uniqueness.
- README now documents that CBMS/e-billing is not implemented and needs accountant/IRD confirmation where applicable.
- Added focused Vitest coverage in `src/test/vat-compliance.test.ts`.
- Invoice lines now store line-level tax classification (`vat_13`, `zero_rated`, `exempt`, `non_taxable`), and create/edit/quotation/purchase flows calculate VAT from that classification.
- VAT annex and printed tax invoice summaries now account for exempt/non-taxable lines inside a VAT invoice.
- VAT return summary now includes document counts and uses tested aggregation for exempt/non-taxable lines inside VAT invoices.

Still partial or not implemented:

- Credit/debit note correction workflow exists, but partial-line/partial-amount correction entry and accountant-specific categories still need confirmation.
- Invoice numbering is split by document type and fiscal year for new documents, including CN/DN. Existing historical invoices may need accountant-reviewed migration/backfill before statutory reliance.
- Buyer PAN validation is enforced for issued VAT sales invoices. Abbreviated invoice and cash-sale exceptions still need accountant/IRD confirmation before adding separate behavior.
- Line-level tax classification is stored and reported, but correct classification of exempt, zero-rated, and non-taxable supplies remains an accounting/legal decision.
- VAT returns/books now include more Schedule 8/9 and Schedule 10 review metadata, but still require accountant review and are not a full statutory filing substitute.
- CBMS/e-billing approval and submission remain not implemented. Tamper-evident local hashing exists, but IRD-approved signing/e-billing does not.

## Phase 3 Hardening Changes

- Added explicit credit/debit note creation from issued invoice detail pages with original invoice ID/number, correction reason/type, separate `CN-` / `DN-` fiscal-year sequences, print labels, and a dedicated CN/DN list page.
- Added sequence counters for credit notes and debit notes plus a fiscal sequence review helper that flags gaps, duplicates, missing fiscal-year/serial metadata, and legacy review records without rewriting historical numbers.
- Added SHA-256 invoice event hash chaining for issue, print/PDF, cancel, payment, correction note, and share/export events; invoice detail now shows hash-chain verification.
- Added restore warning copy telling operators to verify invoice audit hash chains before relying on restored records.
- Added explicit NPR rounding policy and integer-paisa reconciliation helpers for compliance-critical calculations.
- VAT summary/return helpers now account for credit notes reducing sales VAT and debit notes reducing purchase VAT.
- Added Settings CBMS status tab stating that IRD CBMS/e-billing is not configured, not implemented, and requires accountant/IRD confirmation.
- Added focused tests in `src/test/compliance-hardening.test.ts`.

Phase 3 remaining limitations:

- Monetary columns still persist as SQLite `REAL`; integer-paisa helpers are used for tested calculations, but a storage migration needs accountant-reviewed reconciliation.
- Credit/debit note entry currently clones the original invoice into a separate correction note; partial correction UX is not complete.
- VAT Return and Purchase/Sales Books remain review aids and are not official filing/certification outputs.
- CBMS/e-billing remains a boundary only; there is no real IRD submission integration.
