from __future__ import annotations

import re
import unicodedata

import pandas as pd
from tqdm.auto import tqdm

from .schema import OPTIONAL_COLUMNS, REQUIRED_COLUMNS
from .taxonomy import canonicalize_category


def normalize_text(text: object) -> str:
    if text is None or pd.isna(text):
        return ""
    value = unicodedata.normalize("NFKC", str(text)).strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value


def normalize_category(label: object) -> str:
    if label is None or pd.isna(label):
        return ""
    value = unicodedata.normalize("NFKC", str(label)).strip().lower()
    # Preserve underscore-delimited canonical category IDs such as
    # ``food_dining``. Taxonomy source-label matching is responsible for
    # normalizing separators when it evaluates raw source labels.
    value = value.replace("-", " ")
    return re.sub(r"\s+", " ", value)


def normalize_country(value: object) -> str:
    if value is None or pd.isna(value):
        return "unknown"
    normalized = str(value).strip().casefold()
    aliases = {
        "usa": "USA",
        "us": "USA",
        "united states": "USA",
        "uk": "UK",
        "united kingdom": "UK",
        "canada": "Canada",
        "australia": "Australia",
        "india": "India",
    }
    return aliases.get(normalized, str(value).strip()) or "unknown"


def normalize_optional_text(value: object) -> str:
    if value is None or pd.isna(value):
        return "unknown"
    normalized = str(value).strip()
    return normalized or "unknown"


def prepare_dataframe(
    frame: pd.DataFrame,
    *,
    progress: bool = True,
    chunk_size: int = 250_000,
    canonicalize: bool = False,
    strict_taxonomy: bool = True,
) -> pd.DataFrame:
    missing = set(REQUIRED_COLUMNS) - set(frame.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    if chunk_size < 1:
        raise ValueError("chunk_size must be >= 1")

    columns = list(REQUIRED_COLUMNS) + [c for c in OPTIONAL_COLUMNS if c in frame.columns]
    result = frame.loc[:, columns].copy()
    iterator = range(0, len(result), chunk_size)
    total_chunks = (len(result) + chunk_size - 1) // chunk_size
    progress_bar = tqdm(
        iterator,
        total=total_chunks,
        unit="chunks",
        desc="Normalizing",
        disable=not progress,
    )
    chunks: list[pd.DataFrame] = []
    unknown_labels: set[tuple[str, str]] = set()

    for start in progress_bar:
        chunk = result.iloc[start : start + chunk_size].copy()
        chunk["text"] = chunk["text"].map(normalize_text)
        chunk["label"] = chunk["label"].map(normalize_category)
        chunk["source"] = chunk["source"].map(normalize_optional_text)

        if "country" in chunk:
            chunk["country"] = chunk["country"].map(normalize_country)
        if "currency" in chunk:
            chunk["currency"] = chunk["currency"].map(normalize_optional_text).str.upper()
        if "language" in chunk:
            chunk["language"] = chunk["language"].map(normalize_optional_text)
        if "source_label" in chunk:
            chunk["source_label"] = chunk["source_label"].map(normalize_category)
        if "record_id" in chunk:
            chunk["record_id"] = chunk["record_id"].map(normalize_optional_text)

        # Rows with no usable training text/label are not taxonomy violations.
        # Remove them before canonicalization so a missing FinEE category does
        # not become the misleading "source:" unmapped-label error.
        chunk = chunk[(chunk["text"] != "") & (chunk["label"] != "")]

        if canonicalize:
            mapped = []
            for source, label in zip(chunk["source"], chunk["label"], strict=True):
                try:
                    mapped.append(canonicalize_category(label, source))
                except ValueError:
                    unknown_labels.add((source, label))
                    mapped.append("")
            chunk["label"] = mapped

        chunk = chunk[(chunk["text"] != "") & (chunk["label"] != "")]
        chunks.append(chunk)
        progress_bar.set_postfix(rows=min(start + chunk_size, len(result)))

    if unknown_labels and strict_taxonomy:
        examples = ", ".join(f"{source}:{label}" for source, label in sorted(unknown_labels)[:25])
        raise ValueError(
            "Training data contains source labels without an explicit canonical mapping: "
            f"{examples}"
        )
    if not chunks:
        return result.iloc[0:0].reset_index(drop=True)

    result = pd.concat(chunks, ignore_index=True)
    dedupe_columns = ["text", "label", "source"]
    for column in ("country", "currency", "language"):
        if column in result.columns:
            dedupe_columns.append(column)
    result = result.drop_duplicates(subset=dedupe_columns, keep="first")
    return result.reset_index(drop=True)
