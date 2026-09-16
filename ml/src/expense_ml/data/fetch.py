from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json

import pandas as pd
from tqdm.auto import tqdm

from .loaders import _column
from .normalize import prepare_dataframe


@dataclass(frozen=True)
class FetchedDataset:
    source: str
    dataset_id: str
    split: str
    rows: int
    cache_path: str


def fetch_huggingface_dataset(
    dataset_id: str,
    text_column: str,
    label_column: str,
    source: str,
    split: str = "train",
    cache_dir: str | Path | None = None,
    progress: bool = True,
) -> tuple[pd.DataFrame, FetchedDataset]:
    """Download one Hugging Face dataset, normalize it, and cache the result."""
    from datasets import load_dataset

    dataset = load_dataset(dataset_id, split=split, cache_dir=str(cache_dir) if cache_dir else None)
    rows = []
    iterator = dataset
    for row in tqdm(iterator, total=len(dataset), desc=f"Fetching {source}", unit="rows", disable=not progress):
        text = row
        if text_column in row:
            text = row
        else:
            raise KeyError(f"Dataset '{dataset_id}' does not contain text column '{text_column}'.")
        if "." in label_column:
            current = row.get(label_column.split(".")[0])
            for part in label_column.split(".")[1:]:
                current = current.get(part) if isinstance(current, dict) else None
            label = current
        else:
            label = row.get(label_column)
        rows.append({"text": text[text_column], "label": label, "source": source})

    frame = prepare_dataframe(pd.DataFrame(rows))
    target_dir = Path(cache_dir or "data/cache") / "normalized"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{source}.parquet"
    frame.to_parquet(target, index=False)
    (target.with_suffix(".json")).write_text(
        json.dumps(
            {
                "source": source,
                "dataset_id": dataset_id,
                "split": split,
                "rows": len(frame),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return frame, FetchedDataset(source, dataset_id, split, len(frame), str(target))


def fetch_configured_datasets(
    config: list[dict],
    cache_dir: str | Path,
    progress: bool = True,
) -> tuple[pd.DataFrame, list[dict]]:
    """Fetch every Hugging Face dataset declared in the training manifest."""
    frames: list[pd.DataFrame] = []
    manifests: list[dict] = []

    for item in tqdm(config, desc="Dataset sources", unit="dataset", disable=not progress):
        dataset_id = item.get("dataset_id")
        if not dataset_id:
            continue
        frame, fetched = fetch_huggingface_dataset(
            dataset_id=dataset_id,
            text_column=item["text_column"],
            label_column=item["label_column"],
            source=item["source"],
            split=item.get("split", "train"),
            cache_dir=cache_dir,
            progress=progress,
        )
        frames.append(frame)
        manifests.append({
            "source": fetched.source,
            "dataset_id": fetched.dataset_id,
            "split": fetched.split,
            "rows": fetched.rows,
            "cache_path": fetched.cache_path,
        })

    if not frames:
        raise ValueError("No Hugging Face datasets with dataset_id were configured.")
    return prepare_dataframe(pd.concat(frames, ignore_index=True)), manifests
