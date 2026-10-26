# Expense Tracker Mobile v1.0.5

A release focused on **profile picture synchronization across web & mobile, dual-mode OCR receipt scanning (file browsing + live camera), resilient low-power background export/import processing, 50MB multipart limits, and modernized 2026 asynchronous scheduling**.

---

## What's New in v1.0.5

### Profile Picture Synchronization & Management
- **Automatic Multi-Surface Sync**: Mobile app now actively queries `GET /api/users/{userId}` to fetch and display the user's avatar image (from Google OAuth or custom URLs), matching the web experience.
- **Auto-Refresh Lifecycle**: Profile avatars refresh automatically on app startup, tab focus (`useFocusEffect`), and pull-to-refresh.
- **In-App Avatar Customization**: Added an interactive camera badge and avatar editor modal in the mobile Settings screen allowing users to preview, set, update, or remove profile image URLs.

### Receipt OCR Dual Mode (File Browsing + Live Camera)
- **Flexible Ingestion**: Removed the restrictive `capture="environment"` attribute that previously forced mobile browsers directly into camera viewfinders.
- **Dedicated Actions**: Users can now select **"Browse Receipt"** to pick existing images or documents from device storage and photo galleries, or tap **"Take Photo"** for instant live camera capture.
- **Cross-Platform Compatibility**: Enhanced OCR pipeline ensures seamless parsing on both mobile viewports and desktop web browsers.

### Resilient Bulk Export & Import for Large Ledgers
- **Low-Power Task Persistence**: In-flight export and import job states are continuously persisted to `AsyncStorage` (`@expense_tracker_active_transfer_job`).
- **OS Suspension & Wake Recovery**: Added `AppState` listeners to seamlessly restore transfer cards and progress percentages when the device resumes from background suspension, screen lock, or OS low-power modes.
- **Chunked Memory Processing**: Replaced monolithic joins with chunked row serialization (`CHUNK_SIZE = 2500`) and event-loop yielding (`await new Promise(r => setTimeout(r, 0))`), preventing JavaScript heap spikes (OOM) and OS watchdog kills when exporting thousands or lakhs of transactions.

### File Upload Capacity
- **Expanded Multipart Limits**: Spring Boot multipart limits increased to **50MB** per file and **60MB** per request, accommodating over 500,000 transaction rows.

### 2026 Runtime Standards & Modernized Scheduling
- **`requestIdleCallback` Scheduler**: Completely replaced deprecated `InteractionManager.runAfterInteractions` with a standard cooperative idle task scheduler pattern and asynchronous fallbacks.
- **Zero Warnings**: Fully resolved all deprecation warnings under React Native 0.88+ and Expo SDK 58.

---

## Release & Artifact Summary

| Attribute | Details |
| :--- | :--- |
| **Release Version** | 1.0.5 |
| **Android Version Code** | 7 |
| **iOS Build Number** | 6 |
| **Package ID** | com.yoge.expensetracker |
| **iOS Bundle ID** | com.yoge.expensetracker |
| **Commit SHA** | main |

---

## Installation

1. Android: download the `expense-tracker.apk` asset from the release.
2. Verify: optionally compare the published SHA-256 checksum with your downloaded APK.

### Notes

- Reports reflect the selected date range and the persisted server-side ledger at export time.
- iOS build availability is credential-dependent; the Android release is the primary downloadable artifact when no Apple credentials are linked to EAS.
