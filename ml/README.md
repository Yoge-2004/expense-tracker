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

Raw datasets are not committed. The default `config/datasets.yaml` contains the verified Hugging Face dataset IDs and their column mappings.

```bash
python -m expense_ml.cli prepare
python -m expense_ml.cli train --model both
```

The master pipeline writes timestamped runs under `artifacts/master-runs/` with models, JSON metrics, Markdown reports, and high-resolution PNG figures. `tqdm` shows progress for loading, normalization, evaluation, and pipeline stages.

## Kaggle — automatic dataset fetching

Use `notebooks/kaggle_master_training.ipynb` with a Kaggle GPU and **Run All**. You do not need to manually upload or attach the standard training datasets. The notebook reads `config/datasets.yaml` and downloads these datasets from Hugging Face automatically:

```text
mitulshah/transaction-categorization
Ranjit0034/finee-dataset
Sumeetgpt/indian-transaction-categorization-synthetic
```

The normalized datasets are cached under `/kaggle/working/expense-ml-data/`, combined into `transactions.parquet`, and then reused by the master training pipeline. Set `EXPENSE_ML_FORCE_FETCH=1` to refresh them.

Additional Kaggle datasets can still be attached through **Add Input** when you want to experiment with local CSV/Parquet data; those are separate from the standard automatic Hugging Face fetch.

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

The default category-training manifest uses the three verified Hugging Face sources above. `PolyAI/banking77` is not used as a default expense-category dataset because it is a banking-intent dataset rather than the target expense-category taxonomy.

## Reproducibility and data safety

Use the same seed and preserve the generated dataset fingerprint and configuration with every run. Never put personal transaction data, secrets, raw datasets, or trained weights in Git.
