# Expense Tracker Mobile v1.0.10

A data-safety release: **your ledger is now kept in a protected copy on the phone, and you can restore anything the server is missing, explicitly and without creating duplicates**.

---

## What's New in v1.0.10

### Safety copy of your ledger
- The ledger cached on the phone is copied aside before the first network sync and kept if the server ever returns far less data. It survives sign-out and expired sessions.

### Restore to server (Export / Import screen)
- Compare with server shows exactly which expenses, incomes, goals, loans, budgets, recurring items and categories the server is missing, with example lines.
- Restore to server uploads only what is missing, re-reads the server afterwards and reports a verified result. Running it again sends nothing.
- Records the server already holds in an edited form are left alone by default; an explicit choice uploads them too.
- Export device copy writes a file that works offline, and Import device copy file loads one back.
- A dashboard banner appears when this phone holds more records than the server returned.
- The sign-in screen can save a copy of the data stored on the phone even when sign-in is unavailable.

### Fixes
- Narrow phones no longer clip the Record Expense buttons.

---

## Release & Artifact Summary

| Attribute | Details |
| :--- | :--- |
| **Release Version** | 1.0.10 |
| **Android Version Code** | 12 |
| **Package ID** | com.yoge.expensetracker |
| **iOS Bundle ID** | com.yoge.expensetracker |
| **Commit SHA** | main |

---

## Installation

1. Android: download the expense-tracker.apk asset from the release.
2. Verify: optionally compare the published SHA-256 checksum with your downloaded APK.

### Notes

- Reports reflect the selected date range and the persisted server-side ledger at export time.
- iOS build availability is credential-dependent; the Android release is the primary downloadable artifact when no Apple credentials are linked to EAS.
