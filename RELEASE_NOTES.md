# Expense Tracker Release Notes

## Version 1.0.5 (Android Version Code: 7)

A major release focused on **profile picture synchronization across web & mobile, dual-mode OCR receipt scanning (file browsing + live camera), resilient low-power background export/import processing, 50MB multipart limits, and modernized 2026 asynchronous scheduling**.

---

### Key Highlights

#### 1. Profile Picture Synchronization & Management
- **Cross-Surface Avatar Parity**: Mobile app now fetches and displays user avatars directly from `GET /api/users/{userId}` (synced with Google OAuth and custom web profiles).
- **Proactive Lifecycle Syncing**: User profile pictures update automatically on app launch, dashboard focus (`useFocusEffect`), and pull-to-refresh actions.
- **In-App Mobile Avatar Editor**: Added an interactive camera badge and avatar editor modal in the mobile Settings screen allowing users to preview, set, update, or remove profile image URLs.
- **Backend Persistence**: Updated `UpdateProfileRequest` and `UserController` to validate and persist `profilePictureUrl` in the database.

#### 2. Dual-Mode Tesseract OCR Receipt Ingestion
- **Device File Browsing**: Removed hardcoded `capture="environment"` attribute, enabling users on mobile and desktop to browse photos and documents from device storage and galleries.
- **Dedicated Actions**: Provided distinct **"Browse Receipt"** and **"Take Photo"** buttons in the receipt scan interface for clear user intent.
- **Multi-Tax Extraction**: Preserved client-side WebAssembly OCR extraction for line items, amounts, merchants, and tax structures (CGST, SGST, IGST, VAT).

#### 3. Resilient Bulk Export/Import for Large Ledgers
- **Low-Power Task Persistence**: In-flight export and import job states are continuously persisted to `AsyncStorage` (`@expense_tracker_active_transfer_job`).
- **OS Suspension & Wake Recovery**: Added `AppState` listeners to seamlessly restore transfer cards and progress percentages when the device resumes from background suspension, screen lock, or OS low-power modes.
- **Chunked Memory Processing**: Replaced monolithic joins with chunked row serialization (`CHUNK_SIZE = 2500`) and event-loop yielding (`await new Promise(r => setTimeout(r, 0))`), preventing JavaScript heap spikes (OOM) and OS watchdog kills when exporting thousands or lakhs of transactions.

#### 4. File Upload Limits
- **50MB Multipart Threshold**: Increased Spring Boot multipart file upload limits (`spring.servlet.multipart.max-file-size=50MB`, `spring.servlet.multipart.max-request-size=60MB`) to accommodate high-volume ledgers exceeding 500,000+ transaction rows.

#### 5. 2026 Runtime Standards & Modernized Scheduling
- **`requestIdleCallback` Scheduler**: Completely replaced deprecated `InteractionManager.runAfterInteractions` with a standard cooperative idle task scheduler pattern and asynchronous fallbacks.
- **Clean Deprecation Log**: Fully resolved all deprecation warnings under React Native 0.86+ and Expo SDK 57.

---

### Release Artifacts & Specifications (v1.0.5)

| Attribute | Details |
| :--- | :--- |
| **Mobile App Version** | `1.0.5` |
| **Android Version Code** | `7` |
| **iOS Build Number** | `6` |
| **Package ID** | `com.yoge.expensetracker` |
| **Backend Framework** | Spring Boot 4.1.1 (Java 27 preview / 21) |
| **ML Engine** | PyTorch / scikit-learn / Hugging Face Hub |

---

## Version 1.0.4 (Android Version Code: 6)

A major release focused on **bulk notification clearing, instant touch search responsiveness, verified ML model retraining loops & Hugging Face Hub synchronization, theme transition perfection, and executive financial reporting**.

---

### Key Highlights

#### 1. Notification Management (Web & Mobile)
- **Clear All Notifications**: Users can now clear their entire notification inbox with a single action on both the website dashboard and mobile app.
- **Backend Bulk Clearing**: Added `@DeleteMapping` at `/api/notifications/user/{userId}` calling `AppNotificationRepository.deleteByUser(User user)`.
- **Instant Badge Counter Synchronization**: Cleared notifications immediately update the bell badge count and notification trays in real-time.
- **Safety Safeguard**: Confirmation dialogs prevent accidental bulk deletion on mobile (`useAlert()`) and desktop web.

#### 2. Search UX & Keyboard Responsiveness
- **Single-Tap 'X' Clearing**: Fixed search bar clear button in the mobile app where tapping the **X** icon previously retracted the keyboard instead of clearing text.
- **Handled Tap Persistence**: Added `keyboardShouldPersistTaps="handled"` on scroll views and currency picker modals, combined with `onPressIn` and expanded hit slop.

#### 3. Machine Learning & Automated Model Publishing
- **SMS Financial Categorization**: Wired automated SMS listeners for credit/inflow and debit transactions to the Hugging Face hosted ML inference service.
- **Model Training Loops**: Verified end-to-end dataset preparation, stratified splitting, TF-IDF / Transformer training, evaluation gates, and metadata manifest generation.
- **Hugging Face Repository Publishing**: Verified candidate evaluation gates (accuracy & macro F1 thresholds), automated branch creation, and artifact upload to the model repository (`Yoge-2004/expense-intelligence-model`) and serving Space restart.
- **Test Suite Health**: All 51 ML pytest tests passing seamlessly with headless Agg plotting backend.

#### 4. Visual & Financial Export Refinements
- **Theme Switcher Rotation**: Corrected 360-degree rotation animation so the dark-mode moon icon remains upright instead of inverting to -180 degrees.
- **Excel Formatting**: Formatted Savings Retention Rate percentage accurately in executive Excel workbooks.
- **Code Cleanliness**: Cleaned modern Java 21 inspections in `ExportServiceImpl` (`getFirst()`, record classes, unused style methods).

---

### Release Artifacts & Specifications (v1.0.4)

| Attribute | Details |
| :--- | :--- |
| **Mobile App Version** | `1.0.4` |
| **Android Version Code** | `6` |
| **iOS Build Number** | `5` |
| **Package ID** | `com.yoge.expensetracker` |
| **Backend Framework** | Spring Boot 4.1.1 (Java 27 preview / 21) |
| **ML Engine** | PyTorch / scikit-learn / Hugging Face Hub |
