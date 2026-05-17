const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const initSqlJs = require("sql.js");

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
]);

const BOOLEAN_COLUMNS = {
  businesses: ["is_vat_registered"],
  business_users: ["is_active"],
  tax_rates: ["is_default", "is_active"],
  items: ["is_active"],
  parties: ["is_active"],
  invoices: ["is_vat_invoice"],
};

const RELATIONSHIPS = {
  "invoices.customer": { table: "parties", sourceKey: "customer_id", targetKey: "id", many: false },
  "invoices.vendor": { table: "parties", sourceKey: "vendor_id", targetKey: "id", many: false },
  "invoices.invoice_items": { table: "invoice_items", sourceKey: "id", targetKey: "invoice_id", many: true },
  "payments.invoice": { table: "invoices", sourceKey: "invoice_id", targetKey: "id", many: false },
  "payments.party": { table: "parties", sourceKey: "party_id", targetKey: "id", many: false },
  "stock_movements.item": { table: "items", sourceKey: "item_id", targetKey: "id", many: false },
  "stock_movements.invoice": { table: "invoices", sourceKey: "invoice_id", targetKey: "id", many: false },
};

let appInstance = null;
let SQL = null;
let db = null;
let dbPath = "";

function nowIso() {
  return new Date().toISOString();
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function ensureInitialized() {
  if (!db) {
    throw new Error("Desktop database has not been initialized");
  }
}

function getSchemaSql() {
  return fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
}

async function initializeDatabase(app) {
  if (db) {
    return { dbPath };
  }

  appInstance = app;
  SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });

  const userDataDir = app.getPath("userData");
  fs.mkdirSync(userDataDir, { recursive: true });
  dbPath = path.join(userDataDir, "vat-invoice.sqlite");

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  db.exec(getSchemaSql());
  runSchemaMigrations();
  saveDatabase();
  return { dbPath };
}

function saveDatabase() {
  ensureInitialized();
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function columnExists(table, column) {
  const statement = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`);
  let exists = false;
  while (statement.step()) {
    const row = statement.getAsObject();
    if (row.name === column) {
      exists = true;
      break;
    }
  }
  statement.free();
  return exists;
}

function addColumnIfMissing(table, column, definition) {
  if (!columnExists(table, column)) {
    runStatement(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${quoteIdentifier(column)} ${definition}`);
  }
}

function runSchemaMigrations() {
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

function createResponse(data = null, error = null, count = null) {
  const response = {
    data,
    error: error ? { message: error.message || String(error) } : null,
  };
  if (count !== null) {
    response.count = count;
  }
  return response;
}

function sanitizeValue(value) {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, sanitizeValue(entry)])
    );
  }
  return value;
}

function serializeRow(table, row) {
  const booleanColumns = new Set(BOOLEAN_COLUMNS[table] || []);
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => {
      if (value === undefined) {
        return [column, null];
      }
      if (booleanColumns.has(column)) {
        return [column, value ? 1 : 0];
      }
      return [column, value];
    })
  );
}

function normalizeRow(table, row) {
  const booleanColumns = BOOLEAN_COLUMNS[table] || [];
  const normalized = { ...row };
  for (const column of booleanColumns) {
    if (column in normalized) {
      normalized[column] = Boolean(normalized[column]);
    }
  }
  return normalized;
}

function readAllRows(table) {
  ensureInitialized();
  const statement = db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`);
  const rows = [];
  while (statement.step()) {
    rows.push(normalizeRow(table, statement.getAsObject()));
  }
  statement.free();
  return rows;
}

function normalizeSqlValue(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return value;
}

function buildWhereClause(filters = []) {
  const clauses = [];
  const values = [];

  for (const filter of filters) {
    if (filter.type === "or") {
      const conditions = parseOrExpression(filter.expression);
      if (conditions.length === 0) {
        continue;
      }
      const orClauses = [];
      for (const condition of conditions) {
        const clause = buildConditionSql(condition.operator, condition.column, condition.value, values);
        if (!clause) {
          return null;
        }
        orClauses.push(clause);
      }
      clauses.push(`(${orClauses.join(" OR ")})`);
      continue;
    }

    const clause = buildConditionSql(filter.type, filter.column, filter.value, values);
    if (!clause) {
      return null;
    }
    clauses.push(clause);
  }

  return {
    sql: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

function buildConditionSql(operator, column, value, values) {
  const columnSql = quoteIdentifier(column);
  switch (operator) {
    case "eq":
      values.push(normalizeSqlValue(value));
      return `${columnSql} = ?`;
    case "neq":
      values.push(normalizeSqlValue(value));
      return `${columnSql} != ?`;
    case "is":
      if (value === null) {
        return `${columnSql} IS NULL`;
      }
      values.push(normalizeSqlValue(value));
      return `${columnSql} IS ?`;
    case "gte":
      values.push(normalizeSqlValue(value));
      return `${columnSql} >= ?`;
    case "lte":
      values.push(normalizeSqlValue(value));
      return `${columnSql} <= ?`;
    case "ilike":
      values.push(String(value ?? "").toLowerCase());
      return `LOWER(CAST(${columnSql} AS TEXT)) LIKE ?`;
    case "in":
      if (!Array.isArray(value) || value.length === 0) {
        return "0 = 1";
      }
      values.push(...value.map((entry) => normalizeSqlValue(entry)));
      return `${columnSql} IN (${value.map(() => "?").join(", ")})`;
    default:
      return null;
  }
}

function readFilteredRows(table, filters = []) {
  const where = buildWhereClause(filters);
  if (!where) {
    return applyFilters(readAllRows(table), filters);
  }

  const statement = db.prepare(`SELECT * FROM ${quoteIdentifier(table)}${where.sql}`);
  statement.bind(where.values);
  const rows = [];
  while (statement.step()) {
    rows.push(normalizeRow(table, statement.getAsObject()));
  }
  statement.free();
  return rows;
}

function runStatement(sql, values = []) {
  ensureInitialized();
  const statement = db.prepare(sql);
  statement.run(values);
  statement.free();
}

function insertRow(table, row) {
  const serialized = serializeRow(table, row);
  const columns = Object.keys(serialized);
  const values = columns.map((column) => serialized[column]);
  const columnSql = columns.map((column) => quoteIdentifier(column)).join(", ");
  const placeholderSql = columns.map(() => "?").join(", ");
  runStatement(`INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${placeholderSql})`, values);
}

function updateRow(table, row) {
  const serialized = serializeRow(table, row);
  const columns = Object.keys(serialized).filter((column) => column !== "id");
  const assignments = columns.map((column) => `${quoteIdentifier(column)} = ?`).join(", ");
  const values = columns.map((column) => serialized[column]);
  values.push(serialized.id);
  runStatement(`UPDATE ${quoteIdentifier(table)} SET ${assignments} WHERE "id" = ?`, values);
}

function deleteRow(table, id) {
  runStatement(`DELETE FROM ${quoteIdentifier(table)} WHERE "id" = ?`, [id]);
}

function applyInsertDefaults(table, rawPayload) {
  const payload = sanitizeValue(rawPayload || {});
  const timestamp = nowIso();
  const base = { id: payload.id || crypto.randomUUID() };

  switch (table) {
    case "profiles":
      return {
        ...base,
        name: "",
        phone: null,
        avatar_url: null,
        active_business_id: null,
        created_at: timestamp,
        updated_at: timestamp,
        ...payload,
      };
    case "businesses":
      return {
        ...base,
        name: "",
        type: "retail",
        pan_number: null,
        is_vat_registered: false,
        address: "",
        city: "",
        province: null,
        phone: "",
        email: null,
        logo_url: null,
        fiscal_year_start: 4,
        invoice_prefix: "INV",
        next_invoice_num: 1,
        next_sales_invoice_num: 1,
        next_purchase_bill_num: 1,
        next_quotation_num: 1,
        next_credit_note_num: 1,
        next_debit_note_num: 1,
        currency: "NPR",
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        ...payload,
      };
    case "business_users":
      return {
        ...base,
        role: "staff",
        is_active: true,
        joined_at: timestamp,
        ...payload,
      };
    case "tax_rates":
      return {
        ...base,
        rate: 0,
        is_default: false,
        is_active: true,
        created_at: timestamp,
        ...payload,
      };
    case "item_categories":
      return {
        ...base,
        parent_id: null,
        created_at: timestamp,
        ...payload,
      };
    case "items": {
      const openingStock = payload.opening_stock ?? 0;
      return {
        ...base,
        category_id: null,
        tax_rate_id: null,
        code: null,
        description: null,
        type: "product",
        unit: "PCS",
        purchase_price: null,
        sale_price: 0,
        opening_stock: openingStock,
        current_stock: payload.current_stock ?? openingStock,
        low_stock_alert: null,
        hsn_code: null,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        ...payload,
      };
    }
    case "parties":
      return {
        ...base,
        type: "customer",
        phone: null,
        email: null,
        pan_number: null,
        address: null,
        city: null,
        opening_balance: 0,
        credit_limit: null,
        credit_days: 30,
        notes: null,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        ...payload,
      };
    case "invoices":
      return {
        ...base,
        type: "sale",
        status: "draft",
        reference_number: null,
        customer_id: null,
        vendor_id: null,
        issued_date_ad: timestamp.slice(0, 10),
        issued_date_bs: "",
        due_date_ad: null,
        due_date_bs: null,
        fiscal_year: null,
        document_serial: null,
        original_invoice_id: null,
        original_invoice_number: null,
        correction_reason: null,
        correction_type: null,
        buyer_name: null,
        buyer_pan: null,
        buyer_phone: null,
        buyer_address: null,
        is_vat_invoice: false,
        vat_period: null,
        sub_total: 0,
        discount_amount: 0,
        taxable_amount: 0,
        vat_amount: 0,
        total_amount: 0,
        paid_amount: 0,
        balance_due: 0,
        print_count: 0,
        last_printed_at: null,
        cancellation_reason: null,
        cancelled_at: null,
        notes: null,
        terms_conditions: null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        ...payload,
      };
    case "invoice_items":
      return {
        ...base,
        item_id: null,
        tax_rate_id: null,
        tax_type: "vat_13",
        description: null,
        hsn_code: null,
        unit: "PCS",
        quantity: 0,
        rate: 0,
        discount_pct: 0,
        discount_amt: 0,
        vat_rate: 0,
        taxable_amount: 0,
        vat_amount: 0,
        total_amount: 0,
        sort_order: 0,
        ...payload,
      };
    case "invoice_events":
      return {
        ...base,
        user_id: null,
        details: null,
        previous_hash: null,
        event_hash: null,
        created_at: timestamp,
        ...payload,
      };
    case "document_sequences":
      return {
        ...base,
        next_serial: 1,
        created_at: timestamp,
        updated_at: timestamp,
        ...payload,
      };
    case "payments":
      return {
        ...base,
        invoice_id: null,
        party_id: null,
        amount: 0,
        method: "cash",
        status: "completed",
        payment_date_ad: timestamp.slice(0, 10),
        payment_date_bs: "",
        reference: null,
        notes: null,
        bank_name: null,
        cheque_number: null,
        cheque_date: null,
        gateway_ref_id: null,
        created_at: timestamp,
        updated_at: timestamp,
        ...payload,
      };
    case "expenses":
      return {
        ...base,
        category: "General",
        description: "",
        amount: 0,
        expense_date_ad: timestamp.slice(0, 10),
        expense_date_bs: "",
        payment_method: "cash",
        reference: null,
        notes: null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        ...payload,
      };
    case "stock_movements":
      return {
        ...base,
        invoice_id: null,
        reason: "invoice",
        stock_before: 0,
        stock_after: 0,
        created_at: timestamp,
        ...payload,
      };
    default:
      return { ...base, ...payload };
  }
}

function applyFilters(rows, filters = []) {
  return rows.filter((row) =>
    filters.every((filter) => {
      if (filter.type === "or") {
        return parseOrExpression(filter.expression).some((condition) =>
          evaluateCondition(row, condition.operator, condition.column, condition.value)
        );
      }

      return evaluateCondition(row, filter.type, filter.column, filter.value);
    })
  );
}

function parseOrExpression(expression = "") {
  return expression
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [column, operator, ...rawValueParts] = entry.split(".");
      return {
        column,
        operator,
        value: rawValueParts.join("."),
      };
    });
}

function evaluateCondition(row, operator, column, value) {
  const currentValue = row[column];
  switch (operator) {
    case "eq":
      return currentValue === value;
    case "neq":
      return currentValue !== value;
    case "is":
      return value === null ? currentValue === null : currentValue === value;
    case "in":
      return Array.isArray(value) && value.includes(currentValue);
    case "gte":
      return currentValue >= value;
    case "lte":
      return currentValue <= value;
    case "ilike":
      return matchesIlike(currentValue, value);
    default:
      return true;
  }
}

function matchesIlike(currentValue, pattern) {
  const valueText = String(currentValue ?? "").toLowerCase();
  const patternText = String(pattern ?? "").toLowerCase();

  if (patternText.startsWith("%") && patternText.endsWith("%")) {
    return valueText.includes(patternText.slice(1, -1));
  }

  if (patternText.startsWith("%")) {
    return valueText.endsWith(patternText.slice(1));
  }

  if (patternText.endsWith("%")) {
    return valueText.startsWith(patternText.slice(0, -1));
  }

  return valueText === patternText;
}

function applyOrdering(rows, orderBy) {
  if (!orderBy?.column) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const leftValue = left[orderBy.column];
    const rightValue = right[orderBy.column];

    if (leftValue === rightValue) {
      return 0;
    }

    const result = leftValue > rightValue ? 1 : -1;
    return orderBy.ascending === false ? -result : result;
  });
}

function splitTopLevel(value) {
  const segments = [];
  let current = "";
  let depth = 0;

  for (const character of value) {
    if (character === "," && depth === 0) {
      if (current.trim()) {
        segments.push(current.trim());
      }
      current = "";
      continue;
    }

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    }

    current += character;
  }

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments;
}

function parseSelection(selection) {
  const normalized = selection && selection.trim() ? selection.trim() : "*";
  const segments = splitTopLevel(normalized);
  const columns = [];
  const relations = [];
  let includeAll = false;

  for (const segment of segments) {
    if (segment === "*") {
      includeAll = true;
      continue;
    }

    const relationMatch = segment.match(/^(?:(?<alias>[a-zA-Z0-9_]+):)?(?<table>[a-zA-Z0-9_]+)(?:![^(]+)?\((?<columns>.*)\)$/);
    if (relationMatch?.groups) {
      relations.push({
        alias: relationMatch.groups.alias || relationMatch.groups.table,
        table: relationMatch.groups.table,
        columns: relationMatch.groups.columns || "*",
      });
      continue;
    }

    columns.push(segment);
  }

  return { includeAll, columns, relations };
}

function projectRows(parentTable, rows, selection) {
  const parsed = parseSelection(selection);
  const relationCache = new Map();
  return rows.map((row) => projectRow(parentTable, row, parsed, relationCache));
}

function getCachedRows(table, relationCache) {
  if (!relationCache.has(table)) {
    relationCache.set(table, readAllRows(table));
  }
  return relationCache.get(table);
}

function projectRow(parentTable, row, parsedSelection, relationCache) {
  const projected = parsedSelection.includeAll
    ? { ...row }
    : parsedSelection.columns.reduce((result, column) => {
        result[column] = row[column];
        return result;
      }, {});

  if (!parsedSelection.includeAll && parsedSelection.columns.length === 0 && parsedSelection.relations.length === 0) {
    return { ...row };
  }

  for (const relation of parsedSelection.relations) {
    const relationship = RELATIONSHIPS[`${parentTable}.${relation.alias}`];
    if (!relationship) {
      projected[relation.alias] = relationship?.many ? [] : null;
      continue;
    }

    let relatedRows = getCachedRows(relationship.table, relationCache).filter(
      (candidate) => candidate[relationship.targetKey] === row[relationship.sourceKey]
    );

    if (relationship.table === "invoice_items") {
      relatedRows = applyOrdering(relatedRows, { column: "sort_order", ascending: true });
    }

    const relatedSelection = parseSelection(relation.columns);
    const projectedRelated = relatedRows.map((candidate) => projectRow(relationship.table, candidate, relatedSelection, relationCache));
    projected[relation.alias] = relationship.many ? projectedRelated : projectedRelated[0] || null;
  }

  return projected;
}

function withTransaction(work) {
  ensureInitialized();
  db.exec("BEGIN TRANSACTION");
  try {
    const result = work();
    db.exec("COMMIT");
    saveDatabase();
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function getInvoiceStockPlan(invoiceType, statusMode) {
  if (statusMode === "issue") {
    if (invoiceType === "sale") {
      return { multiplier: -1, direction: "out", reason: invoiceType };
    }
    if (invoiceType === "purchase") {
      return { multiplier: 1, direction: "in", reason: invoiceType };
    }
    if (invoiceType === "sale_return") {
      return { multiplier: 1, direction: "in", reason: invoiceType };
    }
    if (invoiceType === "purchase_return") {
      return { multiplier: -1, direction: "out", reason: invoiceType };
    }
  }

  if (statusMode === "cancel") {
    if (invoiceType === "sale") {
      return { multiplier: 1, direction: "in", reason: "cancellation" };
    }
    if (invoiceType === "purchase") {
      return { multiplier: -1, direction: "out", reason: "cancellation" };
    }
    if (invoiceType === "sale_return") {
      return { multiplier: -1, direction: "out", reason: "cancellation" };
    }
    if (invoiceType === "purchase_return") {
      return { multiplier: 1, direction: "in", reason: "cancellation" };
    }
  }

  return null;
}

function adjustStockForInvoice(invoice, statusMode) {
  const plan = getInvoiceStockPlan(invoice.type, statusMode);
  if (!plan) {
    return;
  }

  const lineItems = readFilteredRows("invoice_items", [{ type: "eq", column: "invoice_id", value: invoice.id }])
    .filter((item) => item.item_id);
  const itemsById = new Map(readAllRows("items").map((item) => [item.id, item]));
  for (const lineItem of lineItems) {
    const item = itemsById.get(lineItem.item_id);
    if (!item) {
      continue;
    }

    const oldStock = Number(item.current_stock || 0);
    const newStock = oldStock + Number(lineItem.quantity) * plan.multiplier;
    updateRow("items", {
      ...item,
      current_stock: newStock,
      updated_at: nowIso(),
    });

    insertRow(
      "stock_movements",
      applyInsertDefaults("stock_movements", {
        business_id: invoice.business_id,
        item_id: item.id,
        invoice_id: invoice.id,
        quantity: Number(lineItem.quantity),
        direction: plan.direction,
        reason: plan.reason,
        stock_before: oldStock,
        stock_after: newStock,
      })
    );
  }
}

function handleInvoiceMutation(previousRow, nextRow) {
  if (!previousRow) {
    if (nextRow.status === "issued") {
      adjustStockForInvoice(nextRow, "issue");
    }
    return;
  }

  if (previousRow.status === nextRow.status) {
    return;
  }

  if (nextRow.status === "issued" && previousRow.status !== "issued") {
    adjustStockForInvoice(nextRow, "issue");
    return;
  }

  if (nextRow.status === "cancelled" && previousRow.status === "issued") {
    adjustStockForInvoice(previousRow, "cancel");
  }
}

function selectRows(table, request) {
  let rows = readFilteredRows(table, request.filters);
  const totalCount = rows.length;
  rows = applyOrdering(rows, request.orderBy);

  if (request.offset) {
    rows = rows.slice(request.offset);
  }

  if (request.limit !== null && request.limit !== undefined) {
    rows = rows.slice(0, request.limit);
  }

  const projected = projectRows(table, rows, request.selection);
  return {
    data: request.single ? projected[0] || null : projected,
    count: request.count === "exact" ? totalCount : null,
  };
}

function mutateRows(table, request) {
  return withTransaction(() => {
    const matchingRows = readFilteredRows(table, request.filters);

    if (request.action === "insert") {
      const payloads = Array.isArray(request.payload) ? request.payload : [request.payload];
      const inserted = payloads.map((payload) => applyInsertDefaults(table, payload));
      for (const row of inserted) {
        insertRow(table, row);
        if (table === "invoices") {
          handleInvoiceMutation(null, row);
        }
      }
      return request.selection ? selectProjection(table, inserted, request) : null;
    }

    if (request.action === "update") {
      const payload = sanitizeValue(request.payload || {});
      const updatedRows = matchingRows.map((row) => {
        const nextRow = {
          ...row,
          ...payload,
        };
        if ("updated_at" in row && !("updated_at" in payload)) {
          nextRow.updated_at = nowIso();
        }
        updateRow(table, nextRow);
        if (table === "invoices") {
          handleInvoiceMutation(row, nextRow);
        }
        return normalizeRow(table, nextRow);
      });
      return request.selection ? selectProjection(table, updatedRows, request) : null;
    }

    if (request.action === "delete") {
      for (const row of matchingRows) {
        deleteRow(table, row.id);
      }
      return null;
    }

    return null;
  });
}

function selectProjection(table, rows, request) {
  const projected = projectRows(table, rows, request.selection);
  return request.single ? projected[0] || null : projected;
}

async function query(request) {
  try {
    ensureInitialized();
    if (!QUERYABLE_TABLES.has(request.table)) {
      throw new Error(`Unsupported table: ${request.table}`);
    }

    const table = request.table;
    const normalizedRequest = {
      action: request.action || "select",
      selection: request.selection || "*",
      filters: request.filters || [],
      orderBy: request.orderBy || null,
      limit: request.limit ?? null,
      offset: request.offset ?? null,
      count: request.count ?? null,
      single: Boolean(request.single),
      payload: request.payload ? sanitizeValue(request.payload) : null,
    };

    if (normalizedRequest.action === "select") {
      const result = selectRows(table, normalizedRequest);
      return createResponse(result.data, null, result.count);
    }

    return createResponse(mutateRows(table, normalizedRequest));
  } catch (error) {
    return createResponse(null, error);
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, encodedHash) {
  const [salt, storedHash] = String(encodedHash).split(":");
  const calculatedHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(calculatedHash, "hex"));
}

function getMeta(key) {
  const statement = db.prepare(`SELECT value FROM app_meta WHERE key = ?`);
  statement.bind([key]);
  const hasValue = statement.step();
  const value = hasValue ? statement.getAsObject().value : null;
  statement.free();
  return value;
}

function setMeta(key, value) {
  runStatement(
    `INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

function clearMeta(key) {
  runStatement(`DELETE FROM app_meta WHERE key = ?`, [key]);
}

function buildUser(userRow) {
  if (!userRow) {
    return null;
  }

  const profile = readAllRows("profiles").find((row) => row.user_id === userRow.id);
  return {
    id: userRow.id,
    email: userRow.email,
    created_at: userRow.created_at,
    user_metadata: {
      name: profile?.name || "",
    },
  };
}

function buildSession(userRow) {
  const user = buildUser(userRow);
  if (!user) {
    return null;
  }
  return { user };
}

function getCurrentUserRow() {
  const currentUserId = getMeta("current_user_id");
  if (!currentUserId) {
    return null;
  }
  return readAllRows("app_users").find((row) => row.id === currentUserId) || null;
}

function getSession() {
  try {
    ensureInitialized();
    const currentUser = getCurrentUserRow();
    return createResponse({ session: buildSession(currentUser) });
  } catch (error) {
    return createResponse(null, error);
  }
}

function signUp(payload) {
  try {
    ensureInitialized();
    const { email, password, options } = payload || {};
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const existing = readAllRows("app_users").find((row) => row.email.toLowerCase() === String(email).toLowerCase());
    if (existing) {
      throw new Error("An account with this email already exists");
    }

    return createResponse(
      withTransaction(() => {
        const timestamp = nowIso();
        const userId = crypto.randomUUID();

        insertRow("app_users", {
          id: userId,
          email: String(email).trim().toLowerCase(),
          password_hash: hashPassword(password),
          created_at: timestamp,
          updated_at: timestamp,
        });

        insertRow(
          "profiles",
          applyInsertDefaults("profiles", {
            user_id: userId,
            name: options?.data?.name || "",
          })
        );

        setMeta("current_user_id", userId);

        const userRow = readAllRows("app_users").find((row) => row.id === userId);
        return {
          user: buildUser(userRow),
          session: buildSession(userRow),
        };
      })
    );
  } catch (error) {
    return createResponse(null, error);
  }
}

function signIn(payload) {
  try {
    ensureInitialized();
    const { email, password } = payload || {};
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const userRow = readAllRows("app_users").find((row) => row.email.toLowerCase() === String(email).toLowerCase());
    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      throw new Error("Invalid email or password");
    }

    return createResponse(
      withTransaction(() => {
        setMeta("current_user_id", userRow.id);
        return {
          user: buildUser(userRow),
          session: buildSession(userRow),
        };
      })
    );
  } catch (error) {
    return createResponse(null, error);
  }
}

function signOut() {
  try {
    ensureInitialized();
    return createResponse(
      withTransaction(() => {
        clearMeta("current_user_id");
        return { session: null };
      })
    );
  } catch (error) {
    return createResponse(null, error);
  }
}

function updateUser(payload) {
  try {
    ensureInitialized();
    const currentUser = getCurrentUserRow();
    if (!currentUser) {
      throw new Error("No active session");
    }

    return createResponse(
      withTransaction(() => {
        const nextUser = {
          ...currentUser,
          updated_at: nowIso(),
        };

        if (payload?.password) {
          nextUser.password_hash = hashPassword(payload.password);
        }

        updateRow("app_users", nextUser);
        return {
          user: buildUser(nextUser),
          session: buildSession(nextUser),
        };
      })
    );
  } catch (error) {
    return createResponse(null, error);
  }
}

function resetPasswordForEmail() {
  return createResponse(null, new Error("Email reset is not available in the offline desktop app"));
}

function createBackup(filePath) {
  try {
    ensureInitialized();
    fs.writeFileSync(filePath, Buffer.from(db.export()));
    return createResponse({ path: filePath });
  } catch (error) {
    return createResponse(null, error);
  }
}

function restoreBackup(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("Backup file not found");
    }
    db = new SQL.Database(fs.readFileSync(filePath));
    db.exec(getSchemaSql());
    runSchemaMigrations();
    saveDatabase();
    return createResponse({ path: filePath });
  } catch (error) {
    return createResponse(null, error);
  }
}

module.exports = {
  initializeDatabase,
  query,
  auth: {
    getSession,
    signUp,
    signIn,
    signOut,
    updateUser,
    resetPasswordForEmail,
  },
  backup: {
    createBackup,
    restoreBackup,
  },
};
