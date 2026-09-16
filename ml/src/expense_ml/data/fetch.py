from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json

import pandas as pd
from tqdm.auto import tqdm

from .normalize import prepare_dataframe


@dataclass(frozen=True)
class FetchedDataset:
    source: str
    dataset_id: str
    split: str
    rows: int
    cache_path: str
    cached: bool


def _extract_label(row: dict, label_column: str):
    if "." not in label_column:
        return row.get(label_column)
    current = row.get(label_column.split(".")[0])
    for part in label_column.split(".")[1:]:
        current = current.get(part) if isinstance(current, dict) else None
    return current


def fetch_huggingface_dataset(
    dataset_id: str,
    text_column: str,
    label_column: str,
    source: str,
    split: str = "train",
    cache_dir: str | Path | None = None,
    progress: bool = True,
    force: bool = False,
) -> tuple[pd.DataFrame, FetchedDataset]:
    """Fetch one Hugging Face dataset, normalize it, and cache the normalized rows."""
    from datasets import load_dataset

    target_dir = Path(cache_dir or "data/cache") / "normalized"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{source}.parquet"
    metadata_path = target.with_suffix(".json")

    if target.exists() and metadata_path.exists() and not force:
        frame = pd.read_parquet(target)
        return frame, FetchedDataset(source, dataset_id, split, len(frame), str(target), True)

    dataset = load_dataset(dataset_id, split=split, cache_dir=str(cache_dir) if cache_dir else None)
    rows = []
    for row in tqdm(
        dataset,
        total=len(dataset),
        desc=f"Fetching {source}",
        unit="rows",
        disable=not progress,
    ):
        if text_column not in row:
            raise KeyError(f"Dataset '{dataset_id}' does not contain text column '{text_column}'.")
        rows.append(
            {
                "text": row[text_column],
                "label": _extract_label(row, label_column),
                "source": source,
            }
        )

    frame = prepare_dataframe(pd.DataFrame(rows))
    frame.to_parquet(target, index=False)
    metadata_path.write_text(
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
    return frame, FetchedDataset(source, dataset_id, split, len(frame), str(target), False)


def fetch_configured_datasets(
    config: list[dict],
    cache_dir: str | Path,
    progress: bool = True,
    force: bool = False,
) -> tuple[pd.DataFrame, list[dict]]:
    """Fetch every Hugging Face dataset declared in the training manifest."""
    frames: list[pd.DataFrame] = []
    manifests: list[dict] = []

    sources = [item for item in config if item.get("dataset_id")]
    for item in tqdm(sources, desc="Dataset sources", unit="dataset", disable=not progress):
        frame, fetched = fetch_huggingface_dataset(
            dataset_id=item["dataset_id"],
            text_column=item["text_column"],
            label_column=item["label_column"],
            source=item["source"],
            split=item.get("split", "train"),
            cache_dir=cache_dir,
            progress=progress,
            force=force,
        )
        frames.append(frame)
        manifests.append(
            {
                "source": fetched.source,
                "dataset_id": fetched.dataset_id,
                "split": fetched.split,
                "rows": fetched.rows,
                "cache_path": fetched.cache_path,
                "cached": fetched.cached,
            }
        )

    if not frames:
        raise ValueError("No Hugging Face datasets with dataset_id were configured.")
    return prepare_dataframe(pd.concat(frames, ignore_index=True)), manifests
