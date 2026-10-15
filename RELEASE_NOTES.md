# Expense Tracker Release Notes

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

### Release Artifacts & Specifications

| Attribute | Details |
| :--- | :--- |
| **Mobile App Version** | `1.0.4` |
| **Android Version Code** | `6` |
| **iOS Build Number** | `5` |
| **Package ID** | `com.yoge.expensetracker` |
| **Backend Framework** | Spring Boot 4.1.1 (Java 27 preview / 21) |
| **ML Engine** | PyTorch / scikit-learn / Hugging Face Hub |
