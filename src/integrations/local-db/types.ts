export type AppRole = "owner" | "manager" | "staff" | "accountant";
export type BusinessType = "kirana" | "wholesale" | "retail" | "restaurant" | "pharmacy" | "service" | "manufacturer" | "other";
export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type InvoiceType = "sale" | "purchase" | "sale_return" | "purchase_return" | "quotation" | "delivery_challan";
export type ItemType = "product" | "service";
export type PartyType = "customer" | "vendor" | "both";
export type PaymentMethod = "cash" | "esewa" | "khalti" | "fonepay" | "connectips" | "bank_transfer" | "cheque" | "credit";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type TaxType = "vat_13" | "exempt" | "zero_rated" | "non_taxable";

export interface BusinessUserRow {
  business_id: string;
  id: string;
  is_active: boolean;
  joined_at: string;
  role: AppRole;
  user_id: string;
}

export interface BusinessRow {
  address: string;
  city: string;
  created_at: string;
  currency: string;
  deleted_at: string | null;
  email: string | null;
  fiscal_year_start: number;
  id: string;
  invoice_prefix: string;
  is_vat_registered: boolean;
  logo_url: string | null;
  name: string;
  next_invoice_num: number;
  next_credit_note_num: number;
  next_debit_note_num: number;
  next_purchase_bill_num: number;
  next_quotation_num: number;
  next_sales_invoice_num: number;
  pan_number: string | null;
  phone: string;
  province: string | null;
  type: BusinessType;
  updated_at: string;
}

export interface InvoiceItemRow {
  description: string | null;
  discount_amt: number;
  discount_pct: number;
  id: string;
  invoice_id: string;
  item_id: string | null;
  hsn_code: string | null;
  name: string;
  quantity: number;
  rate: number;
  sort_order: number;
  tax_rate_id: string | null;
  tax_type: TaxType;
  taxable_amount: number;
  total_amount: number;
  unit: string;
  vat_amount: number;
  vat_rate: number;
}

export interface InvoiceEventRow {
  action: string;
  business_id: string;
  created_at: string;
  details: string | null;
  event_hash: string | null;
  id: string;
  invoice_id: string;
  previous_hash: string | null;
  user_id: string | null;
}

export interface DocumentSequenceRow {
  business_id: string;
  created_at: string;
  document_type: InvoiceType;
  fiscal_year: string;
  id: string;
  next_serial: number;
  updated_at: string;
}

export interface InvoiceRow {
  balance_due: number;
  business_id: string;
  buyer_address: string | null;
  buyer_name: string | null;
  buyer_pan: string | null;
  buyer_phone: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  customer_id: string | null;
  deleted_at: string | null;
  discount_amount: number;
  due_date_ad: string | null;
  due_date_bs: string | null;
  document_serial: number | null;
  fiscal_year: string | null;
  id: string;
  invoice_number: string;
  is_vat_invoice: boolean;
  correction_reason: string | null;
  correction_type: string | null;
  issued_date_ad: string;
  issued_date_bs: string;
  notes: string | null;
  paid_amount: number;
  print_count: number;
  reference_number: string | null;
  original_invoice_id: string | null;
  original_invoice_number: string | null;
  status: InvoiceStatus;
  sub_total: number;
  taxable_amount: number;
  terms_conditions: string | null;
  total_amount: number;
  type: InvoiceType;
  updated_at: string;
  last_printed_at: string | null;
  vat_amount: number;
  vat_period: string | null;
  vendor_id: string | null;
}

export interface ExpenseRow {
  amount: number;
  business_id: string;
  category: string;
  created_at: string;
  deleted_at: string | null;
  description: string;
  expense_date_ad: string;
  expense_date_bs: string;
  id: string;
  notes: string | null;
  payment_method: PaymentMethod;
  reference: string | null;
  updated_at: string;
}

export interface ItemCategoryRow {
  business_id: string;
  created_at: string;
  id: string;
  name: string;
  parent_id: string | null;
}

export interface ItemRow {
  business_id: string;
  category_id: string | null;
  code: string | null;
  created_at: string;
  current_stock: number;
  deleted_at: string | null;
  description: string | null;
  hsn_code: string | null;
  id: string;
  is_active: boolean;
  low_stock_alert: number | null;
  name: string;
  opening_stock: number;
  purchase_price: number | null;
  sale_price: number;
  tax_rate_id: string | null;
  type: ItemType;
  unit: string;
  updated_at: string;
}

export interface PartyRow {
  address: string | null;
  business_id: string;
  city: string | null;
  created_at: string;
  credit_days: number | null;
  credit_limit: number | null;
  deleted_at: string | null;
  email: string | null;
  id: string;
  is_active: boolean;
  name: string;
  notes: string | null;
  opening_balance: number;
  pan_number: string | null;
  phone: string | null;
  type: PartyType;
  updated_at: string;
}

export interface PaymentRow {
  amount: number;
  bank_name: string | null;
  business_id: string;
  cheque_date: string | null;
  cheque_number: string | null;
  created_at: string;
  gateway_ref_id: string | null;
  id: string;
  invoice_id: string | null;
  method: PaymentMethod;
  notes: string | null;
  party_id: string | null;
  payment_date_ad: string;
  payment_date_bs: string;
  reference: string | null;
  status: PaymentStatus;
  updated_at: string;
}

export interface ProfileRow {
  active_business_id: string | null;
  avatar_url: string | null;
  created_at: string;
  id: string;
  name: string;
  phone: string | null;
  updated_at: string;
  user_id: string;
}

export interface StockMovementRow {
  business_id: string;
  created_at: string;
  direction: "in" | "out";
  id: string;
  invoice_id: string | null;
  item_id: string;
  quantity: number;
  reason: string;
  stock_after: number;
  stock_before: number;
}

export interface TaxRateRow {
  business_id: string;
  created_at: string;
  id: string;
  is_active: boolean;
  is_default: boolean;
  name: string;
  rate: number;
  type: TaxType;
}

export interface TableRowMap {
  business_users: BusinessUserRow;
  document_sequences: DocumentSequenceRow;
  businesses: BusinessRow;
  expenses: ExpenseRow;
  invoice_events: InvoiceEventRow;
  invoice_items: InvoiceItemRow;
  invoices: InvoiceRow;
  item_categories: ItemCategoryRow;
  items: ItemRow;
  parties: PartyRow;
  payments: PaymentRow;
  profiles: ProfileRow;
  stock_movements: StockMovementRow;
  tax_rates: TaxRateRow;
}

export type Tables<Name extends keyof TableRowMap> = TableRowMap[Name];
export type TablesInsert<Name extends keyof TableRowMap> = Partial<TableRowMap[Name]>;
export type TablesUpdate<Name extends keyof TableRowMap> = Partial<TableRowMap[Name]>;
