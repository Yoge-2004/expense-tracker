"""Kaggle entrypoint for the Expense Tracker ML master pipeline.

Typical notebook usage:
    !python /kaggle/working/expense-tracker/ml/kaggle_train.py

The notebook can attach multiple Kaggle datasets under /kaggle/input. Set
EXPENSE_ML_CONFIG to a config file whose `path` values point into that tree.

Useful overrides:
    EXPENSE_ML_OUTPUT=/kaggle/working/expense-ml-runs
    EXPENSE_ML_KAGGLE_INPUT=/kaggle/input
    EXPENSE_ML_CPU_THREADS=auto
    EXPENSE_ML_DATALOADER_WORKERS=8
    EXPENSE_ML_BATCH_SIZE=32
    EXPENSE_ML_EVAL_BATCH_SIZE=64
    EXPENSE_ML_MIXED_PRECISION=auto
    EXPENSE_ML_NO_TRANSFORMER=1
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))


def install_local_package() -> None:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-e", str(ROOT)], check=True)


def main() -> None:
    from expense_ml.resources import configure_resources

    resource_info = configure_resources()
    print("ML resources:", resource_info)
    install_local_package()
    from expense_ml.master_pipeline import main as pipeline_main

    output = Path(os.getenv("EXPENSE_ML_OUTPUT", "/kaggle/working/expense-ml-runs"))
    config = Path(os.getenv("EXPENSE_ML_CONFIG", str(ROOT / "config" / "datasets.yaml")))
    prepared = Path(os.getenv("EXPENSE_ML_PREPARED", str(output / "prepared" / "transactions.parquet")))

    argv = ["--config", str(config), "--prepared", str(prepared), "--output", str(output)]
    if os.getenv("EXPENSE_ML_NO_TRANSFORMER") == "1":
        argv.append("--no-transformer")

    old_argv = sys.argv
    try:
        sys.argv = [old_argv[0], *argv]
        pipeline_main()
    finally:
        sys.argv = old_argv


if __name__ == "__main__":
    main()
