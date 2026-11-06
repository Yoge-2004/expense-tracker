# Expense Tracker Mobile v1.0.12

A receipt-scanning release: **a failed scan now says what went wrong, and photos are prepared on the phone before upload**.

---

## What's New in v1.0.12

### Receipt scanning
- A failed scan now tells you why (offline, timed out, session expired, file too large, nothing readable) instead of showing a sample receipt.
- Photos are resized to at most 1600 px wide and rotated correctly on the phone before upload, so scans start sooner.
- The scan waits up to 60 seconds for a slow server.

### With the matching server update
- Large photos, profile pictures and file imports are accepted up to 60 MB; they were refused above 1 MB.
- Text recognition on the server runs faster.
- The data-safety tools from 1.0.10 (safety copy, compare and restore) are unchanged.

---

## Release & Artifact Summary

| Attribute | Details |
| :--- | :--- |
| **Release Version** | 1.0.12 |
| **Android Version Code** | 14 |
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
