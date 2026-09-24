---
title: Expense Tracker API
description: Production Spring Boot + Python ML API for the Expense Tracker web and mobile applications.
emoji: 💰
colorFrom: yellow
colorTo: red
sdk: docker
app_port: 7860
short_description: Secure Expense Tracker API with automated ML inference.
---

# 💰 Expense Tracker — Backend + ML API

**The production API behind Yoge-2004's Expense Tracker web and Android applications.**

This Space runs the Spring Boot backend and the Python ML inference service in one Docker container. Spring Boot remains responsible for authentication, expenses, income, budgets, subscriptions, savings goals, reports, exports, Google Sign-In, and WebAuthn/passkey authentication. Python provides model-backed inference only.

> **Primary database:** Neon PostgreSQL  
> **Failover database snapshot:** encrypted SQLite stored in this Hugging Face Space repository  
> **Application runtime:** Spring Boot + Java 26  
> **ML runtime:** Python 3.14 + FastAPI  
> **Container:** Docker on Hugging Face Spaces  
> **Public gateway:** `7860`  
> **Spring Boot:** `8080` (internal)  
> **Python ML:** `8000` (internal)

## 🚀 Runtime architecture

```text
Web browser / Android app
          │
          ▼
   Hugging Face Space :7860
             │
           Nginx
        ┌────┴────┐
        ▼         ▼
 Spring Boot   Python ML
   :8080         :8000
        │          │
        └── localhost ──► ML inference
```

The public application API is served by Spring Boot. Python ML routes are kept internal to the container; Spring Boot calls `http://127.0.0.1:8000` for inference.

## 🤖 ML inference

Python exposes:

```text
GET  /health
POST /api/v1/classify
POST /api/v1/analyze
```

The active model is identified explicitly through Space variables:

```text
MODEL_ID
MODEL_REVISION
MODEL_TYPE
```

The serving process fails clearly when a configured model cannot be loaded; it does not silently choose an unknown artifact.

## 🔄 Continuous-learning architecture

Production user corrections are stored by Spring Boot in the application database. A separate automated Hugging Face training Job periodically checks the training-eligible feedback count.

```text
User correction
      ↓
Spring Boot ML feedback table
      ↓
training eligibility validation
      ↓
Hugging Face scheduled training Job
      ↓
curated base corpus + verified feedback
      ↓
leakage-safe training/evaluation
      ↓
candidate quality gates
      ├── fail → keep current production model
      └── pass
           ↓
       versioned model branch
           ↓
       production branch
           ↓
       restart serving Space
           ↓
       health-check active revision
           ↓
       mark feedback consumed
```

Training never runs inside this production container.

## 📦 Model versioning

Models are stored in a dedicated Hugging Face model repository and are published to both:

```text
v<run-id>       immutable candidate history
production     current serving revision
```

The Space serves the `production` revision. Previous version branches remain available for rollback.

## 🧯 Database failover

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

Neon remains the authoritative database while reachable. The encrypted SQLite snapshot is a recovery point only.

## 🔒 Security

Required runtime secrets/variables are configured through the Space settings and GitHub Actions secrets. Never commit:

```text
HF_TOKEN
JWT_SECRET
DB_BACKUP_KEY
ML_FEEDBACK_TOKEN
SPRING_DATASOURCE_PASSWORD
```

The ML training endpoint uses a dedicated `X-ML-Training-Token` header. Normal user feedback submission remains protected by the application's JWT authentication.

## 📦 Deployment

GitHub Actions builds the Spring Boot JAR and packages:

```text
app.jar
Dockerfile
docker/
ml/
README.md
```

The Docker image starts Spring Boot, FastAPI, and Nginx under Supervisor. The model is fetched from the configured Hugging Face model repository at the explicit revision supplied by the Space variables.

## 👤 Project

Built and maintained by **Yoge-2004** as the backend and ML serving layer for the Expense Tracker project.

- Main project: `Yoge-2004/expense-tracker`
- Backend + ML Space: `Yoge-2004/expense-tracker-backend`
- Model repository: `Yoge-2004/expense-intelligence-model`
