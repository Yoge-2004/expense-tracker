"""
Kaggle entrypoint for Expense Tracker ML.

Run from the ml/ directory:
    python kaggle_train.py

Environment overrides:
    EXPENSE_ML_OUTPUT=/kaggle/working/expense-ml-runs
    EXPENSE_ML_CONFIG=ml/config/datasets.yaml
    EXPENSE_ML_PREPARED=ml/data/prepared/transactions.parquet
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
    install_local_package()
    from expense_ml.master_pipeline import main as pipeline_main

    output = Path(os.getenv("EXPENSE_ML_OUTPUT", "/kaggle/working/expense-ml-runs"))
    config = Path(os.getenv("EXPENSE_ML_CONFIG", str(ROOT / "config" / "datasets.yaml")))
    prepared = Path(os.getenv("EXPENSE_ML_PREPARED", str(ROOT / "data" / "prepared" / "transactions.parquet")))

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
