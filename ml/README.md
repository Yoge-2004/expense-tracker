# Expense Tracker ML

Offline training and production inference subsystem for transaction intelligence. Heavy training runs locally with `uv` or in automated Hugging Face Jobs; the production Space runs Python inference only.

## Local setup with uv

The project baseline is Python 3.14. The `.python-version` file pins the project to that interpreter family.

```bash
cd ml
uv python install 3.14
uv lock
uv sync --all-extras --dev
```

`uv.lock` is the reproducibility boundary. Keep it in version control once generated on your development machine. The `train`, `serve`, and `dev` dependency groups deliberately separate training workloads from production serving.

## Local training

For the first clean run, remove an old prepared dataset so it is rebuilt with the current normalization version:

```bash
rm -f data/prepared/transactions.parquet
```

Then:

```bash
uv run expense-ml prepare
uv run expense-ml train --model both
```

The reusable master job is also callable through the training package. Full runs write timestamped artifacts under `artifacts/master-runs/`.

For a CPU-oriented smoke run:

```bash
EXPENSE_ML_NO_TRANSFORMER=1 uv run python -m expense_ml.master_pipeline
```

## Continuous learning

Production user corrections are stored by Spring Boot. The Python automation job reads only `eligible` feedback records and combines them with the curated base corpus.

```text
user correction
      ↓
Spring Boot database
      ↓
internal ML feedback API
      ↓
Hugging Face scheduled training job
      ↓
curated corpus + verified feedback
      ↓
master training pipeline
      ↓
quality gates
      ↓
versioned model + production revision
      ↓
restart/check serving Space
      ↓
consume feedback
```

The default automation threshold is 500 new eligible records. A scheduled run below the threshold exits without GPU training. `EXPENSE_ML_FORCE_RETRAIN=1` bypasses the threshold for an intentional manual run.

## Model versioning

The automated publisher maintains two kinds of revisions in the model repository:

```text
v<run-id>     immutable candidate history
production   current serving revision
```

The production Space consumes the explicit `MODEL_REVISION=production` variable. The previous version branches are retained so a rollback can restore a previously known-good model to `production`.

## Inference API

The production Python service exposes:

```text
GET  /health
POST /api/v1/classify
POST /api/v1/analyze
```

The existing Spring Boot backend calls the Python service over `http://127.0.0.1:8000` inside the combined Space container. Public application traffic continues to enter through Spring Boot.

See `README_INFERENCE.md` for the request/response contract and deployment configuration.

## Automated training environment

Hugging Face Jobs are the intended unattended training environment after the local pipeline is proven. The job entrypoint is:

```bash
uv run python jobs/retrain.py
```

Required environment variables include:

```text
HF_TOKEN
HF_MODEL_REPO
HF_SPACE_REPO
HF_SPACE_URL
EXPENSE_ML_FEEDBACK_URL
EXPENSE_ML_FEEDBACK_TOKEN
```

Do not commit these values. The training job publishes only candidates that pass the configured quality and non-regression gates.

## Current datasets

The default category-training manifest uses:

```text
mitulshah/transaction-categorization
Ranjit0034/finee-dataset
Sumeetgpt/indian-transaction-categorization-synthetic
```

Raw datasets and personal transaction data are never committed to Git.

## Resource tuning

```text
EXPENSE_ML_CPU_THREADS=auto
EXPENSE_ML_TORCH_THREADS=auto
EXPENSE_ML_DATALOADER_WORKERS=8
EXPENSE_ML_BATCH_SIZE=32
EXPENSE_ML_EVAL_BATCH_SIZE=64
EXPENSE_ML_MIXED_PRECISION=auto
EXPENSE_ML_MAX_MERCHANTS=250000
EXPENSE_ML_DUPLICATE_MAX_ROWS=500000
EXPENSE_ML_NORMALIZE_CHUNK_SIZE=250000
```

## Security and data safety

Never put Hugging Face tokens, JWT secrets, database passwords, raw transaction exports, model credentials, or plaintext user data in source control. Python does not write directly to the Spring Boot business database; it consumes only the dedicated feedback API.
