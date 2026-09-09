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

This Space runs the Spring Boot backend for authentication, expenses, income, budgets, subscriptions, savings goals, reports, exports, Google Sign-In, and WebAuthn/passkey authentication.

> **Primary database:** Neon PostgreSQL  
> **Failover database snapshot:** encrypted SQLite stored in this Hugging Face Space repository  
> **Runtime:** Spring Boot + Java 26  
> **Container:** Docker on Hugging Face Spaces  
> **Port:** `7860`

## 🚀 Production database architecture

```text
Web browser / Android app
          │
          ▼
  Hugging Face Space
      Spring Boot
          │
     ┌────┴─────┐
     │          │
     ▼          ▼
 Neon DB    Local H2 failover
(primary)   hydrated from the
            latest HF snapshot
                 │
                 ▼
      Hugging Face Space repo
      database/expense_tracker.sqlite.enc
```

### How it works

1. **Neon is the source of truth while it is reachable.**
2. The backend periodically exports the active database into a portable SQLite snapshot.
3. The snapshot is encrypted with **AES-256-GCM** before being uploaded to this Space repository.
4. The Space repository therefore contains an encrypted database blob, not a readable SQLite database.
5. **One secret key is enough**: `DB_BACKUP_KEY`. It is kept only in the Space's secret environment and is never committed to GitHub or the HF repository.
6. If Neon fails, the backend downloads the latest encrypted snapshot from this HF Space repository, decrypts it in memory/runtime storage, and hydrates the local emergency database.
7. Reads and writes then continue against the emergency database.
8. New changes made during failover are included in the next encrypted snapshot, so the HF repository remains the latest recovery point.

This uses the **Hugging Face Space repository itself**, not a Storage Bucket.

## 🔒 Database security

The Space repository may be public. That is safe for the snapshot because the SQLite database is **encrypted before upload**.

Protection uses:

- AES-256-GCM authenticated encryption
- PBKDF2-HMAC-SHA256 key derivation
- Random salt and nonce for every snapshot
- A single secret `DB_BACKUP_KEY` for encryption/decryption
- No plaintext database file in the repository

The main GitHub source repository also blocks plaintext `*.db`, `*.sqlite`, and `*.sqlite3` database files from being committed.

**Never place `DB_BACKUP_KEY`, `HF_TOKEN`, `JWT_SECRET`, database passwords, or OAuth secrets in source control.**

## 🔑 Required runtime secrets

```text
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
GOOGLE_OAUTH_CLIENT_ID
JWT_SECRET
CORS_ALLOWED_ORIGINS
HF_TOKEN
DB_BACKUP_KEY
```

`HF_TOKEN` needs permission to update the `Yoge-2004/expense-tracker-backend` Space repository. `DB_BACKUP_KEY` must be the same secret wherever snapshots are encrypted and decrypted.

## 🧯 Failover behavior

The failover database is a **recovery database**, not a second live Neon server. It is refreshed from the latest encrypted snapshot. Therefore, the maximum possible data loss is the time since the last successful snapshot.

When Neon is healthy again, production should return to Neon as the authoritative database and a fresh snapshot should be produced.

## 📦 Deployment

The backend is built from the main GitHub repository and deployed automatically to this Space by GitHub Actions. The deployment synchronizes the application JAR, Dockerfile, and this Space metadata/README.

The database snapshot is managed separately by the running backend and is never baked into the Docker image.

## 🛡️ Data safety principle

> **Neon is authoritative while healthy. Hugging Face stores the encrypted recovery snapshot. The application can continue reads/writes from the latest snapshot when Neon is unavailable. No plaintext user database belongs in a public repository.**

## 👤 Project

Built and maintained by **Yoge-2004** as the backend for the Expense Tracker project.

- Main project: `Yoge-2004/expense-tracker`
- Backend Space: `Yoge-2004/expense-tracker-backend`

---

### ⚠️ Production note

Do not upload `*.db`, `*.sqlite`, `*.sqlite3`, plaintext JSON exports containing user records, or any other readable database snapshot to this public Space repository.
