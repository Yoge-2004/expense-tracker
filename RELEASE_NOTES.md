# Expense Tracker Release Notes

## Version 1.0.9 (Android Version Code: 11, iOS Build: 7)

A major performance and cross-platform release focused on **zero-latency theme switching, scroll context isolation for infinite virtualized transaction ledgers, accurate ledger loading lifecycle states, iOS Retina scrollbar gutter separation, and strict iOS App Store & sandbox compliance**.

---

### Key Highlights

#### 1. Instant, Zero-Latency Theme Switching (Parity with Web)
- **Eliminated Route Screen Fades**: Removed React Navigation stack animation delays by configuring `animation: 'none'` on the root tab router (`(tabs)` in `_layout.tsx`) and tab bar navigator (`_layout.tsx`). Previously, theme color switches triggered full 180ms screen fade transitions simulating lag.
- **Immediate Touchdown Response**: Upgraded `ThemeToggleBtn` to a high-priority `Pressable` with `onPressIn` and `hitSlop={8}`, triggering the theme toggle instantaneously at $t = 0\text{ ms}$ upon contact rather than waiting for touch release.
- **Zero Transition Overhead**: Removed the 180ms synthetic rotation animation from the theme toggle icon for immediate visual state toggling.
- **GPU Offloading & Memoization**: Wrapped `AmbientAura.tsx` in `React.memo` and decoupled it from `AuthContext` to prevent expensive background blur re-renders and GPU contention during theme toggles. Memoized `LoansSection.tsx` and auth context getters.

#### 2. Infinite Virtualized Ledger & Accurate Loading States
- **Clean ScrollContext Isolation**: Isolated the inner transaction `FlatList` in `DashboardLedger.tsx` by wrapping it in `<ScrollContext.Provider value={null}>` via `(ScrollView as any).Context`. This permanently eliminates the React Native warning:
  > *VirtualizedLists should never be nested inside plain ScrollViews with the same orientation...*
- **Accurate Loading Lifecycle Indicator**: Fixed premature display of the final state footer. While transactions are in-flight (`isLoading` or `isRefreshing`) or dynamically streaming more rows on scroll, the list displays an active spinner with `"Loading transactions..."` or `"Loading more transactions..."`.
- **True End-of-Transactions Indicator**: The final banner (`— ✓ ALL {N} TRANSACTIONS LOADED —`) is strictly and exclusively rendered when network fetching is complete and all records have been loaded into view.
- **Progressive Stream Loading**: Displays an initial batch of 25 records and smoothly auto-expands as the user scrolls (`onEndReached`), combining ultra-fast initial render times with seamless infinite scroll.
- **Clipped Container Fix**: Increased container bottom padding (`paddingBottom: 16`) so the final transaction card and footer are fully visible with ample clearance above the bottom border.

#### 3. iOS Platform Fidelity & Sandbox Safeguards
- **Scrollbar Separation Gutter**: Adjusted inner ledger scrolling margins (`paddingRight: 14`) to provide a clean 5px gutter from the gold custom scrollbar track (`right: 3, width: 6`), preventing visual card clipping on high-DPI iOS Retina and Android displays.
- **iOS Nested Scroll Trap Prevention**: Added `bounces={false}` and `overScrollMode="never"` to inner list containers to prevent nested scroll traps and momentum conflicts on iOS.
- **Face ID Usage Compliance**: Added explicit `NSFaceIDUsageDescription` to `ios.infoPlist` in `app.json` for biometric authentication compliance.
- **iOS 14+ Pasteboard Privacy Protection**: Guarded SMS clipboard reading with `if (Platform.OS !== 'android') return;` to prevent unnecessary "Expense Tracker pasted from clipboard" privacy banners on iOS.
- **In-App Update Policy Alignment**: In-app binary updates automatically direct to Safari or TestFlight on iOS, complying with Apple App Store review guidelines prohibiting third-party executable downloads.

---

### Release Artifacts & Specifications (v1.0.9)

| Attribute | Details |
| :--- | :--- |
| **Mobile App Version** | `1.0.9` |
| **Android Version Code** | `11` |
| **iOS Build Number** | `7` |
| **Package ID** | `com.yoge.expensetracker` |
| **iOS Bundle Identifier** | `com.yoge.expensetracker` |
| **Backend Framework** | Spring Boot 4.1.1 (Java 27 preview / 21) |
| **ML Engine** | PyTorch / scikit-learn / Hugging Face Hub |

---

## Version 1.0.5 (Android Version Code: 7)

A major release focused on **profile picture synchronization across web & mobile, dual-mode OCR receipt scanning (file browsing + live camera), resilient low-power background export/import processing, 50MB multipart limits, and modernized 2026 asynchronous scheduling**.

---

### Key Highlights

#### 1. Profile Picture Synchronization & Management
- **Cross-Surface Avatar Parity**: Mobile app now fetches and displays user avatars directly from `GET /api/users/{userId}` (synced with Google OAuth and custom web profiles).
- **Proactive Lifecycle Syncing**: User profile pictures update automatically on app launch, dashboard focus (`useFocusEffect`), and pull-to-refresh actions Corp.
- **In-App Mobile Avatar Editor**: Added an interactive camera badge and avatar editor modal in the mobile Settings screen allowing users to preview, set, update, or remove profile image URLs.
- **Backend Persistence**: Updated `UpdateProfileRequest` and `UserController` to validate and persist `profilePictureUrl` in the database.

#### 2. Dual-Mode Tesseract OCR Receipt Ingestion
- **Device File Browsing**: Removed hardcoded `capture="environment"` attribute, enabling users on mobile and desktop to browse photos and documents from device storage and galleries.
- **Dedicated Actions**: Provided distinct **\"Browse Receipt\"** and **\"Take Photo\"** buttons in the receipt scan interface for clear user intent.
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

A major release focused on **bulk notification clearing, instant touch search responsiveness, verified ML model retraining loops & Hugging Face Hub synchronization, theme transition perfection, and executive financial reporting** Corp.

---

### Key Highlights

#### 1. Notification Management (Web & Mobile)
- **Clear All Notifications**: Users can now clear their entire notification inbox with a single action on both the website dashboard and mobile app Corp.
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
