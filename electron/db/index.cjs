const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const initSqlJs = require("sql.js");
const { logger } = require("../logger.cjs");
const { SCHEMA_VERSION, runMigrations } = require("./migrations/runner.cjs");
const {
  QUERYABLE_TABLES,
  TABLES_WITH_BUSINESS_ID,
  CHILD_OWNERSHIP,
} = require("./constants.cjs");

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

async function openDatabaseAt(filePath, { userDataDirForLogs } = {}) {
  SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });

  dbPath = filePath;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (userDataDirForLogs) {
    logger.init(userDataDirForLogs);
  }

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  db.exec(getSchemaSql());
  runSchemaMigrations();
  setMeta("schema_version", String(SCHEMA_VERSION));
  saveDatabase();
  return { dbPath };
}

async function initializeDatabase(app) {
  if (db) {
    return { dbPath };
  }

  appInstance = app;
  const userDataDir = app.getPath("userData");
  fs.mkdirSync(userDataDir, { recursive: true });
  return openDatabaseAt(path.join(userDataDir, "vat-invoice.sqlite"), {
    userDataDirForLogs: userDataDir,
  });
}

async function initializeDatabaseForTests(filePath) {
  db = null;
  SQL = null;
  dbPath = "";
  appInstance = null;
  return openDatabaseAt(filePath, { userDataDirForLogs: path.dirname(filePath) });
}

function saveDatabase() {
  ensureInitialized();
  const payload = Buffer.from(db.export());
  const tempPath = `${dbPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, payload);
  try {
    fs.renameSync(tempPath, dbPath);
  } catch {
    fs.copyFileSync(tempPath, dbPath);
    fs.unlinkSync(tempPath);
  }
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
  runMigrations({
    columnExists,
    runStatement,
    quoteIdentifier,
  });
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

function getAllowedBusinessIds(userId) {
  return readFilteredRows("business_users", [
    { type: "eq", column: "user_id", value: userId },
    { type: "eq", column: "is_active", value: true },
  ]).map((row) => row.business_id);
}

function assertSession() {
  const user = getCurrentUserRow();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

function assertBusinessAccess(userId, businessId) {
  if (!businessId || !getAllowedBusinessIds(userId).includes(businessId)) {
    throw new Error("Forbidden: business access denied");
  }
}

function allowedInvoiceIds(userId) {
  const businessIds = getAllowedBusinessIds(userId);
  if (businessIds.length === 0) {
    return [];
  }
  return readFilteredRows("invoices", [{ type: "in", column: "business_id", value: businessIds }]).map(
    (row) => row.id
  );
}

function applyMembershipScope(table, request, user) {
  const action = request.action || "select";
  const filters = [...(request.filters || [])];
  const allowedBusinessIds = getAllowedBusinessIds(user.id);

  if (table === "profiles") {
    filters.push({ type: "eq", column: "user_id", value: user.id });
    if (action === "insert") {
      const payloads = Array.isArray(request.payload) ? request.payload : [request.payload];
      for (const payload of payloads) {
        if (payload?.user_id && payload.user_id !== user.id) {
          throw new Error("Forbidden: cannot write another user's profile");
        }
        if (payload) {
          payload.user_id = user.id;
        }
      }
    }
    return { ...request, filters };
  }

  if (table === "business_users") {
    filters.push({ type: "eq", column: "user_id", value: user.id });
    if (action === "insert") {
      const payloads = Array.isArray(request.payload) ? request.payload : [request.payload];
      for (const payload of payloads) {
        if (!payload?.business_id) {
          throw new Error("business_id is required");
        }
        if (payload.user_id && payload.user_id !== user.id) {
          throw new Error("Forbidden: cannot create membership for another user");
        }
        payload.user_id = user.id;
      }
    }
    return { ...request, filters };
  }

  if (table === "businesses") {
    if (action === "insert") {
      return { ...request, filters };
    }
    filters.push({ type: "in", column: "id", value: allowedBusinessIds.length ? allowedBusinessIds : ["__none__"] });
    return { ...request, filters };
  }

  if (CHILD_OWNERSHIP[table]) {
    const invoiceIds = allowedInvoiceIds(user.id);
    filters.push({
      type: "in",
      column: CHILD_OWNERSHIP[table].foreignKey,
      value: invoiceIds.length ? invoiceIds : ["__none__"],
    });
    if (action === "insert") {
      const payloads = Array.isArray(request.payload) ? request.payload : [request.payload];
      for (const payload of payloads) {
        const parentId = payload?.[CHILD_OWNERSHIP[table].foreignKey];
        const parent = readFilteredRows(CHILD_OWNERSHIP[table].parentTable, [
          { type: "eq", column: "id", value: parentId },
        ])[0];
        if (!parent || !allowedBusinessIds.includes(parent.business_id)) {
          throw new Error("Forbidden: parent document access denied");
        }
      }
    }
    return { ...request, filters };
  }

  if (TABLES_WITH_BUSINESS_ID.has(table)) {
    filters.push({
      type: "in",
      column: "business_id",
      value: allowedBusinessIds.length ? allowedBusinessIds : ["__none__"],
    });
    if (action === "insert") {
      const payloads = Array.isArray(request.payload) ? request.payload : [request.payload];
      for (const payload of payloads) {
        assertBusinessAccess(user.id, payload?.business_id);
      }
    }
  }

  return { ...request, filters };
}

async function query(request) {
  try {
    ensureInitialized();
    if (!QUERYABLE_TABLES.has(request.table)) {
      throw new Error(`Unsupported table: ${request.table}`);
    }

    const user = assertSession();
    const table = request.table;
    const scoped = applyMembershipScope(table, request, user);
    const normalizedRequest = {
      action: scoped.action || "select",
      selection: scoped.selection || "*",
      filters: scoped.filters || [],
      orderBy: scoped.orderBy || null,
      limit: scoped.limit ?? null,
      offset: scoped.offset ?? null,
      count: scoped.count ?? null,
      single: Boolean(scoped.single),
      payload: scoped.payload ? sanitizeValue(scoped.payload) : null,
    };

    if (normalizedRequest.action === "select") {
      const result = selectRows(table, normalizedRequest);
      return createResponse(result.data, null, result.count);
    }

    return createResponse(mutateRows(table, normalizedRequest));
  } catch (error) {
    logger.warn("query_denied_or_failed", { table: request?.table, message: error.message });
    return createResponse(null, error);
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, encodedHash) {
  try {
    const [salt, storedHash] = String(encodedHash || "").split(":");
    if (!salt || !storedHash || storedHash.length % 2 !== 0) {
      return false;
    }
    const calculatedHash = crypto.scryptSync(password, salt, 64).toString("hex");
    const stored = Buffer.from(storedHash, "hex");
    const calculated = Buffer.from(calculatedHash, "hex");
    if (stored.length !== calculated.length) {
      return false;
    }
    return crypto.timingSafeEqual(stored, calculated);
  } catch {
    return false;
  }
}

function assertPasswordPolicy(password) {
  if (!password || String(password).length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
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
    assertPasswordPolicy(password);

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
        logger.info("auth_sign_up", { email: String(email).trim().toLowerCase() });
        return {
          user: buildUser(userRow),
          session: buildSession(userRow),
        };
      })
    );
  } catch (error) {
    logger.warn("auth_sign_up_failed", { message: error.message });
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
        logger.info("auth_sign_in", { email: userRow.email });
        return {
          user: buildUser(userRow),
          session: buildSession(userRow),
        };
      })
    );
  } catch (error) {
    logger.warn("auth_sign_in_failed", { email: payload?.email, message: error.message });
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
          assertPasswordPolicy(payload.password);
          if (!payload.currentPassword) {
            throw new Error("Current password is required");
          }
          if (!verifyPassword(payload.currentPassword, currentUser.password_hash)) {
            throw new Error("Current password is incorrect");
          }
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
    logger.warn("auth_update_user_failed", { message: error.message });
    return createResponse(null, error);
  }
}

function resetPasswordForEmail() {
  return createResponse(null, new Error("Email reset is not available in the offline desktop app"));
}

function sha256FileBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function createBackup(filePath) {
  try {
    ensureInitialized();
    assertSession();
    const exported = Buffer.from(db.export());
    fs.writeFileSync(filePath, exported);
    const checksum = sha256FileBuffer(exported);
    fs.writeFileSync(`${filePath}.sha256`, `${checksum}  ${path.basename(filePath)}\n`, "utf8");
    logger.info("backup_created", { path: filePath });
    return createResponse({ path: filePath, checksum });
  } catch (error) {
    logger.error("backup_failed", { message: error.message });
    return createResponse(null, error);
  }
}

function getSchemaVersionFromDb(database) {
  try {
    const statement = database.prepare(`SELECT value FROM app_meta WHERE key = ?`);
    statement.bind(["schema_version"]);
    const hasValue = statement.step();
    const value = hasValue ? Number(statement.getAsObject().value || 0) : 0;
    statement.free();
    return value;
  } catch {
    return 0;
  }
}

function restoreBackup(filePath) {
  try {
    ensureInitialized();
    assertSession();
    if (!fs.existsSync(filePath)) {
      throw new Error("Backup file not found");
    }

    const checksumPath = `${filePath}.sha256`;
    const fileBuffer = fs.readFileSync(filePath);
    if (fs.existsSync(checksumPath)) {
      const expected = String(fs.readFileSync(checksumPath, "utf8").split(/\s+/)[0] || "").trim();
      const actual = sha256FileBuffer(fileBuffer);
      if (!expected || expected !== actual) {
        throw new Error("Backup checksum mismatch");
      }
    }

    const candidate = new SQL.Database(fileBuffer);
    const backupVersion = getSchemaVersionFromDb(candidate);
    if (backupVersion > SCHEMA_VERSION) {
      candidate.close();
      throw new Error(
        `Backup schema version ${backupVersion} is newer than app version ${SCHEMA_VERSION}`
      );
    }

    const safetyPath = `${dbPath}.pre-restore-${Date.now()}.sqlite`;
    fs.copyFileSync(dbPath, safetyPath);

    db = candidate;
    db.exec(getSchemaSql());
    runSchemaMigrations();
    setMeta("schema_version", String(SCHEMA_VERSION));
    saveDatabase();
    logger.info("backup_restored", { path: filePath, safetyPath });
    return createResponse({ path: filePath, safetyPath });
  } catch (error) {
    logger.error("backup_restore_failed", { message: error.message });
    return createResponse(null, error);
  }
}

function syncAuditHash(input) {
  const payload = JSON.stringify({
    business_id: input.business_id,
    invoice_id: input.invoice_id,
    action: input.action,
    details: input.details || "",
    created_at: input.created_at,
    previous_hash: input.previous_hash || "",
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function appendInvoiceEvent({ businessId, invoiceId, userId, action, details }) {
  const existing = readFilteredRows("invoice_events", [
    { type: "eq", column: "invoice_id", value: invoiceId },
  ]);
  existing.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const previousHash = existing.length ? existing[existing.length - 1].event_hash || "" : "";
  const createdAt = nowIso();
  const detailsText = details ? JSON.stringify(details) : null;
  const eventHash = syncAuditHash({
    business_id: businessId,
    invoice_id: invoiceId,
    action,
    details: detailsText,
    created_at: createdAt,
    previous_hash: previousHash,
  });
  insertRow(
    "invoice_events",
    applyInsertDefaults("invoice_events", {
      business_id: businessId,
      invoice_id: invoiceId,
      user_id: userId || null,
      action,
      details: detailsText,
      previous_hash: previousHash,
      event_hash: eventHash,
      created_at: createdAt,
    })
  );
}

function formatDocumentNumber(type, invoicePrefix, nextInvoiceNum, fallback) {
  const serial = String(nextInvoiceNum || 1).padStart(4, "0");
  if (type === "purchase") return `PUR-${serial}`;
  if (type === "quotation") return `QTN-${serial}`;
  if (type === "sale_return") return `CN-${serial}`;
  if (type === "purchase_return") return `DN-${serial}`;
  if (type === "sale") return `${invoicePrefix || "INV"}-${serial}`;
  return fallback || `${invoicePrefix || "INV"}-${serial}`;
}

function getDocumentCounterColumn(type) {
  if (type === "purchase") return "next_purchase_bill_num";
  if (type === "quotation") return "next_quotation_num";
  if (type === "sale_return") return "next_credit_note_num";
  if (type === "purchase_return") return "next_debit_note_num";
  return "next_sales_invoice_num";
}

function reserveDocumentNumber(businessId, type, fiscalYearInput) {
  const fiscalYear = String(fiscalYearInput || nowIso().slice(0, 4));
  const documentType = type || "sale";
  let sequence = readFilteredRows("document_sequences", [
    { type: "eq", column: "business_id", value: businessId },
    { type: "eq", column: "document_type", value: documentType },
    { type: "eq", column: "fiscal_year", value: fiscalYear },
  ])[0];

  if (!sequence) {
    sequence = applyInsertDefaults("document_sequences", {
      business_id: businessId,
      document_type: documentType,
      fiscal_year: fiscalYear,
      next_serial: 1,
    });
    insertRow("document_sequences", sequence);
  }

  const reserved = Number(sequence.next_serial || 1);
  updateRow("document_sequences", {
    ...sequence,
    next_serial: reserved + 1,
    updated_at: nowIso(),
  });

  const business = readFilteredRows("businesses", [{ type: "eq", column: "id", value: businessId }])[0];
  const counterColumn = getDocumentCounterColumn(type);
  if (business) {
    updateRow("businesses", {
      ...business,
      [counterColumn]: Math.max(Number(business[counterColumn] || 1), reserved + 1),
      updated_at: nowIso(),
    });
  }

  return {
    reservedInvoiceNum: reserved,
    fiscalYear,
    invoicePrefix: business?.invoice_prefix || "INV",
    invoiceNumber: formatDocumentNumber(type, business?.invoice_prefix, reserved, null),
  };
}

function createAndIssueDocument(payload) {
  try {
    ensureInitialized();
    const user = assertSession();
    const { invoice, items = [], paymentAmount = 0 } = payload || {};
    if (!invoice?.business_id) {
      throw new Error("business_id is required");
    }
    assertBusinessAccess(user.id, invoice.business_id);

    return createResponse(
      withTransaction(() => {
        const invoiceId = invoice.id || crypto.randomUUID();
        const desiredStatus = invoice.status || "draft";
        const paidAmount = Number(paymentAmount || invoice.paid_amount || 0);
        const reserved = reserveDocumentNumber(
          invoice.business_id,
          invoice.type,
          invoice.fiscal_year
        );

        let finalStatus = desiredStatus;
        if (desiredStatus === "issued" && paidAmount > 0) {
          const total = Number(invoice.total_amount || 0);
          finalStatus = paidAmount >= total ? "paid" : "partially_paid";
        }

        const invoiceRow = applyInsertDefaults("invoices", {
          ...invoice,
          id: invoiceId,
          invoice_number: reserved.invoiceNumber,
          fiscal_year: invoice.fiscal_year || reserved.fiscalYear,
          document_serial: reserved.reservedInvoiceNum,
          status: "draft",
          paid_amount: paidAmount,
          balance_due: Math.max(0, Number(invoice.total_amount || 0) - paidAmount),
        });
        insertRow("invoices", invoiceRow);

        for (const [idx, item] of items.entries()) {
          insertRow(
            "invoice_items",
            applyInsertDefaults("invoice_items", {
              ...item,
              invoice_id: invoiceId,
              sort_order: idx,
            })
          );
        }

        if (finalStatus !== "draft") {
          const issued = { ...invoiceRow, status: finalStatus, updated_at: nowIso() };
          updateRow("invoices", issued);
          handleInvoiceMutation(invoiceRow, issued);
          Object.assign(invoiceRow, issued);
        }

        appendInvoiceEvent({
          businessId: invoice.business_id,
          invoiceId,
          userId: user.id,
          action: finalStatus === "draft" ? "draft_created" : "issued",
          details: {
            invoice_number: invoiceRow.invoice_number,
            type: invoiceRow.type,
            status: finalStatus,
          },
        });

        if (paidAmount > 0 && desiredStatus !== "draft") {
          const partyId = invoice.customer_id || invoice.vendor_id || null;
          insertRow(
            "payments",
            applyInsertDefaults("payments", {
              business_id: invoice.business_id,
              invoice_id: invoiceId,
              party_id: partyId,
              amount: paidAmount,
              method: "cash",
              status: "completed",
              payment_date_ad: invoice.issued_date_ad || nowIso().slice(0, 10),
              payment_date_bs: invoice.issued_date_bs || "",
              notes: `Payment received on invoice ${invoiceRow.invoice_number}`,
            })
          );
          appendInvoiceEvent({
            businessId: invoice.business_id,
            invoiceId,
            userId: user.id,
            action: "payment_recorded",
            details: { amount: paidAmount, method: "cash", status: "completed" },
          });
        }

        return { id: invoiceId, invoice_number: invoiceRow.invoice_number, status: finalStatus };
      })
    );
  } catch (error) {
    logger.error("documents_create_failed", { message: error.message });
    return createResponse(null, error);
  }
}

function adjustStockAtomic(payload) {
  try {
    ensureInitialized();
    const user = assertSession();
    const { business_id, item_id, quantity, direction, reason } = payload || {};
    assertBusinessAccess(user.id, business_id);
    if (!item_id || !quantity || !direction) {
      throw new Error("item_id, quantity, and direction are required");
    }

    return createResponse(
      withTransaction(() => {
        const item = readFilteredRows("items", [
          { type: "eq", column: "id", value: item_id },
          { type: "eq", column: "business_id", value: business_id },
        ])[0];
        if (!item) {
          throw new Error("Item not found");
        }
        const oldStock = Number(item.current_stock || 0);
        const qty = Number(quantity);
        const newStock = direction === "in" ? oldStock + qty : oldStock - qty;
        if (newStock < 0) {
          throw new Error("Stock cannot go below zero");
        }
        updateRow("items", {
          ...item,
          current_stock: newStock,
          updated_at: nowIso(),
        });
        insertRow(
          "stock_movements",
          applyInsertDefaults("stock_movements", {
            business_id,
            item_id,
            quantity: qty,
            direction,
            reason: reason || "manual",
            stock_before: oldStock,
            stock_after: newStock,
          })
        );
        return { item_id, stock_before: oldStock, stock_after: newStock };
      })
    );
  } catch (error) {
    logger.error("stock_adjust_failed", { message: error.message });
    return createResponse(null, error);
  }
}

module.exports = {
  initializeDatabase,
  initializeDatabaseForTests,
  SCHEMA_VERSION,
  query,
  documents: {
    createAndIssue: createAndIssueDocument,
  },
  stock: {
    adjust: adjustStockAtomic,
  },
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
  __test: {
    verifyPassword,
    hashPassword,
    isAllowedExternalUrl: require("../security/open-external.cjs").isAllowedExternalUrl,
  },
};
