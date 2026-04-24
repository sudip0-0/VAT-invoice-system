# Desktop Database Commands

This app stores all data locally in a **SQLite** file managed by `sql.js`. The file lives inside Electron's `userData` directory.

## Database Location

| OS | Path |
|---|---|
| Windows | `C:\Users\<username>\AppData\Roaming\vite_react_shadcn_ts\vat-invoice.sqlite` |
| macOS | `~/Library/Application Support/vite_react_shadcn_ts/vat-invoice.sqlite` |
| Linux | `~/.config/vite_react_shadcn_ts/vat-invoice.sqlite` |

> **Note:** During development the folder name is `vite_react_shadcn_ts` (package name). After packaging it becomes `Vyapar Nepal`.

---

## Quick Scripts (No External Tools)

These use the project's built-in `sql.js` dependency.

### List Users
```powershell
node scripts/list-users.cjs
```

### View Raw Tables
Create a temporary script inline:
```powershell
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');
const initSqlJs = require('sql.js');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'vite_react_shadcn_ts', 'vat-invoice.sqlite');
initSqlJs({ locateFile: f => require.resolve('sql.js/dist/' + f) }).then(SQL => {
  const db = new SQL.Database(fs.readFileSync(dbPath));
  const stmt = db.prepare('SELECT * FROM app_users');
  while (stmt.step()) console.log(stmt.getAsObject());
  stmt.free();
});
"
```

---

## SQLite3 CLI Commands

If you have the `sqlite3` command installed (`winget install SQLite.SQLite` on Windows):

### Connect Interactively
```powershell
sqlite3 "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite"
```

### List All Tables
```powershell
sqlite3 "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite" ".tables"
```

### List All Users
```powershell
sqlite3 "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite" -header -table "SELECT u.id, u.email, COALESCE(p.name, '') AS name, COALESCE(p.phone, '') AS phone, u.created_at FROM app_users u LEFT JOIN profiles p ON u.id = p.user_id;"
```

### List All Businesses
```powershell
sqlite3 "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite" -header -table "SELECT id, name, type, city, phone, pan_number, is_vat_registered, created_at FROM businesses WHERE deleted_at IS NULL;"
```

### List Business Memberships
```powershell
sqlite3 "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite" -header -table "SELECT bu.user_id, au.email, bu.business_id, b.name AS business_name, bu.role, bu.is_active FROM business_users bu JOIN app_users au ON bu.user_id = au.id JOIN businesses b ON bu.business_id = b.id;"
```

### Count Invoices
```powershell
sqlite3 "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite" -header -table "SELECT status, COUNT(*) AS count FROM invoices WHERE deleted_at IS NULL GROUP BY status;"
```

### Total Sales Amount
```powershell
sqlite3 "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite" -header -table "SELECT SUM(total_amount) AS total_sales FROM invoices WHERE type = 'sale' AND status != 'cancelled' AND deleted_at IS NULL;"
```

### List Parties (Customers/Vendors)
```powershell
sqlite3 "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite" -header -table "SELECT name, type, phone, city, opening_balance FROM parties WHERE is_active = 1 AND deleted_at IS NULL ORDER BY name;"
```

### List Inventory Items
```powershell
sqlite3 "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite" -header -table "SELECT name, code, current_stock, sale_price, type FROM items WHERE is_active = 1 AND deleted_at IS NULL ORDER BY name;"
```

---

## Backup & Restore

### Create a Backup (Manual)
```powershell
Copy-Item "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite" "$env:USERPROFILE\Desktop\vyapar-backup-$(Get-Date -Format yyyyMMdd-HHmmss).sqlite"
```

### Restore from Backup
```powershell
# Close the app first, then:
Copy-Item "$env:USERPROFILE\Desktop\vyapar-backup.sqlite" "$env:APPDATA\vite_react_shadcn_ts\vat-invoice.sqlite"
```

---

## Useful SQL Snippets

Run these inside `sqlite3` interactive mode or with the `-header -table` flags.

### Show database schema
```sql
.schema
```

### Show table info
```sql
PRAGMA table_info(app_users);
PRAGMA table_info(profiles);
PRAGMA table_info(businesses);
PRAGMA table_info(invoices);
```

### Find invoices by date range
```sql
SELECT invoice_number, total_amount, status, issued_date_ad
FROM invoices
WHERE issued_date_ad >= '2026-04-01' AND issued_date_ad < '2026-05-01'
AND deleted_at IS NULL;
```

### Outstanding payments
```sql
SELECT i.invoice_number, p.name AS customer, i.balance_due, i.due_date_ad
FROM invoices i
LEFT JOIN parties p ON i.customer_id = p.id
WHERE i.balance_due > 0 AND i.status != 'cancelled' AND i.deleted_at IS NULL;
```

### Low stock items
```sql
SELECT name, code, current_stock, low_stock_alert
FROM items
WHERE low_stock_alert IS NOT NULL
AND current_stock <= low_stock_alert
AND is_active = 1 AND deleted_at IS NULL;
```

### Payments by method
```sql
SELECT method, COUNT(*) AS count, SUM(amount) AS total
FROM payments
GROUP BY method;
```

---

## Tips

- The database file is a standard SQLite file — you can open it with **DB Browser for SQLite**, **DBeaver**, or any SQLite client.
- Always **close the app** before copying/restoring the database file to avoid corruption.
- During `npm run dev:desktop`, the database path is determined by Electron's `app.getPath('userData')`, which uses the `name` field from `package.json` in development.
