# Vyapar Nepal Test Build Guide (v0.1.3)

## Package
- Installer file: `Vyapar-Nepal-Test-v0.0.0.exe`
- Platform: Windows

## Install Steps
1. Double-click `Vyapar-Nepal-Test-v0.0.0.exe`.
2. Complete the installer wizard.
3. Launch the app from Desktop or Start Menu.

## Windows SmartScreen Note
If Windows shows a warning for an unsigned test app:
1. Click `More info`
2. Click `Run anyway`

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
