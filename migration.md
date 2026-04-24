# Desktop Migration Backlog

This backlog turns the web-to-desktop migration into small, verifiable tasks that can be implemented one by one. The target is an Electron-based, offline-first Windows desktop app using a local SQLite database and no Supabase runtime dependency.

## Baseline

- [x] `M01` Create the desktop migration baseline.
  Deliverable: desktop migration docs, package audit, and a clear architecture note for renderer, main process, preload, IPC, and local SQLite ownership.
  Verify: the migration is documented in-repo and the app has desktop-oriented scripts/config.

- [x] `M02` Add the Electron shell without changing app behavior.
  Deliverable: Electron main/preload setup, desktop dev/build scripts, and Windows packaging config.
  Verify: the renderer can be opened through Electron in development and packaging has a defined entrypoint.

- [x] `M03` Make the renderer desktop-safe.
  Deliverable: packaged-app-safe routing and renderer assumptions adjusted for desktop runtime.
  Verify: the app uses hash routing and avoids depending on web server path handling.

## Local Runtime

- [x] `M04` Define the local app API.
  Deliverable: a typed preload/IPC contract for auth, data queries, and desktop helpers.
  Verify: renderer code can call the desktop runtime without direct network/backend SDK usage.

- [x] `M05` Add SQLite and migration infrastructure.
  Deliverable: local SQL.js-backed SQLite file creation, schema bootstrap, and persistence under the desktop app data directory.
  Verify: first launch creates the database and later launches reuse it.

- [x] `M06` Port shared domain types away from generated backend types.
  Deliverable: local domain/table types used by the renderer instead of generated Supabase runtime types.
  Verify: app hooks compile against local table interfaces.

- [x] `M07` Replace cloud auth with local desktop auth.
  Deliverable: local sign-up, sign-in, sign-out, password update, and session restore.
  Verify: a user can create a local account and return to the same session offline.

## Core Data Flows

- [x] `M08` Migrate business, item, party, and payment data flows to local services.
  Deliverable: local query/mutation support for business setup, business switching, inventory, parties, payments, settings, and dashboard reads.
  Verify: these flows run with the desktop data client and persist after restart.

- [x] `M09` Rebuild invoice workflows as local transactions.
  Deliverable: local invoice create/edit/cancel/payment flows with stock adjustment and stock movement logging on issue/cancel.
  Verify: issuing and cancelling invoices updates stock and movement history correctly.

- [x] `M10` Move reports to local queries.
  Deliverable: report hooks read from the desktop data client instead of Supabase.
  Verify: reports run without network access against the local database.

## Desktop Fit and Packaging

- [x] `M11` Adapt printing and external actions for desktop.
  Deliverable: Electron-safe handling for external URLs and desktop window behavior.
  Verify: external links open outside the app and printing continues to work from the renderer.

- [x] `M12` Add backup and restore UI.
  Deliverable: user-facing import/export controls for the local database.
  Verify: a populated database can be backed up and restored from the app UI.

- [x] `M13` Package the Windows desktop release.
  Deliverable: electron-builder Windows target config and release output path.
  Verify: the repo has a Windows packaging command.

- [x] `M14` Remove legacy Supabase runtime code.
  Deliverable: renderer runtime uses the local desktop client instead of the Supabase SDK.
  Verify: the desktop runtime path no longer initializes or calls Supabase.

- [ ] `M15` Optional legacy data import.
  Deliverable: one-time import from existing Supabase-hosted data into the local database.
  Verify: old cloud data can be migrated into a fresh desktop install.

## Acceptance Checks

- [ ] Packaged desktop app launches with internet disabled.
- [ ] A new user can sign up locally, create a business, and continue offline.
- [ ] Items, parties, invoices, payments, stock movements, and reports persist across restarts.
- [ ] Invoice issue/cancel/payment behavior remains correct.
- [ ] Normal desktop use does not depend on Supabase or browser hosting.
