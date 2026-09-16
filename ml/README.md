# Expense Tracker ML

Offline training subsystem for transaction intelligence. It currently trains expense-category classifiers and auxiliary models; inference integration is deliberately separate from the Spring Boot application.

## Setup

```bash
cd ml
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

## Prepare and train locally

Raw datasets are not committed. Configure `config/datasets.yaml` with exact dataset IDs or local files and their column names.

```bash
python -m expense_ml.cli prepare
python -m expense_ml.cli train --model both
```

The master pipeline writes timestamped runs under `artifacts/master-runs/` with models, JSON metrics, Markdown reports, and high-resolution PNG figures. `tqdm` shows progress for loading, normalization, evaluation, and pipeline stages.

## Kaggle

Use `notebooks/kaggle_master_training.ipynb` for GPU training. The notebook can attach multiple Kaggle datasets through **Add Input**; attached files appear under `/kaggle/input/<dataset-name>/...`. Set its `KAGGLE_DATASETS` list with the exact file path and source/text/label columns, and it will generate a temporary runtime YAML before invoking the same master pipeline.

See `docs/kaggle-training.md` for the complete setup and resource controls.

## Resource tuning

The pipeline records detected resources and supports:

```text
EXPENSE_ML_CPU_THREADS=auto
EXPENSE_ML_DATALOADER_WORKERS=8
EXPENSE_ML_BATCH_SIZE=32
EXPENSE_ML_EVAL_BATCH_SIZE=64
EXPENSE_ML_MIXED_PRECISION=auto
EXPENSE_ML_MAX_MERCHANTS=250000
EXPENSE_ML_DUPLICATE_MAX_ROWS=500000
EXPENSE_ML_NORMALIZE_CHUNK_SIZE=250000
```

CPU operations use configurable threading; Transformer tokenization/DataLoader use multiple CPU workers; CUDA uses mixed precision when supported. A single Kaggle notebook process normally trains on one GPU. Multi-GPU runs should be launched with distributed `torchrun`.

## Current datasets

The default manifest includes `PolyAI/banking77` because it is a public, reproducible banking-intent dataset. The previously discussed global and Indian transaction-category datasets must be added by their verified dataset IDs or local paths before they are included in a production training run; their schemas are intentionally not guessed by this repository.

## Reproducibility and data safety

Use the same seed and preserve the generated dataset fingerprint and configuration with every run. Never put personal transaction data, secrets, raw datasets, or trained weights in Git.
