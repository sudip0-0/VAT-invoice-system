# Desktop Architecture

## Runtime Shape

- The React/Vite app remains the renderer UI.
- Electron `main` owns the desktop window lifecycle and all local data access.
- Electron `preload` exposes a small, typed bridge into the renderer.
- The renderer never talks to SQLite directly and never depends on Supabase at runtime.

## Data Ownership

- Local persistence is a SQLite database stored in the Electron user data directory.
- The desktop runtime uses SQL.js to manage the database file and flushes changes to disk after write operations.
- Business rules that used to live in database triggers are now enforced in the Electron main process during invoice status changes.

## IPC Boundary

- `desktop:query` handles table-style reads and writes used by the current hooks. Requires an active session and enforces business-membership scoping.
- `desktop:documents:create-and-issue` creates invoice/items/payment/audit events in one main-process transaction.
- `desktop:stock:adjust` updates item stock and stock_movements atomically.
- `desktop:auth:*` handles local sign-up, sign-in, session restore, sign-out, and password updates (current password required to change password).
- `desktop:system:*` handles opening http(s) URLs, logs folder, and checksummed database backups/restores.

## Hardening

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- CSP headers applied in the main process
- Schema version tracked in `app_meta.schema_version` via `electron/db/migrations`
- Quality gates and scorecard: `SCORECARD.md`

## Renderer Strategy

- The existing hooks and pages continue to use a Supabase-shaped client interface, but that interface is now backed by the Electron preload bridge.
- Hash-based routing is used so packaged navigation works without a web server.
- The current UI is preserved while the backend dependency is swapped from Supabase to the local desktop runtime.
