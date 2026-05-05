# VAT Compliance Checklist and Gap Audit

Phase 1 audit artifact. This document records observed compliance coverage and gaps in the current desktop VAT invoice system. No implementation changes are included here.

## Legal Baseline Used

- Nepal IRD Value Added Tax Rules, 2053 (1997), especially Rule 17 and Schedule 5B for tax invoice format.
- VAT Rules Schedule 6 for abbreviated tax invoice, Schedule 8 and 9 for purchase/sales books, and Schedule 10 for VAT return.
- IRD PAN guidance that PAN must be used in bills, invoices, books, tax documents, and related records.

Primary source:
- https://www.ird.gov.np/public/pdf/1825021765.pdf
- https://ird.gov.np/faq/?gid=97

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
| Seller PAN/VAT number | Present if configured | `businesses.pan_number`, print header | PAN is optional during setup/settings |
| Buyer name | Present if party/cash customer has value | invoice buyer fields, print customer details | Cash customer may be generic or incomplete |
| Buyer address | Present if stored | buyer fields, party fields | Optional |
| Buyer PAN | Present if stored | `buyer_pan`, `parties.pan_number` | Optional even for VAT invoice |
| Invoice number | Present | `invoice_number` | Sales, purchases, and quotations share one sequence counter |
| Date of transaction / issue | Present in AD and BS | `issued_date_ad`, `issued_date_bs` | None observed |
| Payment mode | Partially present | print derives Cash/Credit from balance due | Does not preserve selected payment mode as invoice data |
| Item details | Present | invoice items table and print | Description is limited; printed HSN/HSCode is hardcoded `-` |
| Quantity | Present | invoice items | None observed |
| Unit | Present | invoice items | None observed |
| Rate | Present | invoice items | None observed |
| Discount | Present | invoice and item discount fields | None observed |
| Taxable amount | Present | invoice and print summary | Floating-point rounding policy not explicit |
| VAT amount/rate | Present for VAT invoices | VAT 13% line | Tax rates are configurable and can drift from statutory 13% |
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

### 4. Credit/debit note support is incomplete

Reports expect `sale_return` and `purchase_return`, but the normal creation and edit flows only create sale and purchase invoices. The schema does not include formal credit/debit note fields such as original invoice reference, reason, adjustment type, or separate note sequence.

Evidence:
- `src/hooks/useReportsExtra.ts`
- `src/pages/InvoiceCreatePage.tsx`
- `electron/db/schema.sql`

Risk:
- Corrections, returns, and value changes cannot be handled in the prescribed credit/debit note form.

Recommended remediation:
- Add explicit credit note and debit note workflows.
- Store original invoice ID/number, reason, note date, note serial, tax adjustment amounts, and status.

### 5. Electronic billing and audit controls are absent

The app stores data locally in SQLite and supports backup/restore. There is no immutable audit log, print count, cancellation reason, user attribution per invoice action, hash/signature, or e-billing/CBMS submission metadata.

Evidence:
- `electron/db/schema.sql`
- `electron/db/index.cjs`
- `src/pages/SettingsPage.tsx`

Risk:
- Weak auditability for issued/cancelled/printed invoices.
- May not satisfy stricter e-billing requirements for taxpayers required to use approved electronic billing.

Recommended remediation:
- Add invoice event log for issue, print, cancel, payment, correction, and export actions.
- Store user ID, timestamp, action, previous values where relevant, reason, and document hash.
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

### 8. VAT return report is not Schedule-10 complete

The app includes VAT summary, VAT return, and VAT annex views, but the return data does not cover every Schedule-10 field such as document counts, voucher/payment details, refund reason, import/capitalized purchase buckets, or full monthly BS-period structure.

Evidence:
- `src/hooks/useReportsExtra.ts`
- `src/pages/ReportsPage.tsx`

Recommended remediation:
- Add a dedicated Schedule-10 export/check view.
- Include document counts, purchase invoice count, credit/debit note count, payment voucher details, refund fields, and separate taxable import/capitalized purchase fields.

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
