from __future__ import annotations

from pathlib import Path
import hashlib
import json

import pandas as pd

from .fetch import fetch_huggingface_dataset
from .loaders import load_local
from .normalize import prepare_dataframe


def load_configured_datasets(
    config: list[dict],
    base_dir: Path,
    *,
    progress: bool = True,
    normalize_chunk_size: int = 250_000,
) -> pd.DataFrame:
    """Load configured local data and Hugging Face sources through one contract."""
    frames: list[pd.DataFrame] = []
    for item in config:
        source = item["source"]
        if item.get("path"):
            frame = load_local(
                base_dir / item["path"],
                item["text_column"],
                item["label_column"],
                source,
            )
            frame = prepare_dataframe(
                frame,
                progress=progress,
                chunk_size=normalize_chunk_size,
                canonicalize=True,
                strict_taxonomy=True,
            )
        elif item.get("dataset_id"):
            frame, _ = fetch_huggingface_dataset(
                dataset_id=item["dataset_id"],
                text_column=item.get("text_column", ""),
                label_column=item.get("label_column", ""),
                source=source,
                split=item.get("split", "train"),
                cache_dir=base_dir,
                progress=progress,
                dataset_format=item.get("format"),
                country_column=item.get("country_column"),
                currency_column=item.get("currency_column"),
                language_column=item.get("language_column"),
                default_country=item.get("default_country", "unknown"),
                default_currency=item.get("default_currency", "unknown"),
                default_language=item.get("default_language", "unknown"),
                normalize_chunk_size=item.get("normalize_chunk_size", normalize_chunk_size),
            )
        else:
            raise ValueError(f"Dataset '{source}' needs either path or dataset_id")
        frames.append(frame)

    if not frames:
        raise ValueError("No datasets configured")
    return prepare_dataframe(
        pd.concat(frames, ignore_index=True),
        progress=progress,
        chunk_size=normalize_chunk_size,
    )


def fingerprint(frame: pd.DataFrame) -> str:
    columns = [c for c in ("text", "label", "source", "source_label", "country", "currency", "language") if c in frame]
    payload = frame.loc[:, columns].sort_values(columns).to_json(orient="records", force_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def save_prepared(frame: pd.DataFrame, output: Path) -> dict:
    output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(output, index=False)
    stats = {
        "rows": len(frame),
        "classes": int(frame["label"].nunique()),
        "fingerprint": fingerprint(frame),
        "class_counts": frame["label"].value_counts().to_dict(),
        "country_counts": frame["country"].value_counts().to_dict() if "country" in frame else {},
    }
    output.with_suffix(".json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats
