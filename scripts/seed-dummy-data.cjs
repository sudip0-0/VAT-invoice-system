const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const initSqlJs = require("sql.js");

const DB_PATH = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "vite_react_shadcn_ts",
  "vat-invoice.sqlite"
);

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  return crypto.randomUUID();
}

function run(db, sql, params) {
  const stmt = db.prepare(sql);
  stmt.run(params || []);
  stmt.free();
}

function queryOne(db, sql, params) {
  const stmt = db.prepare(sql);
  stmt.bind(params || []);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error("Database not found:", DB_PATH);
    process.exit(1);
  }

  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });

  const db = new SQL.Database(fs.readFileSync(DB_PATH));
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("BEGIN TRANSACTION");

  try {
    // 1. Find user
    const user = queryOne(db, "SELECT id FROM app_users WHERE email = ?", [
      "sudip@gmail.com",
    ]);
    if (!user) {
      throw new Error('User "sudip@gmail.com" not found.');
    }
    const userId = user.id;

    // 2. Find or create business "abcd"
    let business = queryOne(
      db,
      `SELECT b.id FROM businesses b
       JOIN business_users bu ON b.id = bu.business_id
       WHERE b.name = ? AND bu.user_id = ?`,
      ["abcd", userId]
    );

    let businessId;
    if (business) {
      businessId = business.id;
      console.log('Deleting existing business "abcd" and its data...');
      // Clear active business reference before delete to avoid dangling FK
      run(db, "UPDATE profiles SET active_business_id = NULL WHERE active_business_id = ?", [businessId]);
      run(db, "DELETE FROM businesses WHERE id = ?", [businessId]);
      console.log('Existing business "abcd" removed.');
    }

    businessId = uuid();
    run(
      db,
      `INSERT INTO businesses (
        id, name, type, pan_number, is_vat_registered, address, city, province,
        phone, email, logo_url, fiscal_year_start, invoice_prefix,
        next_invoice_num, currency, created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        businessId,
        "abcd",
        "retail",
        "123456789",
        1,
        "New Road",
        "Kathmandu",
        null,
        "01-4444444",
        null,
        null,
        4,
        "INV",
        100,
        "NPR",
        nowIso(),
        nowIso(),
        null,
      ]
    );

    run(
      db,
      `INSERT INTO business_users (
        id, business_id, user_id, role, is_active, joined_at
      ) VALUES (?,?,?,?,?,?)`,
      [uuid(), businessId, userId, "owner", 1, nowIso()]
    );
    console.log('Created business "abcd".');

    // 3. Update profile active business
    run(db, "UPDATE profiles SET active_business_id = ? WHERE user_id = ?", [
      businessId,
      userId,
    ]);

    // 4. Tax rates
    const taxVatId = uuid();
    const taxExemptId = uuid();
    const taxZeroId = uuid();

    run(
      db,
      `INSERT INTO tax_rates (id, business_id, name, type, rate, is_default, is_active, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [taxVatId, businessId, "VAT 13%", "vat_13", 13.0, 1, 1, nowIso()]
    );
    run(
      db,
      `INSERT INTO tax_rates (id, business_id, name, type, rate, is_default, is_active, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [taxExemptId, businessId, "Exempt", "exempt", 0, 0, 1, nowIso()]
    );
    run(
      db,
      `INSERT INTO tax_rates (id, business_id, name, type, rate, is_default, is_active, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [taxZeroId, businessId, "Zero Rated", "zero_rated", 0, 0, 1, nowIso()]
    );

    // 5. Categories
    const catElectronicsId = uuid();
    const catGroceriesId = uuid();
    const catClothingId = uuid();

    run(
      db,
      `INSERT INTO item_categories (id, business_id, name, parent_id, created_at)
       VALUES (?,?,?,?,?)`,
      [catElectronicsId, businessId, "Electronics", null, nowIso()]
    );
    run(
      db,
      `INSERT INTO item_categories (id, business_id, name, parent_id, created_at)
       VALUES (?,?,?,?,?)`,
      [catGroceriesId, businessId, "Groceries", null, nowIso()]
    );
    run(
      db,
      `INSERT INTO item_categories (id, business_id, name, parent_id, created_at)
       VALUES (?,?,?,?,?)`,
      [catClothingId, businessId, "Clothing", null, nowIso()]
    );

    // 6. Items
    const itemLaptopId = uuid();
    const itemRiceId = uuid();
    const itemTshirtId = uuid();

    run(
      db,
      `INSERT INTO items (
        id, business_id, category_id, tax_rate_id, code, name, description,
        type, unit, purchase_price, sale_price, opening_stock, current_stock,
        low_stock_alert, hsn_code, is_active, created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        itemLaptopId,
        businessId,
        catElectronicsId,
        taxVatId,
        "LAP-001",
        "Laptop",
        "15.6 inch business laptop",
        "product",
        "PCS",
        85000,
        100000,
        10,
        9,
        2,
        null,
        1,
        nowIso(),
        nowIso(),
        null,
      ]
    );

    run(
      db,
      `INSERT INTO items (
        id, business_id, category_id, tax_rate_id, code, name, description,
        type, unit, purchase_price, sale_price, opening_stock, current_stock,
        low_stock_alert, hsn_code, is_active, created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        itemRiceId,
        businessId,
        catGroceriesId,
        taxVatId,
        "RIC-001",
        "Rice 25kg",
        "Premium basmati rice",
        "product",
        "BAG",
        2200,
        2500,
        50,
        55,
        10,
        null,
        1,
        nowIso(),
        nowIso(),
        null,
      ]
    );

    run(
      db,
      `INSERT INTO items (
        id, business_id, category_id, tax_rate_id, code, name, description,
        type, unit, purchase_price, sale_price, opening_stock, current_stock,
        low_stock_alert, hsn_code, is_active, created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        itemTshirtId,
        businessId,
        catClothingId,
        taxVatId,
        "TSH-001",
        "T-Shirt",
        "Cotton round neck",
        "product",
        "PCS",
        900,
        1500,
        30,
        45,
        5,
        null,
        1,
        nowIso(),
        nowIso(),
        null,
      ]
    );

    // 7. Parties
    const partyRamId = uuid();
    const partySitaId = uuid();
    const partyEverestId = uuid();

    run(
      db,
      `INSERT INTO parties (
        id, business_id, type, name, phone, email, pan_number, address, city,
        opening_balance, credit_limit, credit_days, notes, is_active, created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        partyRamId,
        businessId,
        "customer",
        "Ram Kumar",
        "9800000001",
        null,
        null,
        "Baneswor",
        "Kathmandu",
        0,
        null,
        30,
        null,
        1,
        nowIso(),
        nowIso(),
        null,
      ]
    );

    run(
      db,
      `INSERT INTO parties (
        id, business_id, type, name, phone, email, pan_number, address, city,
        opening_balance, credit_limit, credit_days, notes, is_active, created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        partySitaId,
        businessId,
        "customer",
        "Sita Devi",
        "9800000002",
        null,
        null,
        "Patan",
        "Lalitpur",
        0,
        null,
        30,
        null,
        1,
        nowIso(),
        nowIso(),
        null,
      ]
    );

    run(
      db,
      `INSERT INTO parties (
        id, business_id, type, name, phone, email, pan_number, address, city,
        opening_balance, credit_limit, credit_days, notes, is_active, created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        partyEverestId,
        businessId,
        "vendor",
        "Everest Suppliers",
        "01-5555555",
        null,
        null,
        "Thamel",
        "Kathmandu",
        0,
        null,
        30,
        null,
        1,
        nowIso(),
        nowIso(),
        null,
      ]
    );

    // 8. Invoices
    const inv1Id = uuid();
    const inv2Id = uuid();
    const inv3Id = uuid();
    const dateIssued = "2026-04-20";
    const dateDue = "2026-05-20";
    const dateBs = "2083-01-07";
    const dateDueBs = "2083-02-06";

    // Invoice 1 - Sale (Paid)
    run(
      db,
      `INSERT INTO invoices (
        id, business_id, type, status, invoice_number, reference_number,
        customer_id, vendor_id, issued_date_ad, issued_date_bs, due_date_ad, due_date_bs,
        buyer_pan, is_vat_invoice, vat_period, sub_total, discount_amount, taxable_amount,
        vat_amount, total_amount, paid_amount, balance_due, notes, terms_conditions,
        created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        inv1Id,
        businessId,
        "sale",
        "paid",
        "INV-0001",
        null,
        partyRamId,
        null,
        dateIssued,
        dateBs,
        dateDue,
        dateDueBs,
        null,
        1,
        "2083-01",
        103000,
        0,
        103000,
        13390,
        116390,
        116390,
        0,
        "First sale invoice",
        null,
        nowIso(),
        nowIso(),
        null,
      ]
    );

    // Invoice 2 - Sale (Partially Paid)
    run(
      db,
      `INSERT INTO invoices (
        id, business_id, type, status, invoice_number, reference_number,
        customer_id, vendor_id, issued_date_ad, issued_date_bs, due_date_ad, due_date_bs,
        buyer_pan, is_vat_invoice, vat_period, sub_total, discount_amount, taxable_amount,
        vat_amount, total_amount, paid_amount, balance_due, notes, terms_conditions,
        created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        inv2Id,
        businessId,
        "sale",
        "partially_paid",
        "INV-0002",
        null,
        partySitaId,
        null,
        dateIssued,
        dateBs,
        dateDue,
        dateDueBs,
        null,
        1,
        "2083-01",
        17000,
        0,
        17000,
        2210,
        19210,
        10000,
        9210,
        "Second sale invoice",
        null,
        nowIso(),
        nowIso(),
        null,
      ]
    );

    // Invoice 3 - Purchase (Issued)
    run(
      db,
      `INSERT INTO invoices (
        id, business_id, type, status, invoice_number, reference_number,
        customer_id, vendor_id, issued_date_ad, issued_date_bs, due_date_ad, due_date_bs,
        buyer_pan, is_vat_invoice, vat_period, sub_total, discount_amount, taxable_amount,
        vat_amount, total_amount, paid_amount, balance_due, notes, terms_conditions,
        created_at, updated_at, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        inv3Id,
        businessId,
        "purchase",
        "issued",
        "PUR-0001",
        null,
        null,
        partyEverestId,
        dateIssued,
        dateBs,
        dateDue,
        dateDueBs,
        null,
        1,
        "2083-01",
        40000,
        0,
        40000,
        5200,
        45200,
        0,
        45200,
        "Purchase from vendor",
        null,
        nowIso(),
        nowIso(),
        null,
      ]
    );

    // 9. Invoice Items
    // INV-0001 items
    run(
      db,
      `INSERT INTO invoice_items (
        id, invoice_id, item_id, tax_rate_id, name, description, unit,
        quantity, rate, discount_pct, discount_amt, vat_rate, taxable_amount, vat_amount, total_amount, sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(),
        inv1Id,
        itemLaptopId,
        taxVatId,
        "Laptop",
        "15.6 inch business laptop",
        "PCS",
        1,
        100000,
        0,
        0,
        13,
        100000,
        13000,
        113000,
        0,
      ]
    );
    run(
      db,
      `INSERT INTO invoice_items (
        id, invoice_id, item_id, tax_rate_id, name, description, unit,
        quantity, rate, discount_pct, discount_amt, vat_rate, taxable_amount, vat_amount, total_amount, sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(),
        inv1Id,
        itemTshirtId,
        taxVatId,
        "T-Shirt",
        "Cotton round neck",
        "PCS",
        2,
        1500,
        0,
        0,
        13,
        3000,
        390,
        3390,
        1,
      ]
    );

    // INV-0002 items
    run(
      db,
      `INSERT INTO invoice_items (
        id, invoice_id, item_id, tax_rate_id, name, description, unit,
        quantity, rate, discount_pct, discount_amt, vat_rate, taxable_amount, vat_amount, total_amount, sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(),
        inv2Id,
        itemRiceId,
        taxVatId,
        "Rice 25kg",
        "Premium basmati rice",
        "BAG",
        5,
        2500,
        0,
        0,
        13,
        12500,
        1625,
        14125,
        0,
      ]
    );
    run(
      db,
      `INSERT INTO invoice_items (
        id, invoice_id, item_id, tax_rate_id, name, description, unit,
        quantity, rate, discount_pct, discount_amt, vat_rate, taxable_amount, vat_amount, total_amount, sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(),
        inv2Id,
        itemTshirtId,
        taxVatId,
        "T-Shirt",
        "Cotton round neck",
        "PCS",
        3,
        1500,
        0,
        0,
        13,
        4500,
        585,
        5085,
        1,
      ]
    );

    // PUR-0001 items
    run(
      db,
      `INSERT INTO invoice_items (
        id, invoice_id, item_id, tax_rate_id, name, description, unit,
        quantity, rate, discount_pct, discount_amt, vat_rate, taxable_amount, vat_amount, total_amount, sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(),
        inv3Id,
        itemRiceId,
        taxVatId,
        "Rice 25kg",
        "Premium basmati rice",
        "BAG",
        10,
        2200,
        0,
        0,
        13,
        22000,
        2860,
        24860,
        0,
      ]
    );
    run(
      db,
      `INSERT INTO invoice_items (
        id, invoice_id, item_id, tax_rate_id, name, description, unit,
        quantity, rate, discount_pct, discount_amt, vat_rate, taxable_amount, vat_amount, total_amount, sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(),
        inv3Id,
        itemTshirtId,
        taxVatId,
        "T-Shirt",
        "Cotton round neck",
        "PCS",
        20,
        900,
        0,
        0,
        13,
        18000,
        2340,
        20340,
        1,
      ]
    );

    // 10. Payments
    run(
      db,
      `INSERT INTO payments (
        id, business_id, invoice_id, party_id, amount, method, status,
        payment_date_ad, payment_date_bs, reference, notes, bank_name, cheque_number, cheque_date, gateway_ref_id,
        created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(),
        businessId,
        inv1Id,
        partyRamId,
        116390,
        "cash",
        "completed",
        dateIssued,
        dateBs,
        null,
        "Full payment received",
        null,
        null,
        null,
        null,
        nowIso(),
        nowIso(),
      ]
    );

    run(
      db,
      `INSERT INTO payments (
        id, business_id, invoice_id, party_id, amount, method, status,
        payment_date_ad, payment_date_bs, reference, notes, bank_name, cheque_number, cheque_date, gateway_ref_id,
        created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(),
        businessId,
        inv2Id,
        partySitaId,
        10000,
        "bank_transfer",
        "completed",
        dateIssued,
        dateBs,
        "TXN-001",
        "Partial payment",
        "Nabil Bank",
        null,
        null,
        null,
        nowIso(),
        nowIso(),
      ]
    );

    // 11. Stock movements
    // INV-0001 out
    run(
      db,
      `INSERT INTO stock_movements (
        id, business_id, item_id, invoice_id, quantity, direction, reason, stock_before, stock_after, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), businessId, itemLaptopId, inv1Id, 1, "out", "sale", 10, 9, nowIso()]
    );
    run(
      db,
      `INSERT INTO stock_movements (
        id, business_id, item_id, invoice_id, quantity, direction, reason, stock_before, stock_after, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), businessId, itemTshirtId, inv1Id, 2, "out", "sale", 30, 28, nowIso()]
    );

    // INV-0002 out
    run(
      db,
      `INSERT INTO stock_movements (
        id, business_id, item_id, invoice_id, quantity, direction, reason, stock_before, stock_after, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), businessId, itemRiceId, inv2Id, 5, "out", "sale", 50, 45, nowIso()]
    );
    run(
      db,
      `INSERT INTO stock_movements (
        id, business_id, item_id, invoice_id, quantity, direction, reason, stock_before, stock_after, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), businessId, itemTshirtId, inv2Id, 3, "out", "sale", 28, 25, nowIso()]
    );

    // PUR-0001 in
    run(
      db,
      `INSERT INTO stock_movements (
        id, business_id, item_id, invoice_id, quantity, direction, reason, stock_before, stock_after, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), businessId, itemRiceId, inv3Id, 10, "in", "purchase", 45, 55, nowIso()]
    );
    run(
      db,
      `INSERT INTO stock_movements (
        id, business_id, item_id, invoice_id, quantity, direction, reason, stock_before, stock_after, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), businessId, itemTshirtId, inv3Id, 20, "in", "purchase", 25, 45, nowIso()]
    );

    db.exec("COMMIT");
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));

    console.log("\nDummy data seeded successfully for business 'abcd'.");
    console.log("Summary:");
    console.log("  - 1 business");
    console.log("  - 3 tax rates");
    console.log("  - 3 categories");
    console.log("  - 3 items");
    console.log("  - 3 parties (2 customers, 1 vendor)");
    console.log("  - 3 invoices (2 sales, 1 purchase)");
    console.log("  - 6 invoice line items");
    console.log("  - 2 payments");
    console.log("  - 6 stock movements");
    console.log("\nProfile active_business_id updated. Restart the app to see the data.");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
