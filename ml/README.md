# Expense Tracker ML

Offline training subsystem for transaction intelligence. It currently trains expense-category classifiers; inference integration is deliberately separate from the Spring Boot application.

## Setup

```bash
cd ml
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

## Prepare data

Raw datasets are not committed. Configure `config/datasets.yaml` with exact dataset IDs or local files and their column names.

```bash
python -m expense_ml.cli prepare
```

The output is `data/prepared/transactions.parquet` plus a statistics/fingerprint JSON file.

## Train

```bash
python -m expense_ml.cli train --model tfidf
python -m expense_ml.cli train --model transformer
python -m expense_ml.cli train --model both
```

The TF-IDF baseline uses word and character n-grams with class-weighted Logistic Regression. The neural candidate is a configurable multilingual Transformer. Model comparison uses macro F1 on an untouched test set; an India-focused holdout is reported separately when the source metadata identifies Indian datasets.

## Reproducibility

Use the same seed and preserve the generated dataset fingerprint and configuration with every run. Never put personal transaction data, secrets, or raw datasets in Git.

## Current datasets

The default manifest includes `PolyAI/banking77` because it is a public, reproducible banking-intent dataset. The previously discussed global and Indian transaction-category datasets must be added by their verified dataset IDs or local paths before they are included in a production training run; their schemas are intentionally not guessed by this repository.
