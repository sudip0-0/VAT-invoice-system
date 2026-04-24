const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const initSqlJs = require("sql.js");

function getPossibleDbPaths() {
  const platform = os.platform();
  const appNames = ["Vyapar Nepal", "vite_react_shadcn_ts"];

  const candidates = [];

  for (const appName of appNames) {
    if (platform === "win32") {
      candidates.push(path.join(os.homedir(), "AppData", "Roaming", appName, "vat-invoice.sqlite"));
    } else if (platform === "darwin") {
      candidates.push(path.join(os.homedir(), "Library", "Application Support", appName, "vat-invoice.sqlite"));
    } else {
      candidates.push(path.join(os.homedir(), ".config", appName, "vat-invoice.sqlite"));
    }
  }

  return candidates;
}

async function main() {
  const candidates = getPossibleDbPaths();
  const dbPath = candidates.find((p) => fs.existsSync(p));

  if (!dbPath) {
    console.error("Database file not found. Checked these locations:");
    for (const p of candidates) {
      console.error("  " + p);
    }
    console.error("\nMake sure the desktop app has been run at least once.");
    process.exit(1);
  }

  console.log("Using database: " + dbPath + "\n");

  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });

  const db = new SQL.Database(fs.readFileSync(dbPath));

  const statement = db.prepare(`
    SELECT
      u.id,
      u.email,
      COALESCE(p.name, '') AS name,
      COALESCE(p.phone, '') AS phone,
      u.created_at
    FROM app_users u
    LEFT JOIN profiles p ON u.id = p.user_id
    ORDER BY u.created_at DESC
  `);

  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();

  if (rows.length === 0) {
    console.log("No users found.");
    return;
  }

  // Simple table formatting
  const headers = ["Email", "Name", "Phone", "Created At"];
  const cols = ["email", "name", "phone", "created_at"];
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[cols[i]]).length))
  );

  const divider = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";

  function printRow(values) {
    console.log(
      "| " + values.map((v, i) => String(v).padEnd(widths[i])).join(" | ") + " |"
    );
  }

  console.log(divider);
  printRow(headers);
  console.log(divider);
  for (const row of rows) {
    printRow(cols.map((c) => row[c]));
  }
  console.log(divider);
  console.log(`Total users: ${rows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
