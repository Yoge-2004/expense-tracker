---
title: Expense Tracker Backend
emoji: 💰
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# 💰 Expense Tracker System

A RESTful personal finance management API built with **Spring Boot 4.1.1**, **Spring Security (JWT)**, and **H2/JPA/SQLite/PostgreSQL**. Track daily expenses, manage category budgets, configure recurring monthly subscriptions, log multiple income streams, monitor savings goals, and schedule automated reports — with a clean dark-themed frontend and Expo React Native mobile app.

---

## 📑 Table of Contents

- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Mobile App (Expo React Native)](#-mobile-app-expo-react-native)
- [Database Persistence & Hugging Face Hub Sync](#-database-persistence--hugging-face-hub-sync)
- [Neon DB & Compute Hours Protection](#-neon-db--compute-hours-protection)
- [Docker & Containerization](#-docker--containerization)
- [Hugging Face Spaces & Netlify Deployment](#-hugging-face-spaces--netlify-deployment)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Documentation (Swagger)](#-api-documentation-swagger)
- [Running Tests](#-running-tests)
  - [From the Terminal (Maven)](#1-from-the-terminal-maven)
  - [From IntelliJ IDEA](#2-from-intellij-idea)
  - [From VS Code](#3-from-vs-code)
- [Test Reports](#-test-reports)
- [API Overview](#-api-overview)

---

## 📸 Screenshots

### Register
Create a free account with your name, email, and a password of at least 6 characters.

![Register](screenshots/register.png)

---

### Login
Sign in with your credentials. A JWT token is issued and used for all subsequent API calls.

![Login](screenshots/login.png)

---

### Dashboard
The dashboard shows your total spend, number of expenses, a spend-by-category donut chart, your monthly budgets, and a spending trend graph.

![Dashboard](screenshots/dashboard.png)

---

### Add Expense
Record a new expense by entering a description, amount (₹), category, and date. Tick **Repeat this expense monthly** to register it as a recurring subscription.

![Add Expense](screenshots/add_expense.png)

---

## 🛠 Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Language | Java OpenJDK | 26 |
| Framework | Spring Boot | 4.1.1 |
| Security | Spring Security + JJWT + Google OAuth | 4.1.1 / 0.12.6 |
| Persistence | Spring Data JPA + Hibernate ORM | 7.4.5.Final |
| Primary Database | H2 (in-memory dev/test), SQLite JDBC, PostgreSQL (Neon) | SQLite 3.53.4.0 |
| Export & Reporting | OpenPDF (PDF reports) & Apache POI (Excel) | OpenPDF 3.0.5, POI 5.5.1 |
| Mobile | React Native, Expo, Expo Router | Expo 54, React Native 0.81 |
| Documentation | SpringDoc OpenAPI (Swagger UI) | 3.1.0 |
| Unit Tests | JUnit 5 + Mockito + MockMvc (`@WebMvcTest`) | JUnit 6.0.3 / Mockito 5.14.2 |
| BDD & E2E Tests | Cucumber + REST-Assured + Selenium / HtmlUnit | Cucumber 7.34.7, REST-Assured 6.0.1, Selenium 4.48.0 |
| Build Tool | Apache Maven | Maven 3.9+ (Compiler 3.16.0, Surefire 3.6.0) |

---

## 📱 Mobile App (Expo React Native)

The application includes a mobile client built with **React Native** and **Expo Router**.

### Run Mobile App Locally

```bash
cd mobile
npm install
npx expo start
```

- **Expo Go App**: Scan the QR code shown in the terminal with the Expo Go app (Android) or Camera app (iOS).
- **Web Preview**: Press `w` in terminal or open `http://localhost:8081`.
- **Tunnel Mode**: `npx expo start --tunnel` (for testing across different networks).

---

## 🔄 Database Persistence & Hugging Face Hub Sync

Because containerized hosting services like Hugging Face Spaces have ephemeral local filesystems on restart, Expense Tracker provides an automated bidirectional database persistence service via `FileDbSyncService`.

### 1. Dual Backup Mechanism
- **`expense_tracker.db`**: Full SQLite binary database containing all tables, relations, and schemas.
- **`expenses_sync.json`**: Portable JSON snapshot containing formatted expense records and category mappings.

### 2. Hugging Face Hub Commit API Integration
When `HF_SYNC_ENABLED=true` is set with a write token:
- On startup, the application queries the Hugging Face Spaces repository (`Yoge-2004/expense-tracker-backend`) and pulls both `expenses_sync.json` and `expense_tracker.db` using redirect-aware HTTP streams (`resolve/main/{file}`).
- Changes are committed directly back to the Space repository using the Hugging Face Hub NDJSON Commit protocol (`application/x-ndjson`), ensuring all data updates survive container lifecycles and cold starts.
- Automatic scheduled push runs every 6 hours (`@Scheduled(cron = "0 0 */6 * * *")`).

### 3. Manual Sync Endpoints
Administrators and users can manually trigger sync cycles at any time:
- `POST /api/sync/file-to-db` — Imports records from local JSON snapshot into active database.
- `POST /api/sync/db-to-file` — Dumps active database records to local JSON snapshot.
- `POST /api/sync/push-to-hf` — Commits local JSON and SQLite snapshots to Hugging Face Spaces.
- `POST /api/sync/pull-from-hf` — Pulls latest snapshots from Hugging Face Spaces and reloads into DB.

---

## ⚡ Neon DB & Compute Hours Protection

To optimize database connections and stay safely within free-tier compute limits (e.g. 100 compute hours/month on Neon PostgreSQL):

```properties
# HikariCP Pool Autosuspend Configuration
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=0
spring.datasource.hikari.connection-timeout=5000
spring.datasource.hikari.idle-timeout=120000
spring.datasource.hikari.max-lifetime=600000
```

- **`minimum-idle=0`**: HikariCP drops all connections after 2 minutes of idle time.
- **Autosuspend**: Neon PostgreSQL detects 0 active connections and enters sleep mode, consuming **0 compute hours**.
- **Scheduled Sync**: Background file-to-DB sync is configured hourly (`@Scheduled(cron = "0 0 * * * *")`) to prevent polling the DB continuously.

---

## 🐳 Docker & Containerization

The backend is containerized using a production-grade `Dockerfile` configured to run as non-root user (`UID 1000`) on port `7860` (optimized for Hugging Face Spaces).

### 1. Build the JAR Locally

Compile and package the Spring Boot executable fat JAR:
```bash
./mvnw clean package -DskipTests
```

### 2. Build the Docker Image

Build the container image using the pre-compiled JAR and backup database:
```bash
docker build -t expense-tracker-backend .
```

### 3. Run the Container

Run the container locally and map port `7860` to your host:
```bash
docker run -p 7860:7860 \
  -e SPRING_DATASOURCE_URL="jdbc:postgresql://<your-neon-host>/neondb?sslmode=require" \
  -e SPRING_DATASOURCE_USERNAME="your_username" \
  -e SPRING_DATASOURCE_PASSWORD="your_password" \
  -e JWT_SECRET="your_jwt_secret_key" \
  -e HF_TOKEN="hf_your_huggingface_write_token" \
  -e HF_SPACE_REPO="Yoge-2004/expense-tracker-backend" \
  -e HF_SYNC_ENABLED="true" \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5500,http://127.0.0.1:5500" \
  expense-tracker-backend
```

---

## 🚀 Hugging Face Spaces & Netlify Deployment

### Hugging Face Spaces (Backend Container)
- Deployed via `Dockerfile` on Eclipse Temurin OpenJDK 26 JRE runtime on port `7860`.
- Includes persistent `expense_tracker.db` SQLite fallback and `expenses_sync.json` auto-sync.

### Netlify (Web Frontend)
- Configured via `netlify.toml` in repository root:
  ```toml
  [build]
    publish = "frontend"

  [[redirects]]
    from = "/api/*"
    to = "https://yoge-2004-expense-tracker-backend.hf.space/api/:splat"
    status = 200
  ```

---

## 🔑 Environment Variables

The application can be configured in production (such as on Hugging Face Spaces or inside Docker containers) using the following environment variables:

| Environment Variable | Default Value | Description | Production Example |
| --- | --- | --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:h2:mem:expensetrackerdb` | JDBC connection URL for the database | `jdbc:postgresql://ep-flat-water-123456.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `SPRING_DATASOURCE_DRIVER_CLASS_NAME` | `org.h2.Driver` | JDBC driver class name | `org.postgresql.Driver` |
| `SPRING_DATASOURCE_USERNAME` | `sa` | Database user account name | `yoge_admin` |
| `SPRING_DATASOURCE_PASSWORD` | *(empty)* | Database user account password | `my_secure_db_password` |
| `SPRING_JPA_DATABASE_PLATFORM` | `org.hibernate.dialect.H2Dialect` | Hibernate dialect for database-specific SQL queries | `org.hibernate.dialect.PostgreSQLDialect` |
| `SPRING_SQL_INIT_MODE` | `always` | Controls whether SQL seeding scripts (`data.sql`) run | `always` (or `never` after first seed) |
| `SPRING_H2_CONSOLE_ENABLED` | `true` | Enables/disables the web-based H2 database console | `false` |
| `CORS_ALLOWED_ORIGINS` | `http://127.0.0.1:5500,http://localhost:5500,http://localhost:3000` | Comma-separated client URLs permitted for CORS access | `https://cozy-narwhal-3099ad.netlify.app` |
| `JWT_SECRET` | *(default secure hex)* | 256-bit hex key to sign and verify JSON Web Tokens | `d3f9b2...` *(generate a secure random 64-character hex string)* |
| `HF_TOKEN` | *(empty)* | Hugging Face user access token with write scope for Space commit API | `hf_xxxxxxxxxxxxxxxxxxxx` |
| `HF_SPACE_REPO` | `Yoge-2004/expense-tracker-backend` | Hugging Face target Space repository identifier | `Yoge-2004/expense-tracker-backend` |
| `HF_SYNC_ENABLED` | `false` | Enables/disables automated Hugging Face Spaces push and pull | `true` |

---

## 📁 Project Structure

```
expense-tracker/
├── frontend/                    # Web frontend (HTML, CSS, JS, Chart.js)
├── mobile/                      # Expo React Native mobile application
│   ├── app/                     # Expo Router screens (login, register, tabs)
│   ├── context/                 # AuthContext & Theme Provider
│   └── services/                # API service layer with error handling
├── screenshots/                 # UI screenshots (register, login, dashboard, add_expense)
├── src/
│   ├── main/
│   │   ├── java/com/example/expensetracker/
│   │   │   ├── config/          # SecurityConfig, SwaggerConfig, CorsConfig, Initializers
│   │   │   ├── controller/      # REST controllers (Auth, Expense, Category, Income, Savings, Sync, User)
│   │   │   ├── dto/             # Request/Response DTOs with @Schema annotations
│   │   │   ├── exception/       # GlobalExceptionHandler
│   │   │   ├── mapper/          # Entity ↔ DTO mappers
│   │   │   ├── model/           # JPA entities (User, Expense, Income, SavingsGoal, etc.)
│   │   │   ├── repository/      # Spring Data JPA repositories
│   │   │   ├── scheduler/       # Recurring scheduler (Expenses, Incomes, Savings)
│   │   │   └── service/         # Business logic & FileDbSyncService
│   │   └── resources/
│   │       ├── application.properties
│   │       ├── application-sqlite.properties
│   │       └── data.sql         # Seeds global categories on startup
│   └── test/
│       ├── java/com/example/expensetracker/
│       │   ├── controller/      # JUnit @WebMvcTest tests
│       │   ├── service/         # Service layer unit tests
│       │   └── cucumber/        # Cucumber runner, config, step definitions
│       └── resources/
│           ├── features/        # Gherkin .feature integration suites
│           ├── cucumber.properties
│           └── application.properties  # Test-specific overrides
├── Dockerfile                   # Production Dockerfile for HF Spaces (Port 7860)
├── netlify.toml                 # Netlify deployment configuration
├── expense_tracker.db           # SQLite database backup snapshot
├── expenses_sync.json           # JSON portable snapshot
├── run-tests.sh                 # Convenience test script (colour output)
└── pom.xml                      # Project Object Model dependencies
```

---

## 🚀 Getting Started

### Prerequisites

- **Java 17+** (project targets Java 26; Java 17–26 supported)
- **Maven 3.8+** (or use included `./mvnw`)

### Clone & Run

```bash
git clone https://github.com/Yoge-2004/expense-tracker.git
cd expense-tracker
./mvnw spring-boot:run
```

The application starts on **port 8080** with an in-memory H2 database by default.
Global expense categories (Food, Transport, Utilities, Entertainment, Health)
are seeded automatically.

### H2 Console (Dev Only)

```
URL:      http://localhost:8080/h2-console
JDBC URL: jdbc:h2:mem:expensedb
User:     sa   Password: (blank)
```

---

## 📖 API Documentation (Swagger)

Full interactive API documentation is auto-generated by SpringDoc OpenAPI.

| Resource | URL |
|---|---|
| **Swagger UI** | <http://localhost:8080/swagger-ui/index.html> |
| **OpenAPI JSON** | <http://localhost:8080/v3/api-docs> |

### Authenticating in Swagger UI

1. Call **`POST /api/auth/register`** to create an account.
2. Call **`POST /api/auth/login`** — copy the `token` from the response.
3. Click the **Authorize 🔓** button (top-right of the Swagger UI page).
4. Paste the token (without the `Bearer ` prefix) and click **Authorize**.
5. All subsequent requests will include `Authorization: Bearer <token>` automatically.

---

## 🧪 Running Tests

The project includes an extensive test suite:

| Suite | Type | Description |
|---|---|---|
| JUnit `@WebMvcTest` | Unit / Controller | Controller unit tests with mocked service layer |
| Service Unit Tests | Unit / Business Logic | In-depth testing of business services, sync, and exports |
| Cucumber BDD | Integration | Full end-to-end Gherkin feature scenarios against test DB |

---

### 1. From the Terminal (Maven)

#### Run all tests
```bash
./mvnw test
```

#### Run fast unit & service tests (excluding browser/selenium)
```bash
./mvnw test -Dtest="!*Selenium*,!CucumberTestRunner"
```

#### Run Cucumber BDD tests only
```bash
./mvnw test -Dtest=CucumberTestRunner
```

#### Run a single test class
```bash
./mvnw test -Dtest=SyncControllerTest
```

---

## 🗺 API Overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | ❌ | System & Database Health Check |
| `POST` | `/api/auth/register` | ❌ | Create a new user account |
| `POST` | `/api/auth/login` | ❌ | Authenticate and receive a JWT token |
| `POST` | `/api/auth/oauth/google` | ❌ | Google OAuth authentication |
| `PUT` | `/api/auth/reset-password` | ❌ | Reset password with OTP email verification |
| `POST` | `/api/sync/file-to-db` | ❌ | Sync JSON file to database |
| `POST` | `/api/sync/db-to-file` | ❌ | Export database to JSON file |
| `POST` | `/api/sync/push-to-hf` | ❌ | Push SQLite & JSON snapshots to Hugging Face Spaces |
| `POST` | `/api/sync/pull-from-hf` | ❌ | Pull latest database snapshots from Hugging Face Spaces |
| `POST` | `/api/expenses/user/{userId}` | ✅ | Record a new expense |
| `GET` | `/api/expenses/user/{userId}` | ✅ | List all expenses for a user |
| `PUT` | `/api/expenses/{id}/user/{userId}` | ✅ | Update an expense |
| `DELETE` | `/api/expenses/{id}/user/{userId}` | ✅ | Delete an expense |
| `GET` | `/api/expenses/user/{userId}/export/csv` | ✅ | Export expenses as CSV |
| `GET` | `/api/expenses/user/{userId}/export/json` | ✅ | Export expenses as JSON |
| `GET` | `/api/expenses/user/{userId}/export/pdf` | ✅ | Download PDF expense report |
| `POST` | `/api/expenses/user/{userId}/import/csv` | ✅ | Import expenses from CSV file |
| `POST` | `/api/expenses/user/{userId}/import/json` | ✅ | Import expenses from JSON file |
| `POST` | `/api/expenses/budget/user/{userId}` | ✅ | Set a category budget limit |
| `GET` | `/api/expenses/budget/status/user/{userId}` | ✅ | View budget utilisation |
| `DELETE` | `/api/expenses/budget/{budgetId}` | ✅ | Delete a budget limit |
| `POST` | `/api/expenses/recurring/user/{userId}` | ✅ | Add a recurring expense |
| `GET` | `/api/expenses/recurring/user/{userId}` | ✅ | List active recurring expenses |
| `POST` | `/api/incomes/user/{userId}` | ✅ | Record a new income stream |
| `GET` | `/api/incomes/user/{userId}` | ✅ | List user income entries |
| `GET` | `/api/incomes/user/{userId}/cashflow` | ✅ | Compute monthly cash flow summary |
| `POST` | `/api/savings/goals/user/{userId}` | ✅ | Create a savings goal (SIP, Chit, FD) |
| `GET` | `/api/savings/goals/user/{userId}` | ✅ | List user savings goals |
| `POST` | `/api/savings/goals/{goalId}/deposit/user/{userId}` | ✅ | Deposit into savings goal |
| `POST` | `/api/categories/user/{userId}` | ✅ | Create a personal category |
| `GET` | `/api/categories/user/{userId}` | ✅ | List personal categories |
| `GET` | `/api/categories/global` | ✅ | List system-wide categories |
| `DELETE` | `/api/users/{userId}` | ✅ | Delete account (cascade delete all data) |

> ✅ = requires `Authorization: Bearer <token>` header  
> ❌ = public endpoint, no token needed

---

## 📄 Licence

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.
