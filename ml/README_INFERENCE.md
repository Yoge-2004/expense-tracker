# Expense Tracker ML Inference

## Runtime

The production Hugging Face Space runs the existing Spring Boot backend and this Python FastAPI service in one Docker container.

```text
Nginx :7860
   ├── public application traffic → Spring Boot :8080
   └── /health → Python ML :8000

Spring Boot :8080
   └── http://127.0.0.1:8000/api/v1/classify → FastAPI
```

Python is inference-only in the production image. Training happens outside the serving container.

## Model configuration

Set these Hugging Face Space variables:

```text
MODEL_ID=Yoge-2004/expense-intelligence-model
MODEL_REVISION=production
MODEL_TYPE=transformer
```

The model registry requires an explicit model identifier. For a private model repository, the Space must also have `HF_TOKEN` configured as a secret with read access.

## Python API

### Health

```http
GET /health
```

Example:

```json
{
  "status": "ok",
  "model": {
    "model_type": "transformer",
    "revision": "production",
    "source": "hf://Yoge-2004/expense-intelligence-model@production"
  }
}
```

The endpoint loads the configured model before reporting `status: ok`.

### Classification

```http
POST /api/v1/classify
Content-Type: application/json

{
  "description": "Swiggy order",
  "top_n": 3
}
```

Response:

```json
{
  "category": "food_dining",
  "confidence": 0.97,
  "top_k": [
    {"category": "food_dining", "confidence": 0.97}
  ],
  "model_revision": "production",
  "model_type": "transformer"
}
```

The Spring Boot backend exposes the authenticated application-facing facade:

```http
POST /api/ml/classify
```

Spring forwards the request internally to Python and retains responsibility for authentication, authorization, persistence, and business rules.

## User feedback

When a user corrects a classification, the authenticated backend accepts:

```http
POST /api/ml/feedback
Content-Type: application/json
Authorization: Bearer <user-jwt>

{
  "transactionId": "123",
  "text": "Swiggy order",
  "predictedCategory": "shopping_retail",
  "correctedCategory": "food_dining",
  "confidence": 0.71,
  "modelVersion": "production"
}
```

Spring Boot stores the record as training-eligible feedback. The Python training job reads feedback only through the dedicated internal endpoint and never connects directly to the business database.

## Automated retraining

The normal job entrypoint is:

```bash
uv run python jobs/retrain.py
```

It performs:

```text
eligible feedback fetch
        ↓
validation / conflict detection
        ↓
base corpus + verified feedback
        ↓
leakage-safe split
        ↓
validation and final test
        ↓
candidate manifest
        ↓
production comparison
        ↓
version branch
        ↓
production branch
        ↓
Space restart + health check
        ↓
feedback consumption acknowledgement
```

Below the configured feedback threshold the job exits successfully without training. Rejected candidates remain in the run artifacts and do not modify production.

## One-time Hugging Face schedule

The repository includes `jobs/schedule_hf_retraining.py` so the schedule can be created without manually typing a complex Job command.

First authenticate `uv`/Hugging Face and provide the two secret values through your environment. Then run:

```bash
HF_TOKEN=*** \
EXPENSE_ML_FEEDBACK_TOKEN=*** \
uv run --extra train python jobs/schedule_hf_retraining.py
```

The script creates one scheduled Job named `expense-tracker-ml-retrain`, uses an `a10g-large` flavor by default, disallows concurrent runs, and encrypts the supplied secrets server-side. Hugging Face supports scheduled UV jobs, cron expressions, encrypted job secrets, and GPU flavors. citeturn209868search0turn209868search1turn227426search1

The scheduled wrapper is a small stable script that downloads the current `main` branch on every run, so the job picks up new repository code without being recreated after every code change.

## Rollback

The model repository retains immutable candidate revisions such as:

```text
v20260918T020000Z
v20260925T020000Z
v20261002T020000Z
```

The production branch is the serving pointer. To roll back, restore the desired version's model files and metadata to the `production` revision and restart the Space. Do not delete historical version branches.

## Secrets

Never commit:

```text
HF_TOKEN
EXPENSE_ML_FEEDBACK_TOKEN
ML_FEEDBACK_TOKEN
JWT_SECRET
DB_BACKUP_KEY
SPRING_DATASOURCE_PASSWORD
```

The feedback token is server-to-server authentication between the training Job and Spring Boot. It is not a user JWT and is never exposed to browser clients.
