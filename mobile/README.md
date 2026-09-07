<div align="center">

# 📱 Expense Tracker Mobile

### A focused native finance companion built with Expo + React Native.

<!-- IMAGE PLACEHOLDER: Mobile hero collage. Replace with real screenshots from the installed application. -->

![Expense Tracker Mobile](../docs/images/mobile/app-collage.png)

</div>

---

## 📦 Releases & Downloads

Official Android APK builds are published through GitHub Releases.

**👉 [Download / View Releases](https://github.com/Yoge-2004/expense-tracker/releases)**

Each release contains the corresponding APK, checksums, version information, and release notes.

---

## 🌟 About the App

The Expense Tracker mobile application is the native client for the Expense Tracker platform. It is designed for fast everyday finance interactions while sharing the same backend, authentication model, and financial data as the web application.

The mobile client lives in this directory and is built with **Expo 57, React Native 0.86.3, Expo Router, and TypeScript**.

### The mobile app is responsible for

- Presenting finance workflows in a touch-first interface.
- Managing navigation between authenticated screens.
- Collecting expense, income, budget, and savings inputs.
- Communicating with the Expense Tracker REST API.
- Managing client-side authentication/session state.
- Providing native Google Sign-In integration.
- Supporting device-oriented capabilities included by the application, such as secure storage, haptics, document handling, sharing, notifications, and local authentication where used by the corresponding flows.

<!-- IMAGE PLACEHOLDER: Full mobile app overview with 4–6 real screens. -->

![Mobile overview](../docs/images/mobile/overview.png)

---

# 🧭 App Experience

## 🔐 Authentication

The application provides an authenticated entry point before private financial data is shown.

The native Google Sign-In implementation uses `@react-native-google-signin/google-signin`. The resulting Google identity token is sent through the application's authentication flow and the backend remains responsible for identity/token verification.

<!-- IMAGE PLACEHOLDER: Login screen. -->

![Mobile login](../docs/images/mobile/login.png)

<!-- IMAGE PLACEHOLDER: Registration screen. -->

![Mobile registration](../docs/images/mobile/register.png)

<!-- IMAGE PLACEHOLDER: Native Google account chooser followed by successful sign-in. -->

![Google Sign-In](../docs/images/mobile/google-sign-in.png)

### Android Google Sign-In configuration

For an Android native build, Google Cloud must recognize the exact application identity:

```text
Package name:
com.yoge.expensetracker
```

The SHA-1 fingerprint must correspond to the signing certificate of the APK being installed. **Debug, EAS, internal distribution, and Play App Signing certificates can differ**, so each distribution that is actually used should have its corresponding SHA-1 registered in the Google Cloud Android OAuth credential.

The application's `webClientId` is the **Web OAuth client**, because the backend validates the ID-token audience against that Web client. The Android OAuth client is used by Google to validate the native application's package/signing identity.

> Never commit OAuth secrets or credentials that are intended to remain private.

---

# 🏠 Dashboard

The dashboard is the mobile summary view for the user's financial position. It should make the most important numbers and trends visible without requiring the user to navigate through every record.

<!-- IMAGE PLACEHOLDER: Mobile dashboard at a realistic device size. -->

![Mobile dashboard](../docs/images/mobile/dashboard.png)

Suggested capture requirements for the final README screenshot:

- Show realistic but fictional data.
- Keep the complete device frame if it improves context.
- Avoid personal names, email addresses, account numbers, or secrets.
- Capture enough of the screen to communicate hierarchy and navigation.

---

# 💸 Expenses

Expenses are the core everyday workflow. The application provides a mobile-friendly path for entering and reviewing spending records.

Typical expense information includes:

- Description
- Amount
- Category
- Date
- Recurring monthly status where applicable

<!-- IMAGE PLACEHOLDER: Expense list/history screen. -->

![Expense history](../docs/images/mobile/expenses.png)

<!-- IMAGE PLACEHOLDER: Add/edit expense screen. -->

![Add expense](../docs/images/mobile/add-expense.png)

---

# 🔁 Recurring Expenses

Recurring expenses represent monthly commitments such as subscriptions or other regular payments. The mobile interface can expose the recurring option while creating or editing an expense, while the backend handles the corresponding business logic and scheduling.

<!-- IMAGE PLACEHOLDER: Recurring expense/subscription UI. -->

![Recurring expenses](../docs/images/mobile/recurring.png)

---

# 🎯 Budgets

Budgets connect spending behavior with planned limits. The mobile experience makes it possible to review budget progress without opening the full web dashboard.

<!-- IMAGE PLACEHOLDER: Budget list/progress screen. -->

![Mobile budgets](../docs/images/mobile/budgets.png)

---

# 💰 Income

Income records capture money coming into the user's financial picture. Tracking income separately from expenses enables a clearer view of net financial movement.

<!-- IMAGE PLACEHOLDER: Income screen. -->

![Mobile income](../docs/images/mobile/income.png)

---

# 🐷 Savings Goals

Savings goals provide a target-based view of longer-term planning. Goals can expose calculated progress and support contribution/deposit workflows.

<!-- IMAGE PLACEHOLDER: Savings goals screen. -->

![Mobile savings goals](../docs/images/mobile/savings-goals.png)

<!-- IMAGE PLACEHOLDER: Savings goal detail/deposit flow. -->

![Savings goal detail](../docs/images/mobile/savings-detail.png)

---

# 📊 Reports & Documents

The backend provides report generation and export capabilities. Depending on the mobile workflow implemented in the current build, generated documents can be selected, shared, or opened using the device's supported document/sharing mechanisms.

<!-- IMAGE PLACEHOLDER: Mobile report/export/share flow. -->

![Mobile reports](../docs/images/mobile/reports.png)

---

# 🧱 Architecture

The mobile app is intentionally thin: the server remains the source of truth for authenticated financial operations and business rules.

```text
┌───────────────────────────────┐
│       Expo React Native       │
│                               │
│  Screens / Expo Router        │
│  Components                   │
│  Auth + Theme Context         │
│  API / Google Auth Services   │
└───────────────┬───────────────┘
                │ HTTPS / JSON
                ▼
┌───────────────────────────────┐
│       Spring Boot API         │
│                               │
│ Security → Controllers        │
│ DTOs → Services → Repos       │
└───────────────┬───────────────┘
                ▼
       PostgreSQL / SQLite / H2
```

<!-- IMAGE PLACEHOLDER: Replace the ASCII architecture with a polished visual if desired. -->

![Mobile architecture](../docs/images/architecture/mobile-architecture.png)

### Client organization

```text
mobile/
├── app/            → Routes and screens
├── components/     → Reusable UI building blocks
├── constants/      → API/auth/application constants
├── context/        → Authentication and theme state
└── services/       → API and authentication integrations
```

The exact directory tree may evolve as the application grows; this README describes the architectural responsibility rather than coupling documentation to every individual file.

---

# 🛠️ Technology Stack

| Technology | Role |
|---|---|
| Expo 57 | React Native application tooling and runtime ecosystem |
| React Native 0.86.3 | Native UI framework |
| Expo Router ~57 | File-based application navigation |
| TypeScript ~6.0.3 | Static typing |
| React 19.2.3 | UI/component model |
| React Navigation 7 | Navigation primitives used by the app ecosystem |
| Async Storage | Client-side persistent storage where required |
| Expo Secure Store | Secure device storage where used |
| Google Sign-In 16.1.4 | Native Google authentication |
| Expo Notifications | Notification capabilities |
| Expo Local Authentication | Device authentication capabilities |
| Expo Document Picker / File System / Sharing | Document and file workflows |
| Expo Haptics | Native tactile feedback |
| React Native Reanimated | Animation/performance primitives |
| React Native SVG | Vector/icon/visual rendering support |

---

# 🚀 Getting Started

## Prerequisites

Install:

- Node.js and npm
- A supported Android/iOS development environment when building native applications
- Expo CLI through the project's dependencies (`npx expo ...` is preferred)

## Install dependencies

```bash
cd mobile
npm install
```

## Start the development server

```bash
npx expo start
```

Then choose the target platform from the Expo developer interface.

Useful npm scripts:

```bash
npm start
npm run android
npm run ios
npm run web
npm run ts:check
```

<!-- IMAGE PLACEHOLDER: Development server/Expo screen and application running on a device. -->

![Development setup](../docs/images/development/mobile-running.png)

---

# 🔌 Backend Connection

The mobile application communicates with the Expense Tracker Spring Boot API rather than implementing financial persistence locally as its primary source of truth.

Before testing authenticated workflows, make sure the backend is reachable from the device/emulator and that the configured API origin is correct for the build being used.

### Development checklist

```text
Backend running
      ↓
API reachable from device/emulator
      ↓
Correct API base URL
      ↓
Authentication configured
      ↓
Mobile app installed
      ↓
Register / Sign in
      ↓
Test authenticated API calls
```

<!-- IMAGE PLACEHOLDER: Backend + mobile connected successfully. -->

![Connected mobile app](../docs/images/development/mobile-connected.png)

> `localhost` means the current device/emulator in many mobile environments, not necessarily your development computer. Use the address appropriate for the emulator/device network setup.

---

# 🔑 Authentication Configuration

The authentication configuration is centralized in the mobile application's auth constants/service layer.

The important distinction is:

| Credential | Purpose |
|---|---|
| **Web OAuth client ID** | Passed as the Google Sign-In `webClientId`; used because the backend validates the ID-token audience against the Web client. |
| **Android OAuth client** | Registered in Google Cloud with Android package name + signing SHA-1. It identifies the native Android application to Google. |
| **iOS OAuth client** | Used for the iOS native application identity and URL-scheme configuration. |

For a release/EAS APK, register the certificate fingerprint corresponding to the exact build distribution being installed.

<!-- IMAGE PLACEHOLDER: Redacted Google Cloud OAuth credential configuration. Never expose secrets. -->

![OAuth configuration](../docs/images/development/oauth-config.png)

---

# 📦 Building a Native Android APK

The repository's Android workflow uses EAS for native builds. The project configuration is stored in `mobile/app.json` and the EAS project is associated with the application.

For a developer with the required Expo/EAS credentials:

```bash
cd mobile
npx eas build --platform android --profile preview
```

For production, use the repository's intended production profile and signing configuration rather than treating a preview build as a production artifact.

### Why signing matters for Google Sign-In

Google Sign-In on Android validates the combination of:

```text
Android package name
+
APK signing certificate SHA-1
```

Therefore, changing the signing credential or installing an APK from another distribution channel can require an additional Android OAuth credential entry.

<!-- IMAGE PLACEHOLDER: EAS build success / APK artifact screenshot. -->

![EAS Android build](../docs/images/development/eas-build.png)

---

# 🧪 TypeScript & CI Checks

Run the local TypeScript check:

```bash
npm run ts:check
```

The repository CI also installs dependencies and checks the mobile TypeScript project. Backend and repository-level checks run separately from the mobile client.

<!-- IMAGE PLACEHOLDER: Successful mobile TypeScript/CI check. -->

![Mobile CI](../docs/images/development/mobile-ci.png)

---

# 🧪 Testing Strategy

Mobile behavior is validated at several boundaries:

1. **Type safety** — TypeScript catches structural errors before runtime.
2. **Backend contract tests** — the shared Spring Boot API is tested independently.
3. **Browser/E2E checks** — web behavior is tested separately from native mobile behavior.
4. **Native smoke testing** — authentication, navigation, and key financial workflows should be manually verified on the target native build.

When an API response or authentication contract changes, test the mobile client against the new backend before considering the change complete.

---

# 🖼️ Screenshot Guide

This README intentionally uses image slots instead of filling the documentation with generic illustrations. The final visuals should come from the **real application**.

Antigravity can replace the placeholders with screenshots while preserving the surrounding documentation.

### Recommended capture set

| Screenshot | Suggested filename | What it should show |
|---|---|---|
| Hero | `app-collage.png` | Strong visual overview of the mobile product. |
| Login | `login.png` | Authentication entry screen. |
| Register | `register.png` | Account creation. |
| Google auth | `google-sign-in.png` | Native Google flow + successful result. |
| Dashboard | `dashboard.png` | Financial summary. |
| Expenses | `expenses.png` | Expense history/list. |
| Add expense | `add-expense.png` | Expense entry form. |
| Recurring | `recurring.png` | Monthly recurring workflow. |
| Budgets | `budgets.png` | Budget progress. |
| Income | `income.png` | Income records. |
| Savings | `savings-goals.png` | Savings goal overview. |
| Savings detail | `savings-detail.png` | Progress/contribution flow. |
| Reports | `reports.png` | Report/export workflow. |
| Navigation | `navigation.png` | Main app navigation. |

<!-- IMAGE PLACEHOLDER: Final screenshot contact sheet. -->

![Mobile screenshot contact sheet](../docs/images/mobile/contact-sheet.png)

---

# 🧑‍💻 Project Conventions

When changing the mobile application:

- Keep screens focused on presentation and interaction.
- Put reusable UI into components rather than duplicating it across routes.
- Keep API communication inside service modules.
- Keep authentication/session state centralized.
- Avoid hard-coding production URLs or secrets into screens.
- Preserve the shared backend contract.
- Update screenshots when a major user-facing screen changes.
- Run `npm run ts:check` before committing.

---

# 🔒 Security & Privacy

The application handles financial information, so screenshots and sample data should always be fictional.

Never place the following in source control or screenshots:

- Passwords
- JWT secrets
- OAuth private credentials
- Hugging Face write tokens
- Database credentials
- Personal financial records
- Private email addresses or account identifiers

Use environment/build-time configuration and platform secret management where appropriate.

---

# 🔗 Related Documentation

The root README documents the complete system, including:

- Web application
- Spring Boot backend
- REST API
- Database choices
- Docker deployment
- Hugging Face Spaces deployment
- Netlify deployment
- Persistence synchronization
- Testing architecture

Start here: [`../README.md`](../README.md)

---

<div align="center">

### 📱 Your finances, wherever you are.

**Expense Tracker Mobile** is the native interface to the same connected financial system that powers the web application.

</div>
