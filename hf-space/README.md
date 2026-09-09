---
title: Expense Tracker API
description: Production Spring Boot API for the Expense Tracker web and mobile applications.
emoji: 💰
colorFrom: yellow
colorTo: red
sdk: docker
app_port: 7860
short_description: Secure Expense Tracker API with Neon failover.
---

# 💰 Expense Tracker — Backend API

**The production API behind Yoge-2004's Expense Tracker web and Android applications.**

This Space runs the Spring Boot backend that powers authentication, expenses, income, budgets, subscriptions, savings goals, reports, exports, Google Sign-In, and WebAuthn/passkey authentication.

> **Primary database:** Neon PostgreSQL  
> **Failover snapshot:** encrypted SQLite in the public GitHub repository  
> **Runtime:** Spring Boot + Java 26  
> **Container:** Docker on Hugging Face Spaces  
> **Port:** `7860`

## 🚀 What this Space does

- 🔐 JWT authentication and account security
- 🔑 Google Sign-In with server-side token validation
- 🧬 WebAuthn / passkey authentication for supported browsers and devices
- 💸 Expense and income management
- 🎯 Budgets and savings goals
- 🔄 Recurring subscriptions and income
- 📊 Monthly, custom-range, and all-time financial reporting
- 📄 PDF and Excel report generation
- 📥 CSV / JSON data export
- 🛡️ CORS, validation, security headers, and protected API endpoints
- 🧯 Automatic database failover when Neon becomes unreachable

## 🏗️ Production database architecture

```text
Web browser / Android app
          │
          ▼
  Hugging Face Space
  Spring Boot API
          │
     ┌────┴─────┐
     │          │
     ▼          ▼
 Neon DB    Local H2 failover
(primary)   hydrated from the
            encrypted snapshot
                 │
                 ▼
       Public GitHub repository
       database/expense_tracker.sqlite.enc
```

### How the database backup works

1. **Neon is authoritative while reachable.**
2. Every 10 minutes the backend exports the currently active database to a portable SQLite snapshot.
3. The SQLite snapshot is encrypted with **AES-256-GCM** before it is committed to GitHub.
4. The public repository therefore contains an encrypted database blob, not a readable SQLite database.
5. The encryption password and GitHub write token exist only as deployment secrets.
6. If Neon becomes unavailable, the backend routes database access to its local emergency H2 store, hydrated from the latest encrypted GitHub snapshot.
7. Reads and writes continue against that failover store while the service is in emergency mode, and updated encrypted snapshots are pushed back to GitHub.

The repository snapshot is intentionally **not** a Hugging Face Storage Bucket and is not stored in the Space image.

## 🔒 Database security

The repository is public, so the failover database is never committed as plaintext SQLite.

The protected snapshot uses:

- AES-256-GCM authenticated encryption
- PBKDF2-HMAC-SHA256 password derivation with 600,000 iterations
- Random salt and nonce for every snapshot
- GitHub Contents API for controlled updates

The repository blocks plaintext `*.db`, `*.sqlite`, `*.sqlite3`, and `expenses_sync.json` files from being reintroduced.

**Never put `DB_BACKUP_PASSWORD`, `GITHUB_DB_TOKEN`, `SYNC_SECRET_KEY`, `JWT_SECRET`, database passwords, or OAuth secrets in Git.**

## 🔑 Required runtime secrets

```text
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
GOOGLE_OAUTH_CLIENT_ID
JWT_SECRET
CORS_ALLOWED_ORIGINS
GITHUB_DB_TOKEN
DB_BACKUP_PASSWORD
SYNC_SECRET_KEY
```

`GITHUB_DB_TOKEN` needs permission to update the encrypted snapshot in `Yoge-2004/expense-tracker`. `DB_BACKUP_PASSWORD` must be identical wherever the snapshot is encrypted/decrypted.

## 🧪 API & documentation

When enabled by the deployment configuration, the backend exposes OpenAPI/Swagger documentation and standard health endpoints.

The API is consumed by:

- Expense Tracker Web
- Expense Tracker Android / Expo application

## 🔄 Deployment

The backend is built from the main GitHub repository and deployed automatically to this Space by GitHub Actions.

Each deployment synchronizes:

- `app.jar`
- `Dockerfile`
- this `README.md`

The encrypted database snapshot is deliberately **not** packaged into the Docker image. The backend downloads it from GitHub at runtime using its deployment secret.

## 🛡️ Data safety principle

> **Neon is authoritative while healthy. GitHub stores the encrypted failover snapshot. HF compute is replaceable. No plaintext user database belongs in a public repository or container image.**

## 👤 Project

Built and maintained by **Yoge-2004** as the backend for the Expense Tracker project.

- Main project: `Yoge-2004/expense-tracker`
- Backend Space: `Yoge-2004/expense-tracker-backend`

---

### ⚠️ Production note

Do not upload `*.db`, `*.sqlite`, `*.sqlite3`, plaintext JSON exports containing user records, or any other readable database snapshot to this public Space repository.
