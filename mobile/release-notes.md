# Expense Tracker Mobile v1.0.4

A release focused on **bulk notification clearing, instant touch clearing UX, verified ML categorization, responsive theme animations, and polished financial reporting**.

---

## What's New in v1.0.4

### Notification Management (Web & Mobile)
- Added **"Clear all notifications"** button in both the mobile app header and web dashboard inbox panel.
- Added backend bulk-clear API endpoint (`DELETE /api/notifications/user/{userId}`) with immediate unread count and badge counter reset.
- Protected bulk deletion with an in-app confirmation dialog to prevent accidental data loss.

### Search UX & Soft Keyboard Touch Responsiveness
- Fixed search bar clear button in mobile app: tapping the **X** icon now clears the input immediately on the first touch without requiring an extra tap to retract the keyboard.
- Enabled `keyboardShouldPersistTaps="handled"` on scroll views and currency lists, paired with `onPressIn` and expanded hit slop.

### Machine Learning & SMS Expense Categorization
- Connected automated SMS notification listeners with ML inference categorizer for credit and debit transaction tracking.
- Hardened ML training pipelines, promotion gates, and dataset loading routines for continuous model retraining.
- Verified model publishing to Hugging Face Model Hub and serving Space sync; all 51 ML pytest suites passing with headless Agg plotting.

### Theme Switching & Visual Refinements
- Fixed theme toggle 360-degree rotation animation so the moon icon maintains an upright position across theme toggles.
- Corrected Savings Retention Rate percentage formatting in executive Excel workbooks.
- Resolved Java 21 IDE inspections in `ExportServiceImpl` with modern record constructs and optimized collections.

---

## Release & Artifact Summary

| Attribute | Details |
| :--- | :--- |
| **Release Version** | 1.0.4 |
| **Android Version Code** | 6 |
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
