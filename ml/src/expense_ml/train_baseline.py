from __future__ import annotations

from pathlib import Path
import json

import pandas as pd

from .config import TrainingConfig, seed_everything
from .models.tfidf import TfidfCategoryModel


def train_tfidf(train_frame: pd.DataFrame, config: TrainingConfig) -> TfidfCategoryModel:
    seed_everything(config.seed)
    model = TfidfCategoryModel.fit(train_frame["text"].tolist(), train_frame["label"].tolist(), config.seed)
    model.save(config.artifacts_dir / "category-tfidf")
    return model


def save_run_metadata(output: Path, config: TrainingConfig, rows: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"seed": config.seed, "rows": rows, "transformer": config.transformer_name}, indent=2), encoding="utf-8")
