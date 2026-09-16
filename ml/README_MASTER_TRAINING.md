# Master ML Training Run

The master pipeline is the Kaggle training entrypoint for Expense Tracker ML. It trains and evaluates models, exports artifacts, and does not alter Spring Boot runtime code.

## Run

From the `ml/` directory:

```bash
python kaggle_train.py
```

For a CPU-only smoke run:

```bash
EXPENSE_ML_NO_TRANSFORMER=1 python kaggle_train.py
```

The pipeline creates a timestamped run directory:

```text
artifacts/master-runs/<run-id>/
├── manifest.json
├── models/
│   ├── category-tfidf/
│   ├── category-transformer/        # when Transformer training succeeds
│   ├── merchant-similarity/
│   ├── duplicate-similarity/
│   ├── transaction-anomaly/         # when amount-like data exists
│   └── spending-forecast/            # when date + amount data exists
└── reports/
    ├── REPORT.md
    ├── dataset_quality.json
    ├── dataset_summary.json
    ├── split_summary.json
    ├── tfidf_test.json
    ├── transformer_test.json
    ├── model_comparison.json
    ├── merchant_index.json
    ├── duplicate_candidates.json
    ├── anomaly_report.json
    ├── spending_forecast.json
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

Category models use deterministic train/validation/test splits with duplicate-text removal before splitting. The India-oriented holdout remains separate when the configured sources provide enough examples.

The spending forecaster uses a chronological holdout rather than a random split so future information cannot leak into training.

Similarity, duplicate detection, and anomaly detection are unsupervised systems. Their reports expose coverage, candidate counts, and score distributions instead of inventing supervised accuracy metrics.

Receipt OCR and token-level NER are intentionally not fabricated from transaction-category labels. Those require image/sequence-labelled datasets and should be added as dedicated training jobs when their datasets are introduced.
