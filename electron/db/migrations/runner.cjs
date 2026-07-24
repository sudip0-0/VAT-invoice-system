const SCHEMA_VERSION = 1;

function runLegacyColumnMigrations({ columnExists, runStatement, quoteIdentifier }) {
  const addColumnIfMissing = (table, column, definition) => {
    if (!columnExists(table, column)) {
      runStatement(
        `ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${quoteIdentifier(column)} ${definition}`
      );
    }
  };

  addColumnIfMissing("invoices", "buyer_name", "TEXT");
  addColumnIfMissing("invoices", "buyer_phone", "TEXT");
  addColumnIfMissing("invoices", "buyer_address", "TEXT");
  addColumnIfMissing("invoice_items", "hsn_code", "TEXT");
  addColumnIfMissing("businesses", "next_sales_invoice_num", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing("businesses", "next_purchase_bill_num", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing("businesses", "next_quotation_num", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing("businesses", "next_credit_note_num", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing("businesses", "next_debit_note_num", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing("invoices", "print_count", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("invoices", "last_printed_at", "TEXT");
  addColumnIfMissing("invoices", "cancellation_reason", "TEXT");
  addColumnIfMissing("invoices", "cancelled_at", "TEXT");
  addColumnIfMissing("invoices", "fiscal_year", "TEXT");
  addColumnIfMissing("invoices", "document_serial", "INTEGER");
  addColumnIfMissing("invoices", "original_invoice_id", "TEXT");
  addColumnIfMissing("invoices", "original_invoice_number", "TEXT");
  addColumnIfMissing("invoices", "correction_reason", "TEXT");
  addColumnIfMissing("invoices", "correction_type", "TEXT");
  addColumnIfMissing("invoice_items", "tax_type", "TEXT NOT NULL DEFAULT 'vat_13'");
  addColumnIfMissing("invoice_events", "previous_hash", "TEXT");
  addColumnIfMissing("invoice_events", "event_hash", "TEXT");
}

function runMigrations(deps) {
  runLegacyColumnMigrations(deps);
  return SCHEMA_VERSION;
}

module.exports = { SCHEMA_VERSION, runMigrations };
