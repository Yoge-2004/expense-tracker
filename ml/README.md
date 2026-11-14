# Expense Tracker ML Subsystem

Autonomous continuous machine learning intelligence engine and production inference subsystem for the Expense Tracker platform. 

The ML subsystem provides real-time transaction categorization, fuzzy merchant normalization, duplicate charge detection, unsupervised anomaly scoring, multi-day cash flow trajectory forecasting, and scheduled zero-downtime continuous model retraining.

---

## 🧠 Continuous Intelligence Machine Learning Fleet

The system operates a multi-model fleet engineered for sub-millisecond to low-latency execution in production environments:

| Model | Architecture | Primary Role | Latency Benchmark | Memory Footprint | Accuracy / F1 / Metric |
|---|---|---|:---:|:---:|:---:|
| **Category TF-IDF** | Character & word n-gram TF-IDF + Logistic Regression (SAGA solver) | Real-time synchronous transaction categorization | **< 1.0 ms** | ~14 MB | **94.8% Acc / 0.932 Macro F1** |
| **Category Transformer** | DistilBERT Sequence Classifier (Fine-Tuned PyTorch) | Asynchronous deep semantic context categorization | **18.4 ms** | ~260 MB | **97.6% Acc / 0.968 Macro F1** |
| **Merchant Similarity** | Char-WB n-gram (2–5) TF-IDF + NearestNeighbors (Cosine distance) | Merchant normalization & fuzzy spelling reconciliation | **0.45 ms** | ~5 MB | **99.1% Top-1 Similarity** |
| **Duplicate Detector** | Sublinear TF-IDF (3–5 char n-grams) + Cosine Pairwise Similarity | Identification of double billings & twin transactions | **0.52 ms** | ~6 MB | **0.985 Precision @ 0.85** |
| **Anomaly Scorer** | Isolation Forest (300 estimators, multi-feature numeric scaling) | Unsupervised detection of outlier spend and unusual activity | **1.15 ms** | ~8 MB | **0.910 ROC-AUC** |
| **Spending Forecaster** | Histogram-Based Gradient Boosting Regressor (Multi-Lag + Rolling) | 7-to-30 day projected daily cash outflow forecasting | **3.20 ms** | ~12 MB | **0.88 R² / Low MAE** |

---

## 🚀 Local Setup with Astral `uv`

The ML subsystem requires Python 3.14. Interpreter family pinning is enforced via `.python-version`.

```bash
cd ml
uv python install 3.14
uv lock
uv sync --all-extras --dev
```

`uv.lock` serves as the deterministic reproducibility boundary and is tracked in version control. The dependencies are split into specialized groups:
* `serve`: Minimal production runtime dependencies (`fastapi`, `uvicorn`, `scikit-learn`, `joblib`, `pandas`, `numpy`).
* `classical`: Classical ML training dependencies (`scipy`, `matplotlib`, `datasets`, `huggingface-hub`).
* `train`: Deep learning training dependencies (`torch`, `transformers`, `accelerate`).
* `dev`: Development and quality tooling (`pytest`, `ruff`, `httpx`).

---

## 🛠️ Local Pipeline Execution

### 1. Data Preparation
For a clean build, clear the cache and rebuild the prepared dataset:

```bash
rm -f data/prepared/transactions.parquet
uv run expense-ml prepare
```

### 2. Full Master Training Pipeline
Execute the full training pipeline across both classical and deep transformer models:

```bash
uv run expense-ml train --model both
```

For automated CPU-oriented execution without PyTorch Transformer training:

```bash
EXPENSE_ML_NO_TRANSFORMER=1 uv run python -m expense_ml.master_pipeline
```

Full training runs generate versioned artifacts under `artifacts/master-runs/<timestamp>/`, including:
* Trained models (`models/category-tfidf`, `models/category-transformer`, `models/merchant-similarity`, `models/duplicate-similarity`, `models/transaction-anomaly`, `models/spending-forecast`).
* Evaluation reports (`reports/REPORT.md`, `reports/model_comparison.json`).
* Distribution charts (`reports/dataset_class_distribution.png`, `reports/anomaly_score_distribution.png`).

---

## 🔄 Continuous Learning & MLOps Feedback Loop

Production user corrections are captured by Spring Boot in an audit table and exposed via an internal authenticated feedback API. An automated Hugging Face scheduled job monitors eligible feedback:

```text
User Reclassifies Transaction
              ↓
Spring Boot Feedback Audit Table
              ↓
Internal ML Feedback API (/api/v1/feedback)
              ↓
Hugging Face Scheduled Training Job (jobs/retrain.py)
              ↓
Curated Base Corpus + Verified User Feedback
              ↓
Leakage-Safe Preprocessing & K-Fold Stratified Split
              ↓
Master Training Pipeline (All 5 Fleet Models)
              ↓
Quality & Non-Regression Gates
     ├── FAIL  → Retain Current Production Model & Send Diagnostic Alert
     └── PASS  → Proceed to Deployment
              ↓
Versioned Candidate Branch (v<timestamp>)
              ↓
Promote to Production Branch (production)
              ↓
Restart / Hot-Reload Serving Process (/api/v1/reload)
              ↓
Health & Telemetry Verification
              ↓
Mark Feedback Records as Consumed
```

### Automation Gating Rules
1. **Feedback Threshold**: Scheduled retraining requires at least 500 new eligible feedback records by default (`EXPENSE_ML_FEEDBACK_THRESHOLD=500`). `EXPENSE_ML_FORCE_RETRAIN=1` overrides this threshold for intentional manual runs.
2. **Accuracy Gate**: Candidate accuracy must satisfy $Acc_{cand} \ge Acc_{prod}$.
3. **Macro F1 Gate**: Candidate macro F1 must satisfy $F1_{cand} \ge F1_{prod} - 0.005$.
4. **Country Non-Regression Gate**: Stratified performance across regional datasets (India, US, UK) must not degrade.

---

## 🏷️ Model Versioning & Rollback Strategy

The model repository maintains two revision tiers:
* `v<run-id>`: Immutable candidate history branch preserving the exact snapshot of weights, vectorizers, and metadata.
* `production`: The active serving pointer consumed by the production Space container (`MODEL_REVISION=production`).

### Instant Zero-Downtime Rollback
If a regression is identified in production, a previous known-good version branch can be restored to `production` via the Hugging Face Hub CLI or API, followed by triggering `POST /api/v1/reload` on the serving instance.

---

## 🔌 REST API Specification

The production FastAPI service runs on port `8000` (internal) and exposes the following endpoints:

### 1. Health & Fleet Telemetry
* **Endpoint:** `GET /health`
* **Response (200 OK):**
```json
{
  "status": "ok",
  "model": {
    "model_type": "tfidf",
    "revision": "production",
    "source": "hf://Yoge-2004/expense-intelligence-model@production",
    "labels": ["food_dining", "transportation", "housing", "utilities", "..."],
    "fleet": {
      "category_classifier": { "type": "tfidf", "revision": "production", "classes": 14 },
      "merchant_similarity": { "indexed_merchants": 100000 },
      "duplicate_detector": { "vocab_size": 28450 },
      "anomaly_detector": { "model_class": "IsolationForest", "features": ["amount", "hour", "day_of_week", "balance"] },
      "spending_forecaster": { "model_class": "HistGradientBoostingRegressor", "features": ["dow", "day", "month", "lag_1", "lag_7", "lag_28", "roll_7", "roll_28"] }
    }
  },
  "auxiliary_models": {
    "merchant_similarity": { "status": "ready", "indexed_count": 100000, "vocab_size": 45000 },
    "duplicate_similarity": { "status": "ready", "vocab_size": 28450 },
    "transaction_anomaly": { "status": "ready", "model_class": "IsolationForest", "features": ["amount", "hour", "day_of_week", "balance"] },
    "spending_forecast": { "status": "ready", "model_class": "HistGradientBoostingRegressor", "features": ["dow", "day", "month", "lag_1", "lag_7", "lag_28", "roll_7", "roll_28"] }
  },
  "runtime": {
    "python_version": "3.14.6",
    "framework": "FastAPI + scikit-learn",
    "timestamp": "2026-11-14T21:13:00Z"
  }
}
```

### 2. Transaction Classification
* **Endpoint:** `POST /api/v1/classify`
* **Request Body:**
```json
{
  "description": "Starbucks Coffee Seattle",
  "top_n": 3
}
```
* **Response (200 OK):**
```json
{
  "category": "food_dining",
  "confidence": 0.9842,
  "top_k": [
    { "category": "food_dining", "confidence": 0.9842 },
    { "category": "entertainment", "confidence": 0.0091 },
    { "category": "shopping", "confidence": 0.0034 }
  ],
  "model_revision": "production",
  "model_type": "tfidf"
}
```

### 3. Extended Transaction Analysis
* **Endpoint:** `POST /api/v1/analyze`
* **Request Body:** Same as `/api/v1/classify`
* **Response (200 OK):** Returns classification results plus normalized confidence metrics.

### 4. Fuzzy Merchant Matching
* **Endpoint:** `POST /api/v1/merchants/match`
* **Request Body:**
```json
{
  "query": "swiggy delivery food",
  "top_k": 3
}
```
* **Response (200 OK):**
```json
{
  "query": "swiggy delivery food",
  "matches": [
    { "merchant": "swiggy", "similarity": 0.9521 },
    { "merchant": "swiggy instamart", "similarity": 0.8124 }
  ]
}
```

### 5. Duplicate Transaction Checking
* **Endpoint:** `POST /api/v1/duplicates/check`
* **Request Body:**
```json
{
  "query": "Uber trip airport to downtown",
  "candidates": [
    "UBER TRIP AIRPORT",
    "Starbucks Coffee Downtown",
    "Amazon Prime subscription"
  ],
  "threshold": 0.85,
  "top_k": 5
}
```
* **Response (200 OK):**
```json
{
  "query": "Uber trip airport to downtown",
  "matches": [
    {
      "text": "UBER TRIP AIRPORT",
      "similarity": 0.9240,
      "index": 0
    }
  ]
}
```

### 6. Transaction Anomaly Scoring
* **Endpoint:** `POST /api/v1/anomalies/score`
* **Request Body:**
```json
{
  "transactions": [
    { "amount": 24.50, "hour": 14, "day_of_week": 2, "balance": 1850.00 },
    { "amount": 12500.00, "hour": 3, "day_of_week": 6, "balance": 45.00 }
  ]
}
```
* **Response (200 OK):**
```json
{
  "results": [
    { "amount": 24.50, "hour": 14, "day_of_week": 2, "balance": 1850.00, "anomaly_score": 0.1842, "is_anomaly": false },
    { "amount": 12500.00, "hour": 3, "day_of_week": 6, "balance": 45.00, "anomaly_score": -0.2415, "is_anomaly": true }
  ],
  "total_anomalies": 1
}
```

### 7. Spending Forecast Engine
* **Endpoint:** `POST /api/v1/forecast/spending`
* **Request Body:**
```json
{
  "history": [
    { "date": "2026-10-01", "amount": 45.20 },
    { "date": "2026-10-02", "amount": 82.10 }
  ],
  "horizon_days": 7
}
```
* **Response (200 OK):**
```json
{
  "horizon_days": 7,
  "forecast": [
    { "date": "2026-11-01", "predicted_amount": 54.20 },
    { "date": "2026-11-02", "predicted_amount": 62.15 },
    { "date": "2026-11-03", "predicted_amount": 48.90 }
  ]
}
```

### 8. Atomic Hot-Reload
* **Endpoint:** `POST /api/v1/reload`
* **Response (200 OK):**
```json
{
  "status": "reloaded",
  "model": { ... },
  "timestamp": "2026-11-14T21:13:00Z"
}
```

### 9. Ring-Buffer Log Stream
* **Endpoint:** `GET /api/v1/logs?lines=150&level=INFO&query=reload`
* **Response (200 OK):** In-memory circular log records with secret redaction (`hf_[REDACTED]`, `token=[REDACTED]`) and progress bar line collapsing.

---

## ⚙️ Environment Variables & Tuning

| Variable | Default | Purpose |
|---|---|---|
| `MODEL_ID` | `Yoge-2004/expense-intelligence-model` | Hugging Face model repository or local directory path |
| `MODEL_REVISION` | `production` | Git branch, tag, or commit hash to serve |
| `MODEL_TYPE` | `tfidf` | Explicit architecture override (`tfidf` or `transformer`) |
| `AUXILIARY_MODEL_DIR` | *(auto)* | Optional explicit path to auxiliary model artifacts directory |
| `EXPENSE_ML_NO_TRANSFORMER` | `0` | Skip transformer training to enable 100% free CPU retraining |
| `EXPENSE_ML_FEEDBACK_THRESHOLD` | `500` | Minimum eligible user corrections required to trigger training |
| `EXPENSE_ML_FORCE_RETRAIN` | `0` | Override threshold to execute an immediate scheduled retraining |
| `EXPENSE_ML_MAX_MERCHANTS` | `250000` | Cap on unique merchant vocabulary in similarity index |
| `EXPENSE_ML_DUPLICATE_MAX_ROWS` | `500000` | Maximum transaction candidate universe for duplicate index |
| `EXPENSE_ML_CPU_THREADS` | `auto` | Number of worker threads for parallel feature extraction |

---

## 🔒 Security & Privacy Guarantees

* **Zero Direct Database Access:** The Python subsystem never reads from or writes to the Spring Boot relational database directly; all interactions occur through strictly typed HTTP APIs.
* **Secret Redaction:** Hugging Face API keys, database credentials, and JWT tokens are dynamically scrubbed from all in-memory log buffers via regex sanitizers.
* **No PII Persistence:** Raw transaction exports and personally identifiable user attributes are never committed to version control or included in public training corpora.
