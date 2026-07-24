# Vyapar Nepal Test Build Guide (v0.1.3)

## Package
- Installer file: `Vyapar-Nepal-Test-v0.0.0.exe`
- Platform: Windows

## Install Steps
1. Double-click `Vyapar-Nepal-Test-v0.0.0.exe`.
2. Complete the installer wizard.
3. Launch the app from Desktop or Start Menu.

## Windows SmartScreen Note
This test channel ships **unsigned** NSIS builds (code signing is out of scope for now). If Windows shows a warning:
1. Click `More info`
2. Click `Run anyway`

Backups write a `.sha256` sidecar and may include local password hashes — store them privately. Restore creates a pre-restore safety copy and verifies checksums when the sidecar is present.

## What To Test
1. Business setup and login flow
2. Sales invoice create -> issue -> print flow
3. `Cash A/C` customer flow (dynamic customer details)
4. Payment recording flow
5. Reports loading and export flow
6. Purchase and inventory basic flow

## Test Data Guidance
- Use test/sample data only
- Do not use real accounting records
- For repeatable smoke testing, create a VAT-registered test business with a 9-digit PAN and open `Settings -> Data -> Create Demo Data`.
- Demo data adds clearly named sample parties, items, sale invoice, purchase bill, payment, correction note, and expense records. The action refuses to add the same sample set twice.

## Smoke Test Path
1. Confirm `Dashboard` shows setup readiness until profile, tax, party, item, and backup checks are complete.
2. Use demo data or manually create a sale invoice, then issue and print it.
3. Record or review the sample payment on the invoice.
4. Open `Reports -> VAT Filing Review Pack`, export CSV, and confirm VAT return aid, books, CN/DN, and sequence sections are present.
5. Open `Settings -> Data`, create a backup, then run `Verify Audit Chains`.

## What To Include In Feedback
1. Clear title
2. Steps to reproduce
3. Expected result
4. Actual result
5. Screenshot or short video
6. Severity (`Critical`, `Major`, `Minor`)
7. Windows version
8. Date/time of issue

## Optional Reset Between Test Rounds
If needed, uninstall and reinstall the app before a new round of testing.
