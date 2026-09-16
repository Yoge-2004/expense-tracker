from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import os
import random

import numpy as np


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
    epochs: int = 4
    learning_rate: float = 2e-5
    datasets: list[dict] = field(default_factory=list)

    @classmethod
    def from_mapping(cls, values: dict) -> "TrainingConfig":
        values = dict(values)
        for key in ("data_dir", "artifacts_dir", "model_dir"):
            if key in values:
                values[key] = Path(values[key])
        return cls(**values)

    @classmethod
    def from_env(cls, base: "TrainingConfig" | None = None) -> "TrainingConfig":
        current = base or cls()
        updates = {}
        if os.getenv("EXPENSE_ML_DATA_DIR"):
            updates["data_dir"] = Path(os.environ["EXPENSE_ML_DATA_DIR"])
        if os.getenv("EXPENSE_ML_MODEL_DIR"):
            updates["model_dir"] = Path(os.environ["EXPENSE_ML_MODEL_DIR"])
        if os.getenv("EXPENSE_ML_TRANSFORMER"):
            updates["transformer_name"] = os.environ["EXPENSE_ML_TRANSFORMER"]
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
