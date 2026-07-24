const QUERYABLE_TABLES = new Set([
  "profiles",
  "businesses",
  "business_users",
  "tax_rates",
  "item_categories",
  "items",
  "parties",
  "invoices",
  "invoice_items",
  "invoice_events",
  "document_sequences",
  "payments",
  "expenses",
  "stock_movements",
  "vat_return_adjustments",
  "document_templates",
]);

const TABLES_WITH_BUSINESS_ID = new Set([
  "businesses",
  "business_users",
  "tax_rates",
  "item_categories",
  "items",
  "parties",
  "invoices",
  "invoice_events",
  "document_sequences",
  "payments",
  "expenses",
  "stock_movements",
  "vat_return_adjustments",
  "document_templates",
]);

const CHILD_OWNERSHIP = {
  invoice_items: { parentTable: "invoices", foreignKey: "invoice_id" },
};

module.exports = {
  QUERYABLE_TABLES,
  TABLES_WITH_BUSINESS_ID,
  CHILD_OWNERSHIP,
};
