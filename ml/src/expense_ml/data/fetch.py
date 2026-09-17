from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import os

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


def _extract_finee_chatml(row: dict) -> tuple[str, str]:
    messages = row.get("messages")
    if not isinstance(messages, list):
        raise ValueError("FinEE ChatML row must contain a list-valued 'messages' field.")

    user_content = None
    assistant_content = None
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        if role == "user" and user_content is None:
            user_content = message.get("content")
        elif role == "assistant" and assistant_content is None:
            assistant_content = message.get("content")

    if not isinstance(user_content, str) or not user_content.strip():
        raise ValueError("FinEE ChatML row has no non-empty user message content.")
    if not isinstance(assistant_content, str) or not assistant_content.strip():
        raise ValueError("FinEE ChatML row has no non-empty assistant message content.")

    payload_text = assistant_content.strip()
    if payload_text.startswith("```"):
        lines = payload_text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        payload_text = "\n".join(lines).strip()
        if payload_text.lower().startswith("json"):
            payload_text = payload_text[4:].lstrip()

    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError as exc:
        raise ValueError("FinEE assistant content is not valid JSON.") from exc

    if not isinstance(payload, dict):
        raise ValueError("FinEE assistant JSON must be an object.")
    category = payload.get("category")
    if category is None or not str(category).strip():
        raise ValueError("FinEE assistant JSON does not contain a non-empty 'category'.")

    return user_content, str(category)


def _extract_training_fields(
    row: dict,
    *,
    dataset_id: str,
    text_column: str,
    label_column: str,
    dataset_format: str | None,
) -> tuple[object, object]:
    if dataset_format == "finee-chatml":
        return _extract_finee_chatml(row)

    if text_column not in row:
        raise KeyError(f"Dataset '{dataset_id}' does not contain text column '{text_column}'.")
    return row[text_column], _extract_label(row, label_column)


def fetch_huggingface_dataset(
    dataset_id: str,
    text_column: str,
    label_column: str,
    source: str,
    split: str = "train",
    cache_dir: str | Path | None = None,
    progress: bool = True,
    force: bool = False,
    dataset_format: str | None = None,
) -> tuple[pd.DataFrame, FetchedDataset]:
    """Fetch one Hugging Face dataset, normalize it, and cache the normalized rows."""
    from datasets import load_dataset
    from datasets.exceptions import DatasetNotFoundError

    target_dir = Path(cache_dir or "data/cache") / "normalized"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{source}.parquet"
    metadata_path = target.with_suffix(".json")

    if target.exists() and metadata_path.exists() and not force:
        frame = pd.read_parquet(target)
        return frame, FetchedDataset(source, dataset_id, split, len(frame), str(target), True)

    hf_token = os.getenv("HF_TOKEN") or None
    try:
        dataset = load_dataset(
            dataset_id,
            split=split,
            cache_dir=str(cache_dir) if cache_dir else None,
            token=hf_token,
        )
    except DatasetNotFoundError as exc:
        message = str(exc).lower()
        if "gated dataset" in message:
            if not hf_token:
                raise RuntimeError(
                    f"Hugging Face dataset '{dataset_id}' is gated and requires authentication. "
                    "In Kaggle, attach a Secret named 'HF_TOKEN' containing a Hugging Face "
                    "access token with permission to this dataset, then rerun training. "
                    "The Hugging Face account must also have accepted/requested access to the dataset."
                ) from exc
            raise RuntimeError(
                f"Hugging Face authentication was provided, but access to gated dataset "
                f"'{dataset_id}' was not granted. Open the dataset in Hugging Face, "
                "accept/request its access terms for your account, verify the token belongs "
                "to that account, and rerun training."
            ) from exc
        raise

    rows = []
    for row in tqdm(
        dataset,
        total=len(dataset),
        desc=f"Fetching {source}",
        unit="rows",
        disable=not progress,
    ):
        text, label = _extract_training_fields(
            row,
            dataset_id=dataset_id,
            text_column=text_column,
            label_column=label_column,
            dataset_format=dataset_format,
        )
        rows.append({"text": text, "label": label, "source": source})

    frame = prepare_dataframe(pd.DataFrame(rows))
    frame.to_parquet(target, index=False)
    metadata_path.write_text(
        json.dumps(
            {
                "source": source,
                "dataset_id": dataset_id,
                "split": split,
                "rows": len(frame),
                "dataset_format": dataset_format,
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
            text_column=item.get("text_column", ""),
            label_column=item.get("label_column", ""),
            source=item["source"],
            split=item.get("split", "train"),
            cache_dir=cache_dir,
            progress=progress,
            force=force,
            dataset_format=item.get("format"),
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
