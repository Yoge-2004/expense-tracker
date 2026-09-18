# Expense Intelligence ML Design

## Goal
Build a separate Python ML subsystem for Expense Tracker that learns transaction descriptions and predicts expense categories, while leaving Spring Boot responsible for application business logic and persistence.

## Scope
Phase 1 implements category classification only. The design leaves clean interfaces for later merchant/entity extraction, semantic similarity, recurring-pattern detection, anomaly detection, and spending prediction.

## Architecture
The repository gains an `ml/` Python project. Dataset adapters normalize external transaction datasets into a common schema (`text`, `label`, `source`). A deterministic preprocessing layer cleans narrations. Training produces a TF-IDF + linear baseline and a Transformer classifier. Evaluation reports accuracy, macro/weighted F1, per-class metrics, confusion matrix, and an India-focused holdout slice. The selected model is exported with its label mapping and preprocessing metadata.

Training is offline. The production application does not train models. A later integration can expose inference through a small service or export an on-device compatible model; this phase does not add runtime inference to Spring Boot yet.

## Data policy
Datasets are referenced by configurable local paths or Hugging Face dataset identifiers. No dataset is committed into the Git repository. The pipeline records source names and dataset fingerprints so runs are reproducible. Personal financial data from the application must never be included in training unless explicitly anonymized and opted in.

## Model strategy
1. TF-IDF word+character n-grams with Logistic Regression is the baseline.
2. A compact Transformer sequence classifier is the neural candidate.
3. Selection is evidence-based using held-out metrics and an India-focused evaluation slice; no model is assumed to be best before measurement.
4. Confidence is retained with every prediction so the application can later require user confirmation below a configurable threshold.

## Future extension points
- Merchant normalization / semantic similarity via sentence embeddings.
- NER for merchant, location, reference and other transaction entities.
- Recurring-expense detection using temporal and merchant features.
- Anomaly detection using historical user-level patterns.
- Spending prediction using aggregated time-series features.

## Success criteria
- Reproducible dataset preparation.
- Leakage-safe train/validation/test split.
- Baseline and Transformer can both be trained from the same normalized dataset.
- Evaluation artifacts are saved in a versioned run directory.
- Exported model includes labels and preprocessing metadata.
- No application secrets or personal transaction records are committed.
