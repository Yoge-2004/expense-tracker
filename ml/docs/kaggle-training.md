# Kaggle Training Guide

## 1. Create the Kaggle notebook

Open the repository's `ml/notebooks/kaggle_master_training.ipynb` and upload it as a Kaggle Notebook. Enable a GPU runtime and use **Run All**.

The standard training datasets are fetched automatically from Hugging Face; manual Kaggle dataset attachments are not required for the default run.

## 2. Automatic dataset fetch

The repository manifest contains the verified standard sources and their schemas:

```text
mitulshah/transaction-categorization
Ranjit0034/finee-dataset
Sumeetgpt/indian-transaction-categorization-synthetic
```

The notebook calls `expense_ml.data.fetch.fetch_configured_datasets()`. Each source is downloaded with the Hugging Face `datasets` library, normalized into the common `text`, `label`, `source` schema, and cached under:

```text
/kaggle/working/expense-ml-data/
├── normalized/
├── transactions.parquet
└── fetch_manifest.json
```

`tqdm` shows both per-source row progress and overall dataset-source progress. A later notebook rerun reuses the normalized Parquet cache. Set `EXPENSE_ML_FORCE_FETCH=1` to refresh it.

## 3. Optional additional Kaggle data

You can still use Kaggle's **Add Input** panel when experimenting with another CSV/Parquet dataset. Attached files appear below:

```text
/kaggle/input/<dataset-name>/...
```

Create a separate runtime YAML that maps those files to `source`, `text_column`, and `label_column`, then invoke the master pipeline with that config. The standard automatic Hugging Face fetch remains independent of attached inputs.

## 4. Resource controls

Defaults are designed for Kaggle GPU sessions, but every value can be overridden with environment variables:

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

`auto` CPU threading uses the available logical CPUs. Hugging Face tokenization and the Transformer DataLoader use configurable worker processes. CUDA uses automatic mixed precision when supported/configured.

## 5. Progress reporting

`tqdm` reports dataset fetches, pipeline stages, evaluation batches, and tokenization. Hugging Face Trainer keeps its own epoch/step progress display.

## 6. Outputs

Each run is written to `/kaggle/working/expense-ml-runs/<run-id>/`:

```text
manifest.json
models/
reports/
  REPORT.md
  *.json
  figures/*.png
```

The fetch directory additionally contains `fetch_manifest.json`, including source IDs, split names, row counts, normalized cache paths, and whether a source came from cache.

## 7. Multi-GPU note

A normal Kaggle notebook process is typically one training process. The pipeline fully uses the visible GPU for that process and uses CPU workers to feed it. When a Kaggle environment exposes multiple GPUs, launch distributed training with `torchrun` rather than expecting a single notebook process to coordinate every device.
