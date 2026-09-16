from __future__ import annotations

from pathlib import Path
import hashlib
import json

import pandas as pd

from .loaders import load_huggingface, load_local
from .normalize import prepare_dataframe


def load_configured_datasets(config: list[dict], base_dir: Path) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for item in config:
        source = item["source"]
        text_column = item["text_column"]
        label_column = item["label_column"]
        if item.get("path"):
            frame = load_local(base_dir / item["path"], text_column, label_column, source)
        elif item.get("dataset_id"):
            frame = load_huggingface(item["dataset_id"], text_column, label_column, source, item.get("split", "train"))
        else:
            raise ValueError(f"Dataset '{source}' needs either path or dataset_id")
        frames.append(frame)
    if not frames:
        raise ValueError("No datasets configured")
    return prepare_dataframe(pd.concat(frames, ignore_index=True))


def fingerprint(frame: pd.DataFrame) -> str:
    payload = frame.sort_values(["text", "label", "source"]).to_json(orient="records", force_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def save_prepared(frame: pd.DataFrame, output: Path) -> dict:
    output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(output, index=False)
    stats = {"rows": len(frame), "classes": int(frame["label"].nunique()), "fingerprint": fingerprint(frame), "class_counts": frame["label"].value_counts().to_dict()}
    output.with_suffix(".json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats
