from __future__ import annotations

from pathlib import Path

import pandas as pd


def load_local(path: str | Path, text_column: str, label_column: str, source: str) -> pd.DataFrame:
    path = Path(path)
    if path.suffix.lower() == ".csv":
        frame = pd.read_csv(path)
    elif path.suffix.lower() in {".parquet", ".pq"}:
        frame = pd.read_parquet(path)
    else:
        raise ValueError(f"Unsupported dataset format: {path.suffix}")
    return pd.DataFrame({"text": frame[text_column], "label": frame[label_column], "source": source})


def load_huggingface(dataset_id: str, text_column: str, label_column: str, source: str, split: str = "train") -> pd.DataFrame:
    from datasets import load_dataset

    dataset = load_dataset(dataset_id, split=split)
    frame = dataset.to_pandas()
    return pd.DataFrame({"text": frame[text_column], "label": frame[label_column], "source": source})
