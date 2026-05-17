PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  active_business_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'retail',
  pan_number TEXT,
  is_vat_registered INTEGER NOT NULL DEFAULT 0,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  logo_url TEXT,
  fiscal_year_start INTEGER NOT NULL DEFAULT 4,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  next_invoice_num INTEGER NOT NULL DEFAULT 1,
  next_sales_invoice_num INTEGER NOT NULL DEFAULT 1,
  next_purchase_bill_num INTEGER NOT NULL DEFAULT 1,
  next_quotation_num INTEGER NOT NULL DEFAULT 1,
  next_credit_note_num INTEGER NOT NULL DEFAULT 1,
  next_debit_note_num INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'NPR',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS business_users (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  is_active INTEGER NOT NULL DEFAULT 1,
  joined_at TEXT NOT NULL,
  UNIQUE (business_id, user_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, name),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS item_categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES item_categories(id)
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  category_id TEXT,
  tax_rate_id TEXT,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'product',
  unit TEXT NOT NULL DEFAULT 'PCS',
  purchase_price REAL,
  sale_price REAL NOT NULL DEFAULT 0,
  opening_stock REAL NOT NULL DEFAULT 0,
  current_stock REAL NOT NULL DEFAULT 0,
  low_stock_alert REAL,
  hsn_code TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (business_id, code),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES item_categories(id),
  FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id)
);

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  pan_number TEXT,
  address TEXT,
  city TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  credit_limit REAL,
  credit_days INTEGER DEFAULT 30,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'sale',
  status TEXT NOT NULL DEFAULT 'draft',
  invoice_number TEXT NOT NULL,
  reference_number TEXT,
  customer_id TEXT,
  vendor_id TEXT,
  issued_date_ad TEXT NOT NULL,
  issued_date_bs TEXT NOT NULL,
  due_date_ad TEXT,
  due_date_bs TEXT,
  fiscal_year TEXT,
  document_serial INTEGER,
  original_invoice_id TEXT,
  original_invoice_number TEXT,
  correction_reason TEXT,
  correction_type TEXT,
  buyer_name TEXT,
  buyer_pan TEXT,
  buyer_phone TEXT,
  buyer_address TEXT,
  is_vat_invoice INTEGER NOT NULL DEFAULT 0,
  vat_period TEXT,
  sub_total REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  taxable_amount REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  print_count INTEGER NOT NULL DEFAULT 0,
  last_printed_at TEXT,
  cancellation_reason TEXT,
  cancelled_at TEXT,
  notes TEXT,
  terms_conditions TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES parties(id),
  FOREIGN KEY (vendor_id) REFERENCES parties(id),
  FOREIGN KEY (original_invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  item_id TEXT,
  tax_rate_id TEXT,
  tax_type TEXT NOT NULL DEFAULT 'vat_13',
  name TEXT NOT NULL,
  description TEXT,
  hsn_code TEXT,
  unit TEXT NOT NULL DEFAULT 'PCS',
  quantity REAL NOT NULL DEFAULT 0,
  rate REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  discount_amt REAL NOT NULL DEFAULT 0,
  vat_rate REAL NOT NULL DEFAULT 0,
  taxable_amount REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  invoice_id TEXT,
  party_id TEXT,
  amount REAL NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'completed',
  payment_date_ad TEXT NOT NULL,
  payment_date_bs TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  bank_name TEXT,
  cheque_number TEXT,
  cheque_date TEXT,
  gateway_ref_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

CREATE TABLE IF NOT EXISTS invoice_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  previous_hash TEXT,
  event_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS document_sequences (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  next_serial INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, document_type, fiscal_year),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  expense_date_ad TEXT NOT NULL,
  expense_date_bs TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  invoice_id TEXT,
  quantity REAL NOT NULL,
  direction TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'invoice',
  stock_before REAL NOT NULL DEFAULT 0,
  stock_after REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_business_users_user_id ON business_users(user_id);
CREATE INDEX IF NOT EXISTS idx_items_business_id ON items(business_id);
CREATE INDEX IF NOT EXISTS idx_items_business_type_name ON items(business_id, type, name);
CREATE INDEX IF NOT EXISTS idx_items_business_code ON items(business_id, code);
CREATE INDEX IF NOT EXISTS idx_parties_business_id ON parties(business_id);
CREATE INDEX IF NOT EXISTS idx_parties_business_type_name ON parties(business_id, type, name);
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business_type_status_created ON invoices(business_id, type, status, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_business_type_issued_date ON invoices(business_id, type, issued_date_ad);
CREATE INDEX IF NOT EXISTS idx_invoices_business_type_fiscal_serial ON invoices(business_id, type, fiscal_year, document_serial);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_business_type_fiscal_serial_unique ON invoices(business_id, type, fiscal_year, document_serial) WHERE fiscal_year IS NOT NULL AND document_serial IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_business_invoice_number ON invoices(business_id, invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_business_invoice_number_unique ON invoices(business_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_original_invoice_id ON invoices(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_business_id ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_business_party_status ON payments(business_id, party_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_business_payment_date ON payments(business_id, payment_date_ad);
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice_created ON invoice_events(invoice_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_events_business_created ON invoice_events(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice_hash ON invoice_events(invoice_id, event_hash);
CREATE INDEX IF NOT EXISTS idx_document_sequences_business_type_year ON document_sequences(business_id, document_type, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON expenses(business_id, expense_date_ad);
CREATE INDEX IF NOT EXISTS idx_expenses_business_category ON expenses(business_id, category);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business_id ON stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business_created ON stock_movements(business_id, created_at);
