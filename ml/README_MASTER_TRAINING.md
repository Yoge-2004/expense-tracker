# Master ML Training Run

The master pipeline is the reusable Expense Tracker ML training engine. It is no longer tied to Kaggle: the same job can run locally with `uv` or inside an automated Hugging Face Job.

## Local run with uv

From the `ml/` directory:

```bash
uv sync --all-extras --dev
uv run python -m expense_ml.master_pipeline
```

For a CPU-oriented smoke run:

```bash
EXPENSE_ML_NO_TRANSFORMER=1 uv run python -m expense_ml.master_pipeline
```

The first clean run should start from a freshly prepared dataset:

```bash
rm -f data/prepared/transactions.parquet
uv run expense-ml prepare
```

The reusable job wrapper is also available as:

```bash
uv run python -c "from expense_ml.training.job import run_training_job; print(run_training_job)"
```

## Automated continuous learning

The unattended Job entrypoint is:

```bash
uv run python jobs/retrain.py
```

A Hugging Face scheduled UV Job runs `jobs/hf_retrain.py`. That stable wrapper downloads the current repository `main` branch on every execution, creates a fresh `uv` environment from the repository metadata, and launches the reusable retraining job. Hugging Face scheduled Jobs support cron schedules, GPU flavors, encrypted secrets, and UV scripts. citeturn380958search0turn209868search1

The one-time scheduler helper is:

```bash
HF_TOKEN=*** \
EXPENSE_ML_FEEDBACK_TOKEN=*** \
uv run --extra train python jobs/schedule_hf_retraining.py
```

The default schedule is daily at `02:00 UTC` and the default GPU flavor is `a10g-large`. The trigger uses a 500-record eligible-feedback threshold, so scheduled checks below that threshold exit without training.

## Training lifecycle

```text
Spring Boot feedback API
        ↓
validated eligible corrections
        ↓
curated base corpus + verified feedback
        ↓
ambiguous-text removal
        ↓
leakage-safe train/validation/test split
        ↓
TF-IDF + Transformer validation
        ↓
validation model selection
        ↓
final refit + untouched test
        ↓
country / India quality gates
        ↓
candidate manifest + metrics
        ↓
production comparison
        ↓
versioned Hugging Face model revision
        ↓
production revision
        ↓
restart + health-check serving Space
        ↓
mark feedback consumed
```

A rejected candidate never replaces the production model.

## Artifacts

```text
artifacts/master-runs/<run-id>/
├── manifest.json
├── models/
│   ├── category-tfidf/
│   ├── category-transformer/
│   ├── merchant-similarity/
│   ├── duplicate-similarity/
│   ├── transaction-anomaly/
│   └── spending-forecast/
└── reports/
    ├── dataset_quality.json
    ├── dataset_summary.json
    ├── split_summary.json
    ├── model_selection_validation.json
    ├── category_test.json
    ├── category_test_country_metrics.json
    ├── model_comparison.json
    ├── candidate/
    │   ├── manifest.json
    │   ├── metrics.json
    │   ├── promotion.json
    │   └── promotion-summary.json
    └── figures/
        ├── dataset_class_distribution.png
        ├── text_length_distribution.png
        ├── tfidf_per_class_metrics.png
        ├── tfidf_confusion_matrix.png
        ├── transformer_per_class_metrics.png
        ├── transformer_confusion_matrix.png
        ├── model_comparison.png
        ├── anomaly_score_distribution.png
        └── spending_forecast.png
```

PNG exports are rendered at high resolution for documentation, presentations, and experiment comparison.

## Validation policy

Category models use deterministic train/validation/test splits, remove ambiguous normalized-text groups, and preserve an India-oriented holdout when configured data provides enough examples. The final test set remains untouched until the selected model has been refit.

The spending forecaster uses a chronological holdout rather than a random split so future information cannot leak into training.

Similarity, duplicate detection, and anomaly detection are unsupervised systems. Their reports expose coverage, candidate counts, and score distributions instead of inventing supervised accuracy metrics.

Receipt OCR and token-level NER are intentionally not fabricated from transaction-category labels. Those require image/sequence-labelled datasets and should be added as dedicated training jobs when their datasets are introduced.

## Model promotion

Models are stored in the configured Hugging Face model repository using:

```text
v<run-id>     immutable candidate revision
production   current serving revision
```

The serving Space is configured with `MODEL_REVISION=production`. Historical versions remain available for rollback.
