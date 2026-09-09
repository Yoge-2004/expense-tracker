---
title: Expense Tracker API
description: Production Spring Boot API for the Expense Tracker web and mobile applications.
emoji: 💰
colorFrom: yellow
colorTo: red
sdk: docker
app_port: 7860
short_description: Secure, production-ready Expense Tracker backend with PostgreSQL, WebAuthn, reports, and resilient runtime controls.
---

# 💰 Expense Tracker — Backend API

**The production API behind Yoge-2004's Expense Tracker web and Android applications.**

This Space runs the Spring Boot backend that powers authentication, expenses, income, budgets, subscriptions, savings goals, reports, exports, Google Sign-In, and WebAuthn/passkey authentication.

> **Production database:** Neon PostgreSQL  
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
- 🩺 Production health and resilience controls

## 🏗️ Architecture

```text
Web browser / Android app
          │
          ▼
  Hugging Face Space
  Spring Boot API
          │
          ▼
   Neon PostgreSQL
   (authoritative data)
```

The Space is intentionally **stateless**. User data is not committed into the Space repository or Docker image.

### Database resilience

Neon PostgreSQL remains the source of truth. The backend also contains an emergency local datastore path that can be backed by an attached Hugging Face Storage Bucket mounted at `/data`.

**Important:** a local SQLite/H2 file is not automatically a live replica of Neon. A stale file must never be presented as current user data. For production disaster recovery, the persistent storage/backup process must be configured separately.

Hugging Face's default Space filesystem is ephemeral; persistent data requires a mounted Storage Bucket or another external storage service.

## 🔒 Secrets

Secrets are configured through Hugging Face Space Secrets / environment variables and are never stored in this README or Docker image.

Typical production variables include:

```text
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
GOOGLE_OAUTH_CLIENT_ID
JWT_SECRET
CORS_ALLOWED_ORIGINS
```

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

No application user data is packaged into the deployment artifact.

## 🛡️ Data safety principle

This service follows a simple rule:

> **Neon is the source of truth. HF compute is replaceable. User data must live outside the container image.**

For true zero/low-data-loss failover, use a persistent backup or a second PostgreSQL service rather than relying on an ephemeral container filesystem.

## 👤 Project

Built and maintained by **Yoge-2004** as the backend for the Expense Tracker project.

- Main project: `Yoge-2004/expense-tracker`
- Backend Space: `Yoge-2004/expense-tracker-backend`

---

### ⚠️ Production note

This Space is an application runtime, not a database host. Do not upload `*.db`, `*.sqlite`, `*.json` exports containing user records, or other live database snapshots to this public Space repository.
