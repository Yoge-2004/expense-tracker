"""Kaggle entrypoint for the Expense Tracker ML master pipeline.

Typical notebook usage:
    !python /kaggle/working/expense-tracker/ml/kaggle_train.py

The standard three datasets are fetched automatically from Hugging Face using
`ml/config/datasets.yaml`, normalized, cached under /kaggle/working, and then
passed to the master pipeline.

Useful overrides:
    EXPENSE_ML_OUTPUT=/kaggle/working/expense-ml-runs
    EXPENSE_ML_DATA_CACHE=/kaggle/working/expense-ml-data
    EXPENSE_ML_CONFIG=/kaggle/working/kaggle_datasets.yaml
    EXPENSE_ML_FORCE_FETCH=1
    EXPENSE_ML_CPU_THREADS=auto
    EXPENSE_ML_DATALOADER_WORKERS=8
    EXPENSE_ML_BATCH_SIZE=32
    EXPENSE_ML_EVAL_BATCH_SIZE=64
    EXPENSE_ML_MIXED_PRECISION=auto
    EXPENSE_ML_NO_TRANSFORMER=1

Hugging Face authentication:
    Set HF_TOKEN in the environment, or attach a Kaggle Secret named
    `HF_TOKEN`. The secret is copied into the child training process without
    ever being printed.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))


def install_local_package() -> None:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-e", str(ROOT)], check=True)


def configure_huggingface_auth() -> bool:
    """Load HF_TOKEN from the environment or Kaggle Secrets."""
    token = os.getenv("HF_TOKEN")
    if token:
        os.environ["HF_TOKEN"] = token.strip()
        return bool(os.environ["HF_TOKEN"])

    try:
        from kaggle_secrets import UserSecretsClient

        token = UserSecretsClient().get_secret("HF_TOKEN")
    except Exception:
        return False

    if token:
        os.environ["HF_TOKEN"] = token.strip()
    return bool(os.environ.get("HF_TOKEN"))


def _load_yaml(path: Path) -> dict:
    import yaml

    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def fetch_standard_datasets(config_path: Path, cache_dir: Path, progress: bool = True) -> Path:
    from expense_ml.data.fetch import fetch_configured_datasets
    from expense_ml.data.prepare import save_prepared

    raw = _load_yaml(config_path)
    datasets = raw.get("datasets", [])
    if not datasets:
        raise ValueError(f"No datasets configured in {config_path}.")

    frame, manifest = fetch_configured_datasets(
        datasets,
        cache_dir=cache_dir,
        progress=progress,
        force=os.getenv("EXPENSE_ML_FORCE_FETCH") == "1",
    )
    prepared = cache_dir / "transactions.parquet"
    save_prepared(frame, prepared)
    (cache_dir / "fetch_manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    print(json.dumps({"prepared": str(prepared), "datasets": manifest}, indent=2))
    return prepared


def main() -> None:
    install_local_package()
    from expense_ml.resources import configure_resources

    resource_info = configure_resources()
    print("ML resources:", json.dumps(resource_info, indent=2))

    hf_authenticated = configure_huggingface_auth()
    print(f"Hugging Face authentication: {'available' if hf_authenticated else 'not available'}")

    output = Path(os.getenv("EXPENSE_ML_OUTPUT", "/kaggle/working/expense-ml-runs"))
    cache_dir = Path(os.getenv("EXPENSE_ML_DATA_CACHE", "/kaggle/working/expense-ml-data"))
    config = Path(os.getenv("EXPENSE_ML_CONFIG", str(ROOT / "config" / "datasets.yaml")))
    prepared = Path(os.getenv("EXPENSE_ML_PREPARED", str(cache_dir / "transactions.parquet")))

    if not prepared.exists() or os.getenv("EXPENSE_ML_FORCE_FETCH") == "1":
        prepared = fetch_standard_datasets(config, cache_dir, progress=True)

    from expense_ml.master_pipeline import main as pipeline_main

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
