# Kaggle Training Guide

## 1. Create the Kaggle notebook

Open the repository's `ml/notebooks/kaggle_master_training.ipynb` and upload it as a Kaggle Notebook. In the notebook's **Add Input** panel, attach one or more Kaggle datasets.

Kaggle mounts attached datasets below:

```text
/kaggle/input/<dataset-name>/...
```

The notebook prints that directory tree so you can copy the exact paths into `KAGGLE_DATASETS`.

## 2. Attach multiple datasets/files

The master pipeline accepts multiple local CSV/Parquet files through the YAML dataset list. Example:

```python
KAGGLE_DATASETS = [
    {
        "source": "global",
        "path": "/kaggle/input/global-transaction-categorization/data.csv",
        "text_column": "transaction_description",
        "label_column": "category",
    },
    {
        "source": "finee-india",
        "path": "/kaggle/input/finee-dataset/train.csv",
        "text_column": "input",
        "label_column": "output.category",
    },
]
```

The notebook writes these entries to a temporary Kaggle YAML configuration and runs the same master pipeline used outside Kaggle.

## 3. Resource controls

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

`auto` CPU threading uses the available logical CPUs. Hugging Face tokenization and the Transformer DataLoader use configurable worker processes. CUDA uses FP16 automatically when enabled by the detected environment, with BF16 selected when explicitly requested or supported.

## 4. Progress reporting

`tqdm` reports dataset loading, chunked normalization, model evaluation, master pipeline stages, and Transformer tokenization/training. Hugging Face Trainer's own progress bar remains enabled unless `EXPENSE_ML_NO_PROGRESS=1` is set.

## 5. Outputs

Each run is written to `/kaggle/working/expense-ml-runs/<run-id>/`:

```text
manifest.json
models/
reports/
  REPORT.md
  *.json
  figures/*.png
```

The manifest records the detected CPU/GPU resources, seed, platform, trained/skipped models, and artifact locations.

## 6. Multi-GPU note

A normal Kaggle notebook process is typically one training process. The pipeline fully uses the visible GPU for that process and uses CPU workers to feed it. When a Kaggle environment exposes multiple GPUs, launch a distributed job with `torchrun` rather than expecting a single notebook process to automatically coordinate every device.
