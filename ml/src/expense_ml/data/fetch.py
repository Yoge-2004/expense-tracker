from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re

import pandas as pd
from tqdm.auto import tqdm

from .normalize import prepare_dataframe
from .taxonomy import SOURCE_LABEL_MAP


NORMALIZATION_VERSION = "2.1"


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


def _extract_finee_chatml(row: dict) -> tuple[str, str | None]:
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

    transaction_text = re.sub(
        r"^\s*extract financial entities from\s*:\s*",
        "",
        user_content.strip(),
        flags=re.IGNORECASE,
    )

    payload_text = assistant_content.strip()
    if payload_text.startswith("```"):
        lines = payload_text.splitlines()
        if lines and lines[0].strip().startswith("```"):
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
        return transaction_text, None

    return transaction_text, str(category)


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


def _batch_to_rows(batch: object) -> list[dict]:
    """Normalize Hugging Face columnar batches and lightweight row-mapping test doubles."""
    if isinstance(batch, Mapping):
        keys = list(batch)
        if not keys:
            return []
        columns = {key: batch[key] for key in keys}
        try:
            lengths = {len(values) for values in columns.values()}
        except TypeError as exc:
            raise TypeError("Dataset batch columns must be sized sequences.") from exc
        if len(lengths) != 1:
            raise ValueError("Dataset batch columns have inconsistent lengths.")
        row_count = next(iter(lengths))
        return [{key: columns[key][index] for key in keys} for index in range(row_count)]

    if isinstance(batch, Sequence) and not isinstance(batch, (str, bytes, bytearray)):
        rows: list[dict] = []
        for index, value in enumerate(batch):
            if not isinstance(value, Mapping):
                raise TypeError(f"Dataset row {index} must be a mapping, got {type(value).__name__}.")
            rows.append(dict(value))
        return rows

    raise TypeError(
        "Dataset slice must be either a mapping of column sequences or a sequence of row mappings."
    )


def _cache_signature(
    *,
    dataset_id: str,
    split: str,
    source: str,
    text_column: str,
    label_column: str,
    dataset_format: str | None,
    country_column: str | None,
    currency_column: str | None,
    language_column: str | None,
    default_country: str,
    default_currency: str,
    default_language: str,
) -> dict:
    mapping = SOURCE_LABEL_MAP.get(source)
    if mapping is None:
        raise ValueError(f"No canonical taxonomy mapping is registered for source '{source}'.")
    payload = {
        "normalization_version": NORMALIZATION_VERSION,
        "dataset_id": dataset_id,
        "split": split,
        "source": source,
        "text_column": text_column,
        "label_column": label_column,
        "dataset_format": dataset_format,
        "country_column": country_column,
        "currency_column": currency_column,
        "language_column": language_column,
        "default_country": default_country,
        "default_currency": default_currency,
        "default_language": default_language,
        "taxonomy_mapping": dict(sorted(mapping.items())),
    }
    fingerprint = hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    return {"fingerprint": fingerprint, **payload}


def _cache_is_current(metadata_path: Path, expected_signature: dict) -> bool:
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return metadata.get("cache_signature") == expected_signature


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
    country_column: str | None = None,
    currency_column: str | None = None,
    language_column: str | None = None,
    default_country: str = "unknown",
    default_currency: str = "unknown",
    default_language: str = "unknown",
    normalize_chunk_size: int = 250_000,
) -> tuple[pd.DataFrame, FetchedDataset]:
    """Fetch, validate, normalize, and cache one dataset with configuration provenance."""
    from datasets import load_dataset
    from datasets.exceptions import DatasetNotFoundError

    target_dir = Path(cache_dir or "data/cache") / "normalized"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{source}.parquet"
    metadata_path = target.with_suffix(".json")
    signature = _cache_signature(
        dataset_id=dataset_id,
        split=split,
        source=source,
        text_column=text_column,
        label_column=label_column,
        dataset_format=dataset_format,
        country_column=country_column,
        currency_column=currency_column,
        language_column=language_column,
        default_country=default_country,
        default_currency=default_currency,
        default_language=default_language,
    )

    if target.exists() and metadata_path.exists() and not force and _cache_is_current(metadata_path, signature):
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
                    "access token with permission to this dataset."
                ) from exc
            raise RuntimeError(
                f"Hugging Face authentication was provided, but access to gated dataset "
                f"'{dataset_id}' was not granted for that token."
            ) from exc
        raise

    shard_dir = target_dir / f"{source}.parts"
    if shard_dir.exists():
        for part in shard_dir.glob("*.parquet"):
            part.unlink()
    shard_dir.mkdir(parents=True, exist_ok=True)

    total = len(dataset)
    outer = tqdm(
        range(0, total, normalize_chunk_size),
        total=(total + normalize_chunk_size - 1) // normalize_chunk_size,
        desc=f"Fetching {source}",
        unit="chunks",
        disable=not progress,
    )
    shard_paths: list[Path] = []
    for shard_number, start in enumerate(outer):
        stop = min(start + normalize_chunk_size, total)
        rows = _batch_to_rows(dataset[start:stop])
        if len(rows) != stop - start:
            raise ValueError(
                f"Dataset '{dataset_id}' returned {len(rows)} rows for requested slice "
                f"[{start}:{stop}], expected {stop - start}."
            )

        batch_rows = []
        for offset, row in enumerate(rows):
            text, label = _extract_training_fields(
                row,
                dataset_id=dataset_id,
                text_column=text_column,
                label_column=label_column,
                dataset_format=dataset_format,
            )
            country = row.get(country_column) if country_column else default_country
            currency = row.get(currency_column) if currency_column else default_currency
            language = row.get(language_column) if language_column else default_language
            raw_id = f"{source}:{start + offset}:{text}:{label}"
            record_id = hashlib.sha1(raw_id.encode("utf-8")).hexdigest()
            batch_rows.append(
                {
                    "text": text,
                    "label": label,
                    "source": source,
                    "source_label": label,
                    "country": country,
                    "currency": currency,
                    "language": language,
                    "record_id": record_id,
                }
            )
        batch_frame = prepare_dataframe(
            pd.DataFrame(batch_rows),
            progress=progress,
            chunk_size=normalize_chunk_size,
            canonicalize=True,
            strict_taxonomy=True,
        )
        part_path = shard_dir / f"part-{shard_number:05d}.parquet"
        batch_frame.to_parquet(part_path, index=False)
        shard_paths.append(part_path)
        outer.set_postfix(rows=stop)

    if shard_paths:
        frame = pd.concat((pd.read_parquet(path) for path in shard_paths), ignore_index=True)
    else:
        frame = pd.DataFrame(
            columns=[
                "text", "label", "source", "source_label", "country", "currency", "language", "record_id"
            ]
        )
    frame = prepare_dataframe(frame, progress=progress, chunk_size=normalize_chunk_size)
    frame.to_parquet(target, index=False)
    metadata_path.write_text(
        json.dumps(
            {
                "cache_signature": signature,
                "source": source,
                "dataset_id": dataset_id,
                "split": split,
                "rows": len(frame),
                "dataset_format": dataset_format,
                "normalization_version": NORMALIZATION_VERSION,
                "countries": sorted(frame["country"].dropna().unique().tolist()) if "country" in frame else [],
                "categories": sorted(frame["label"].dropna().unique().tolist()),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    for part_path in shard_paths:
        part_path.unlink(missing_ok=True)
    try:
        shard_dir.rmdir()
    except OSError:
        pass
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
            country_column=item.get("country_column"),
            currency_column=item.get("currency_column"),
            language_column=item.get("language_column"),
            default_country=item.get("default_country", "unknown"),
            default_currency=item.get("default_currency", "unknown"),
            default_language=item.get("default_language", "unknown"),
            normalize_chunk_size=item.get("normalize_chunk_size", 250_000),
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
    combined = prepare_dataframe(pd.concat(frames, ignore_index=True), progress=progress, chunk_size=250_000)
    return combined, manifests
