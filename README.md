# 💰 Expense Tracker System

A modern, full-stack personal finance application built with **Spring Boot 4**, **Spring Security (JWT)**, **Spring Data JPA**, **React Native (Expo)**, and a **Glassmorphic Web Dashboard**. Track daily expenses, set custom-period category budgets, manage recurring subscriptions, export reports (CSV, JSON, PDF), and auto-sync data bidirectionally.

---

## 📑 Table of Contents

- [Features](#-features)
- [Web & Mobile UI Redesign](#-web--mobile-ui-redesign)
- [Tech Stack](#-tech-stack)
- [Neon DB & Compute Hours Protection](#-neon-db--compute-hours-protection)
- [Hugging Face Spaces & Netlify Deployment](#-hugging-face-spaces--netlify-deployment)
- [Mobile App (Expo React Native)](#-mobile-app-expo-react-native)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Overview](#-api-overview)
- [Running Tests](#-running-tests)

---

## ✨ Features

- **Real-Time System Health**: `GET /api/health` checking JVM memory, uptime, and database ping status.
- **503 Graceful Handling**: Service unavailable exceptions with structured JSON error details.
- **Bidirectional File-to-DB Auto Sync**: Keeps local `expenses_sync.json` and SQLite database synced automatically on startup, schedule, and on-demand (`/api/sync/*`).
- **Google OAuth Authentication**: Sign in via Google OAuth (`POST /api/auth/oauth/google`).
- **Custom-Period Budget Limits**: Configure budgets for `MONTHLY`, `WEEKLY`, `YEARLY`, or `CUSTOM` date ranges with easy budget limit deletion.
- **CSV, JSON & PDF Reports**: Download expense reports in CSV, JSON, or OpenPDF formatted PDF documents, and upload CSV/JSON files for bulk import.
- **Subscription Management**: Track, update, and cancel active recurring subscriptions.

---

## 🎨 Web & Mobile UI Redesign

Both the **Web Dashboard** and **Expo React Native Mobile App** have been redesigned with state-of-the-art aesthetics:

- **Electric Indigo & Violet Theme**: Styled with vibrant `#6366F1` Indigo, `#8B5CF6` Deep Violet, `#EC4899` Magenta, and `#F43F5E` Warm Rose highlights.
- **Glassmorphic Card Surfaces**: Backdrop blur effects (`backdrop-filter: blur(24px) saturate(180%)`) with subtle 1px border highlights.
- **Dynamic Charting**: Interactive Chart.js doughnut and trend line charts with curved interpolation and multi-stop gradient fills.
- **Pill Badges & Animations**: Micro-interaction button ripples, animated stat progress bars, status halo indicators, and a clean Dark/Light mode theme switch.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend Framework** | Java 21/26, Spring Boot 4.0.6 |
| **Security & Auth** | Spring Security, JJWT (JWT), Google OAuth |
| **Database & Cache** | PostgreSQL (Neon), SQLite JDBC, Spring Cache |
| **PDF & Data** | OpenPDF 2.0.3, Jackson |
| **Mobile App** | React Native 0.81, Expo 54, Expo Router 6, React Native SVG |
| **Web Frontend** | HTML5, Vanilla CSS3 (Custom Variables), JavaScript (ES6+), Chart.js |
| **Testing** | JUnit 5 (54 Unit Tests), Cucumber 7 (71 BDD Scenarios) |
| **Deployment** | Docker, Hugging Face Spaces, Netlify |

---

## ⚡ Neon DB & Compute Hours Protection

To optimize PostgreSQL compute hours on **Neon.tech** (staying safely within free-tier compute limits):

```properties
# HikariCP Pool Autosuspend Configuration
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=0
spring.datasource.hikari.connection-timeout=5000
spring.datasource.hikari.idle-timeout=120000
spring.datasource.hikari.max-lifetime=600000
```

- **`minimum-idle=0`**: When the application is idle for 2 minutes, HikariCP releases all database connections.
- **Autosuspend Trigger**: Neon detects 0 active connections and enters sleep mode, consuming **0 compute hours**.
- **Hourly Sync**: Background file-to-DB sync is scheduled hourly (`@Scheduled(cron = "0 0 * * * *")`) to prevent polling Neon continuously.

---

## 🚀 Hugging Face Spaces & Netlify Deployment

### Hugging Face Spaces (Backend Container)
- Deployed via a multi-stage `Dockerfile` (Maven build + Eclipse Temurin JRE runtime) on port `7860`.
- Includes persistent `expense_tracker.db` SQLite fallback and `expenses_sync.json` auto-sync.

### Netlify (Web Frontend)
- Configured via `netlify.toml`:
  ```toml
  [build]
    publish = "frontend"

  [[redirects]]
    from = "/api/*"
    to = "https://yoge-2004-expense-tracker-backend.hf.space/api/:splat"
    status = 200
  ```

---

## 📱 Mobile App (Expo React Native)

### Run Mobile App Locally

```bash
cd mobile
npm install
npx expo start
```

- **Expo Go App**: Scan the terminal QR code with your mobile camera or Expo Go app.
- **Web Preview**: Press `w` or visit `http://localhost:8081`.

---

## 📁 Project Structure

```
expense-tracker/
├── frontend/                    # Web frontend (HTML, CSS, JS, Chart.js)
├── mobile/                      # Expo React Native mobile application
│   ├── app/                     # Expo Router screens (login, register, tabs)
│   ├── context/                 # AuthContext & Theme Provider
│   └── services/                # API service layer with 503 error handling
├── src/
│   ├── main/
│   │   ├── java/com/example/expensetracker/
│   │   │   ├── config/          # SecurityConfig, CorsConfig
│   │   │   ├── controller/      # REST controllers (Auth, Expense, Category, Sync, Health, User)
│   │   │   ├── dto/             # DTOs (BudgetDto, OAuthRequest, etc.)
│   │   │   ├── exception/       # GlobalExceptionHandler (503 mapping)
│   │   │   ├── model/           # JPA entities (@Index optimized)
│   │   │   ├── repository/      # Spring Data JPA repositories
│   │   │   └── service/         # Business logic & FileDbSyncService
│   │   └── resources/
│   │       ├── application.properties
│   │       └── application-sqlite.properties
│   └── test/                    # JUnit 5 & Cucumber integration tests
├── Dockerfile                   # Multi-stage Docker build for HF Spaces
├── netlify.toml                 # Netlify deployment & API proxy rewrites
├── run-tests.sh                 # Test suite runner script
├── expense_tracker.db           # SQLite database file
└── pom.xml
```

---

## 🗺 API Overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | ❌ | System & Database Health Check |
| `POST` | `/api/auth/register` | ❌ | Create new user account |
| `POST` | `/api/auth/login` | ❌ | Sign in & receive JWT token |
| `POST` | `/api/auth/oauth/google` | ❌ | Google OAuth authentication |
| `POST` | `/api/sync/file-to-db` | ❌ | Sync JSON file to DB |
| `POST` | `/api/sync/db-to-file` | ❌ | Backup DB to JSON file |
| `GET` | `/api/expenses/user/{userId}` | ✅ | Get all expenses |
| `POST` | `/api/expenses/user/{userId}` | ✅ | Create new expense |
| `PUT` | `/api/expenses/{id}/user/{userId}` | ✅ | Update expense |
| `DELETE` | `/api/expenses/{id}/user/{userId}` | ✅ | Delete expense |
| `GET` | `/api/expenses/user/{userId}/export/csv` | ✅ | Export expenses as CSV |
| `GET` | `/api/expenses/user/{userId}/export/json` | ✅ | Export expenses as JSON |
| `GET` | `/api/expenses/user/{userId}/export/pdf` | ✅ | Download PDF expense report |
| `POST` | `/api/expenses/user/{userId}/import/csv` | ✅ | Import expenses from CSV file |
| `POST` | `/api/expenses/user/{userId}/import/json` | ✅ | Import expenses from JSON file |
| `POST` | `/api/expenses/budget/user/{userId}` | ✅ | Set category budget limit |
| `GET` | `/api/expenses/budget/status/user/{userId}` | ✅ | Get budget status |
| `DELETE` | `/api/expenses/budget/{budgetId}` | ✅ | Delete budget limit |
| `POST` | `/api/expenses/recurring/user/{userId}` | ✅ | Create recurring subscription |
| `PUT` | `/api/expenses/recurring/{recId}` | ✅ | Edit subscription |
| `DELETE` | `/api/expenses/recurring/{recId}` | ✅ | Cancel subscription |
| `DELETE` | `/api/users/{userId}` | ✅ | Delete account & cascade user data |

---

## 🧪 Running Tests

Run the complete automated test suite (54 JUnit unit tests + 71 Cucumber scenarios):

```bash
chmod +x run-tests.sh
./run-tests.sh
```

---

## 📄 Licence

Licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.
