# Expense Tracker ML Continuous-Learning Architecture

## Status

Approved architecture for implementation on `feature/ml-expense-intelligence`.

## Goals

- Keep heavy ML training outside the production serving container.
- Support local development/training with `uv` and a modern supported Python version.
- Support automated retraining through Hugging Face Jobs.
- Serve Spring Boot and Python inference from one Hugging Face Docker Space when desired.
- Collect user corrections through the existing Spring Boot backend and database.
- Promote a newly trained model only after automated quality and regression gates pass.
- Keep model versions reproducible and rollbackable.
- Separate training dependencies from inference dependencies.

## Non-goals

- Training models inside the live production container.
- Gradio-based inference UI.
- Treating every user correction as automatically trusted ground truth without validation.
- Replacing Spring Boot business logic with Python ML logic.

## Runtime Architecture

```text
                         Hugging Face Model Hub
                                  ▲
                                  │ validated candidate model
                                  │
                         Hugging Face Training Job
                                  ▲
                                  │ training-eligible feedback
                                  │
                        Spring Boot application DB
                                  ▲
                                  │ user correction / feedback
                                  │
                ┌─────────────────┴─────────────────┐
                │       Hugging Face Docker Space   │
                │                                   │
                │ Spring Boot :8080                 │
                │        │                          │
                │        └── localhost ──► Python   │
                │                        FastAPI    │
                │                         :8000      │
                │                                   │
                │ inference only                    │
                └───────────────────────────────────┘
```

The production container may host both backends, but Python is an inference service only. Training runs execute separately.

## Training Lifecycle

1. The production application records model predictions and user corrections.
2. Feedback is validated and marked as training-eligible by backend/application rules.
3. An automated trigger checks for sufficient new training information or a scheduled retraining window.
4. A Hugging Face Job starts the training pipeline.
5. Training combines the original curated corpus with eligible verified feedback.
6. The existing leakage-safe splitting, ambiguous-text filtering, deterministic sampling, validation, final refit, untouched test evaluation, country metrics, and India holdout gates remain active.
7. A candidate model is exported with provenance and metrics.
8. Automated promotion compares the candidate with the current production model and enforces configured quality gates.
9. A passing candidate is published as a new model version on Hugging Face Hub.
10. Production is pointed at the new model revision. A failed candidate is discarded and the current model remains active.
11. Monitoring can later trigger rollback to the last known-good model revision.

## Feedback Contract

The Spring Boot backend remains authoritative for application data. Python does not write directly to the business database.

A feedback record should contain at least:

- stable transaction or feedback identifier
- transaction text used for classification
- predicted category
- corrected category
- prediction confidence
- model version that produced the prediction
- timestamp
- training eligibility/status

The Python training job consumes only records that satisfy application-defined eligibility and validation rules.

## Training Triggers

Support both mechanisms:

- scheduled checks, such as a daily run
- threshold-based activation when enough new eligible feedback exists

A trigger that finds insufficient new information exits without consuming GPU training resources.

## Candidate Promotion

Candidate artifacts contain:

```text
candidate/
├── manifest.json
├── metrics.json
├── provenance.json
└── model/
```

Promotion gates include:

- data/schema validation
- duplicate and leakage checks
- regression tests
- validation quality thresholds
- immutable test-set evaluation
- country quality thresholds
- India holdout quality threshold when available
- comparison against the current production model

Only candidates that pass all mandatory gates become production revisions.

## Model Versioning

Models are versioned rather than overwritten. The serving layer references an explicit model revision or release identifier. The deployment configuration must permit changing that revision without modifying application code.

The current production revision is retained so a failed deployment can be rolled back quickly.

## Dependency Strategy

`pyproject.toml` uses compatible version ranges instead of historical hard pins. `uv.lock` records the exact versions used for a training or serving build.

Dependency groups are separated conceptually as:

- `train`: PyTorch, Transformers, Datasets, scikit-learn, pandas, NumPy, PyArrow, evaluation and training tooling
- `serve`: FastAPI, Uvicorn, Hugging Face Hub client, model runtime dependencies
- `dev`: pytest, Ruff, and development-only tooling

The local laptop and automated training job install the training group. The production Docker image installs only the serving group plus the exact locked versions required by the serving application.

A deployment requirements export may be generated from the lockfile where a platform integration requires `requirements.txt`.

## Python Baseline

Use the newest stable Python release that is supported by the selected ML stack and Hugging Face Space base image. The project targets Python 3.14 while Python 3.15 remains outside the deployment baseline until the ML stack and Space image support are verified.

## Project Structure

The ML subsystem is organized around independent responsibilities:

```text
ml/
├── src/expense_ml/
│   ├── data/
│   ├── training/
│   │   ├── pipeline.py
│   │   ├── candidate.py
│   │   ├── evaluation.py
│   │   └── promotion.py
│   ├── inference/
│   │   ├── service.py
│   │   └── model_registry.py
│   ├── feedback/
│   │   ├── client.py
│   │   ├── schema.py
│   │   └── validation.py
│   └── ...
├── api/
│   └── main.py
├── jobs/
│   └── retrain.py
├── pyproject.toml
├── uv.lock
└── Dockerfile
```

Existing dataset normalization, taxonomy, splitting, sampling, baseline/Transformer training, evaluation, auxiliary models, and reporting implementations should be reused rather than duplicated.

## Production API Boundary

The Python service exposes machine-oriented HTTP endpoints, including:

```text
GET  /health
POST /api/v1/classify
POST /api/v1/analyze
```

The API returns stable machine-readable JSON. Spring Boot remains responsible for authentication, authorization, persistence, user-facing behavior, business rules, and orchestration.

## Combined Container

The combined Docker Space exposes one external application port through the Space gateway. Internally it runs Spring Boot and Python FastAPI on separate ports and uses a process supervisor and/or reverse proxy to manage both processes. The exact process manager is an implementation detail and must provide clean startup, signal handling, and failure visibility.

Training is never started by the production container.

## Security and Privacy

- No tokens are committed to the repository.
- Hugging Face credentials are supplied through environment/Space secrets.
- Feedback exported for training is limited to training-eligible records.
- Sensitive business data stays under Spring Boot/application ownership unless explicitly selected for model training.
- Model and dataset repositories can be private when required.

## Failure Handling

- Training job failure does not alter production.
- Candidate quality-gate failure does not alter production.
- Model publishing failure does not alter production.
- Production model loading failure must cause the serving layer to fail clearly rather than silently use an unknown artifact.
- Previous known-good model revisions remain available for rollback.

## Testing Strategy

Every implementation change follows test-first development where practical.

Required automated verification includes:

- unit tests for feedback validation
- regression tests for leakage and ambiguous-text handling
- training pipeline smoke tests
- promotion-gate tests
- API contract tests
- Docker build/startup tests
- health endpoint verification
- model loading verification
- CI lint and test checks

The full training corpus is not required for every CI run; CI should use deterministic smoke fixtures while production training jobs execute on the full dataset.

## Migration Strategy

1. Remove environment-specific assumptions from the training entrypoint.
2. Introduce `uv` dependency management and lockfile.
3. Refactor the current master trainer into reusable training-job code.
4. Add feedback schema/validation and a training-data ingestion boundary.
5. Add candidate manifests and promotion logic.
6. Add FastAPI inference service and model registry.
7. Add combined Docker Space runtime for Spring Boot + Python inference.
8. Add automated Hugging Face Job entrypoint and schedule/trigger configuration.
9. Add model publication and production revision configuration.
10. Retain the existing Kaggle wrapper only as optional compatibility tooling until the automated HF workflow is proven.
