from __future__ import annotations

from pathlib import Path

import pandas as pd


def _column(frame: pd.DataFrame, name: str) -> pd.Series:
    if "." not in name:
        return frame[name]
    current = frame[name.split(".")[0]]
    for part in name.split(".")[1:]:
        current = current.map(lambda value: value.get(part) if isinstance(value, dict) else None)
    return current


def load_local(path: str | Path, text_column: str, label_column: str, source: str) -> pd.DataFrame:
    """Load a local CSV/Parquet fixture. Hugging Face loading lives in fetch.py."""
    path = Path(path)
    if path.suffix.lower() == ".csv":
        frame = pd.read_csv(path)
    elif path.suffix.lower() in {".parquet", ".pq"}:
        frame = pd.read_parquet(path)
    else:
        raise ValueError(f"Unsupported dataset format: {path.suffix}")
    return pd.DataFrame(
        {
            "text": _column(frame, text_column),
            "label": _column(frame, label_column),
            "source": source,
        }
    )
