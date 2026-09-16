from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import os
import random

import numpy as np


def _optional_int(value: str | None) -> int | None:
    if value is None or value.strip().lower() == "auto":
        return None
    parsed = int(value)
    if parsed < 1:
        raise ValueError("numeric resource settings must be >= 1")
    return parsed


@dataclass(frozen=True)
class TrainingConfig:
    seed: int = 42
    data_dir: Path = Path("data")
    artifacts_dir: Path = Path("artifacts")
    model_dir: Path = Path("artifacts/category-transformer")
    transformer_name: str = "distilbert/distilbert-base-multilingual-cased"
    max_length: int = 96
    test_size: float = 0.15
    validation_size: float = 0.15
    confidence_threshold: float = 0.70
    batch_size: int = 16
    eval_batch_size: int = 32
    epochs: int = 4
    learning_rate: float = 2e-5
    cpu_threads: int | None = None
    torch_threads: int | None = None
    dataloader_workers: int | None = None
    pin_memory: bool = True
    persistent_workers: bool = True
    mixed_precision: str = "auto"
    gradient_accumulation_steps: int = 1
    max_merchants: int = 250_000
    duplicate_max_rows: int = 500_000
    normalize_chunk_size: int = 250_000
    progress: bool = True
    kaggle_input_dir: Path = Path("/kaggle/input")
    datasets: list[dict] = field(default_factory=list)

    @classmethod
    def from_mapping(cls, values: dict) -> "TrainingConfig":
        values = dict(values)
        for key in ("data_dir", "artifacts_dir", "model_dir", "kaggle_input_dir"):
            if key in values:
                values[key] = Path(values[key])
        return cls(**values)

    @classmethod
    def from_env(cls, base: "TrainingConfig" | None = None) -> "TrainingConfig":
        current = base or cls()
        updates = {}
        path_keys = {
            "EXPENSE_ML_DATA_DIR": "data_dir",
            "EXPENSE_ML_MODEL_DIR": "model_dir",
            "EXPENSE_ML_KAGGLE_INPUT": "kaggle_input_dir",
        }
        for env_name, field_name in path_keys.items():
            if os.getenv(env_name):
                updates[field_name] = Path(os.environ[env_name])
        scalar_ints = {
            "EXPENSE_ML_CPU_THREADS": "cpu_threads",
            "EXPENSE_ML_TORCH_THREADS": "torch_threads",
            "EXPENSE_ML_DATALOADER_WORKERS": "dataloader_workers",
            "EXPENSE_ML_BATCH_SIZE": "batch_size",
            "EXPENSE_ML_EVAL_BATCH_SIZE": "eval_batch_size",
            "EXPENSE_ML_GRADIENT_ACCUMULATION": "gradient_accumulation_steps",
            "EXPENSE_ML_NORMALIZE_CHUNK_SIZE": "normalize_chunk_size",
            "EXPENSE_ML_MAX_MERCHANTS": "max_merchants",
            "EXPENSE_ML_DUPLICATE_MAX_ROWS": "duplicate_max_rows",
        }
        for env_name, field_name in scalar_ints.items():
            raw = os.getenv(env_name)
            if raw:
                parsed = _optional_int(raw) if field_name in {"cpu_threads", "torch_threads", "dataloader_workers"} else int(raw)
                updates[field_name] = parsed
        if os.getenv("EXPENSE_ML_MIXED_PRECISION"):
            updates["mixed_precision"] = os.environ["EXPENSE_ML_MIXED_PRECISION"]
        if os.getenv("EXPENSE_ML_NO_PROGRESS") == "1":
            updates["progress"] = False
        if os.getenv("EXPENSE_ML_NO_PIN_MEMORY") == "1":
            updates["pin_memory"] = False
        return cls(**{**current.__dict__, **updates})


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch

        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
    except ImportError:
        pass
