# Database Architecture

## Overview

The VAT Invoice System uses a **local-first SQLite database** managed entirely within the Electron desktop runtime. There is no cloud database dependency at runtime. All business data, auth state, and audit trails live in a single SQLite file stored in the Electron `userData` directory.

This architecture provides:

- **Offline operation** — full functionality without network access
- **Data ownership** — user data remains on their device
- **Simplified deployment** — no backend service to host or manage
- **Audit compliance** — immutable invoice event logs and document sequences

---

## Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Database Engine | SQLite 3 | Local relational data store |
| Runtime Binding | sql.js | In-process SQLite via JavaScript (main process) |
| Persistence | Node.js `fs` | Atomic writes to `.sqlite` file in `userData` |
| Schema Management | `electron/db/schema.sql` | Source-of-truth DDL, applied on first launch |
| Type Safety | `src/integrations/local-db/types.ts` | TypeScript interfaces mirroring tables |

---

## Physical Storage

The database file is written to Electron’s `app.getPath('userData')` directory:

| OS | Default Path |
|---|---|
| Windows | `%APPDATA%\Vyapar Nepal\vat-invoice.sqlite` |
| macOS | `~/Library/Application Support/Vyapar Nepal/vat-invoice.sqlite` |
| Linux | `~/.config/Vyapar Nepal/vat-invoice.sqlite` |

> In development, the folder name follows `package.json` (`vite_react_shadcn_ts`).

---

## Schema Overview

The schema is organized into **7 functional domains**:

1. **Auth & Identity** — `app_users`, `profiles`
2. **Business & Membership** — `businesses`, `business_users`
3. **Catalog** — `item_categories`, `items`, `tax_rates`
4. **Parties** — `parties` (customers, vendors)
5. **Invoicing** — `invoices`, `invoice_items`, `document_sequences`
6. **Payments & Expenses** — `payments`, `expenses`
7. **Inventory & Audit** — `stock_movements`, `invoice_events`

### Entity Relationship Diagram (Logical)

```
app_users ||--o| profiles : has
app_users ||--o{ business_users : belongs_to
businesses ||--o{ business_users : has_members
businesses ||--o{ items : owns
businesses ||--o{ parties : owns
businesses ||--o{ invoices : issues
businesses ||--o{ payments : records
businesses ||--o{ expenses : tracks
businesses ||--o{ stock_movements : logs
businesses ||--o{ tax_rates : defines
businesses ||--o{ item_categories : defines
businesses ||--o{ invoice_events : audits
businesses ||--o{ document_sequences : manages

items }o--|| item_categories : categorized_in
items }o--o| tax_rates : taxed_at
parties ||--o{ invoices : billed_on
invoices ||--|o parties : customer
invoices ||--|o parties : vendor
invoices ||--o{ invoice_items : contains
invoices ||--o{ payments : settled_by
invoices ||--o{ stock_movements : triggers
invoices ||--o{ invoice_events : audited_via
invoice_items }o--o| items : references
invoice_items }o--o| tax_rates : taxed_at
payments }o--o| parties : from/to
```

---

## Table Reference

### Auth & Identity

| Table | Purpose | Key Columns |
|---|---|---|
| `app_users` | Local user accounts (email + bcrypt hash) | `id`, `email`, `password_hash` |
| `profiles` | User profile extension (name, phone, avatar, active business) | `user_id` (FK → `app_users`) |

### Business & Membership

| Table | Purpose | Key Columns |
|---|---|---|
| `businesses` | Company/business profiles, fiscal settings, invoice numbering | `id`, `pan_number`, `is_vat_registered`, `fiscal_year_start` |
| `business_users` | Many-to-many linking users to businesses with roles | `business_id`, `user_id`, `role` |

### Catalog

| Table | Purpose | Key Columns |
|---|---|---|
| `item_categories` | Hierarchical product/service categories | `business_id`, `parent_id` (self-referencing) |
| `items` | Product/service master data with stock tracking | `business_id`, `code`, `current_stock`, `sale_price`, `tax_rate_id` |
| `tax_rates` | Configurable tax/VAT rates per business | `business_id`, `name`, `rate`, `type`, `is_default` |

### Parties

| Table | Purpose | Key Columns |
|---|---|---|
| `parties` | Customers and vendors (dual-purpose table) | `business_id`, `type`, `opening_balance`, `credit_limit`, `credit_days` |

### Invoicing

| Table | Purpose | Key Columns |
|---|---|---|
| `invoices` | Header records for all document types (sales, purchases, returns, quotations) | `business_id`, `type`, `status`, `invoice_number`, `document_serial` |
| `invoice_items` | Line items for each invoice | `invoice_id`, `item_id`, `quantity`, `rate`, `vat_rate`, `taxable_amount` |
| `document_sequences` | Per-business, per-fiscal-year serial counters | `business_id`, `document_type`, `fiscal_year`, `next_serial` |

### Payments & Expenses

| Table | Purpose | Key Columns |
|---|---|---|
| `payments` | Payments linked to invoices or parties | `business_id`, `invoice_id`, `party_id`, `amount`, `method`, `status` |
| `expenses` | General business expenses | `business_id`, `category`, `amount`, `expense_date_ad` |

### Inventory & Audit

| Table | Purpose | Key Columns |
|---|---|---|
| `stock_movements` | Every quantity change with before/after snapshot | `item_id`, `invoice_id`, `direction`, `stock_before`, `stock_after` |
| `invoice_events` | Tamper-evident audit log with event hashing | `invoice_id`, `action`, `previous_hash`, `event_hash` |

---

## Indexing Strategy

Indexes are defined in `electron/db/schema.sql` and target the most common query patterns:

| Index | Tables | Query Pattern Supported |
|---|---|---|
| `idx_items_business_type_name` | `items` | Inventory listing and search |
| `idx_items_business_code` | `items` | Barcode/code lookups |
| `idx_parties_business_type_name` | `parties` | Customer/vendor directory |
| `idx_invoices_business_type_status_created` | `invoices` | Dashboard and list views |
| `idx_invoices_business_type_issued_date` | `invoices` | Date-range reports |
| `idx_invoices_business_type_fiscal_serial` | `invoices` | Fiscal-year numbering |
| `idx_invoices_business_invoice_number` | `invoices` | Invoice lookup by number |
| `idx_payments_business_party_status` | `payments` | Party ledger and outstanding |
| `idx_payments_business_payment_date` | `payments` | Daily collections report |
| `idx_expenses_business_date` | `expenses` | Monthly expense reports |
| `idx_stock_movements_business_created` | `stock_movements` | Inventory history |
| `idx_invoice_events_invoice_hash` | `invoice_events` | Audit trail integrity checks |

---

## Data Types & Conventions

Because SQLite is dynamically typed, the schema enforces consistency through application-layer contracts:

| Logical Type | SQLite Storage | TypeScript Type | Notes |
|---|---|---|---|
| Primary key | `TEXT` | `string` | UUID v4 generated in the app |
| Boolean | `INTEGER` (0/1) | `boolean` | e.g., `is_active`, `is_vat_registered` |
| Decimal/money | `REAL` | `number` | All monetary values stored as decimal numbers |
| Date/timestamp | `TEXT` (ISO 8601) | `string` | Both AD (`2026-05-07`) and BS (`2083-01-24`) dates stored |
| JSON-like | `TEXT` | `string` | Serialized when needed; no native JSON columns |
| Nullable | column allows `NULL` | union with `null` | Explicit `deleted_at` for soft deletes |

---

## Soft Deletes

Most business tables implement **soft deletes** via a `deleted_at` column:

- `businesses`
- `items`
- `parties`
- `invoices`
- `expenses`

Queries in the application layer filter out soft-deleted rows by default (`deleted_at IS NULL`). This preserves historical data for audit and reporting while hiding records from normal UI views.

---

## Auth & Session Model

Authentication is entirely local:

1. **Sign up** — `app_users` row created with bcrypt-hashed password
2. **Sign in** — password verified in main process; session token returned to renderer
3. **Session** — stored in Electron `safeStorage`; restored on app restart
4. **Profile** — each user has one `profiles` row tracking `active_business_id`

There is no OAuth, JWT, or remote validation at runtime.

---

## IPC & Data Flow

The renderer **never touches the database directly**. All access flows through the IPC boundary:

```
Renderer (React)
  ↓  LocalQueryBuilder / localDb.auth
  ↓  IPC invoke (desktop:query, desktop:auth:*)
Preload (typed bridge)
  ↓
Main Process (Electron)
  ↓  sql.js execution
SQLite file (userData)
```

- **Reads**: `desktop:query` returns JSON arrays
- **Writes**: `desktop:query` handles insert/update/delete with automatic persistence flush
- **Auth**: `desktop:auth:*` endpoints manage users and sessions
- **System**: `desktop:system:*` handles backup/restore and external URLs

---

## Invoice Integrity & Audit

### Document Sequences

Invoice numbers are **not auto-incrementing integers**. Instead, each business maintains a `document_sequences` row per `(document_type, fiscal_year)`. The main process increments the counter atomically during invoice creation to prevent collisions.

### Event Hashing

The `invoice_events` table supports a **tamper-evident log**:

- Each event stores `previous_hash` (hash of the prior event for this invoice)
- Each event stores `event_hash` (hash of the current event payload)
- This creates a chain that can be verified offline

While the current implementation stores the hashes, full chain verification is a future enhancement.

---

## Stock & Inventory Logic

Stock is **not updated by triggers** (SQLite compatibility choice). Instead, the Electron main process handles stock adjustments during:

- **Invoice issue** — decrements `items.current_stock`, inserts `stock_movements` row
- **Invoice cancel** — reverses the movement, restores stock
- **Manual adjustment** — direct `items` update with `stock_movements` audit row

All movements store `stock_before` and `stock_after` for traceability.

---

## Backup & Restore

Because the entire database is a single file:

- **Backup**: copy `vat-invoice.sqlite` to a user-chosen location
- **Restore**: replace `vat-invoice.sqlite` from a backup copy (app must be closed)
- **Migration**: schema changes are applied idempotently via `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`

The desktop app exposes backup/restore through the `desktop:system:*` IPC channel.

---

## Schema Evolution

Schema changes follow this process:

1. Update `electron/db/schema.sql` with new DDL
2. Update `src/integrations/local-db/types.ts` with new TypeScript interfaces
3. Application code references the new columns/tables
4. On next app launch, new tables/indexes are created automatically (idempotent DDL)

For **destructive changes** (column renames, type changes), a migration script must be provided that transforms existing data before the new schema is enforced.

---

## Security Considerations

| Concern | Mitigation |
|---|---|
| Local file access | Database resides in user-specific `userData`; standard OS permissions apply |
| Password storage | Bcrypt hashes only; no plaintext passwords |
| Session storage | Electron `safeStorage` encrypts session tokens at rest |
| SQL injection | Renderer never builds SQL; all queries parameterized in main process |
| Data exfiltration | No network calls for data; offline by design |

---

## Related Documentation

- [`desktop-architecture.md`](./desktop-architecture.md) — Overall Electron runtime design
- [`database-commands.md`](./database-commands.md) — CLI snippets for inspecting the SQLite file
- [`migration.md`](./migration.md) — Web-to-desktop migration backlog and acceptance criteria
- [`electron/db/schema.sql`](./electron/db/schema.sql) — Canonical database schema
- [`src/integrations/local-db/types.ts`](./src/integrations/local-db/types.ts) — TypeScript table interfaces
