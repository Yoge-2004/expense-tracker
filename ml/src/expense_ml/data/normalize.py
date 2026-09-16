from __future__ import annotations

import re
import unicodedata

import pandas as pd
from tqdm.auto import tqdm

from .schema import REQUIRED_COLUMNS


def normalize_text(text: str) -> str:
    if text is None or pd.isna(text):
        return ""
    value = unicodedata.normalize("NFKC", str(text)).strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value


def normalize_category(label: str) -> str:
    if label is None or pd.isna(label):
        return ""
    value = unicodedata.normalize("NFKC", str(label)).strip().lower()
    value = re.sub(r"[_-]+", " ", value)
    return re.sub(r"\s+", " ", value)


def prepare_dataframe(
    frame: pd.DataFrame,
    *,
    progress: bool = True,
    chunk_size: int = 250_000,
) -> pd.DataFrame:
    missing = set(REQUIRED_COLUMNS) - set(frame.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    if chunk_size < 1:
        raise ValueError("chunk_size must be >= 1")

    result = frame.loc[:, REQUIRED_COLUMNS].copy()
    iterator = range(0, len(result), chunk_size)
    progress_bar = tqdm(iterator, total=(len(result) + chunk_size - 1) // chunk_size, unit="chunks", desc="Normalizing", disable=not progress)
    chunks: list[pd.DataFrame] = []
    for start in progress_bar:
        chunk = result.iloc[start : start + chunk_size].copy()
        chunk["text"] = chunk["text"].map(normalize_text)
        chunk["label"] = chunk["label"].map(normalize_category)
        chunk["source"] = chunk["source"].fillna("unknown").astype(str)
        chunk = chunk[(chunk["text"] != "") & (chunk["label"] != "")]
        chunks.append(chunk)
        progress_bar.set_postfix(rows=min(start + chunk_size, len(result)))
    if not chunks:
        return result.iloc[0:0].reset_index(drop=True)
    result = pd.concat(chunks, ignore_index=True)
    result = result.drop_duplicates(subset=["text", "label"], keep="first")
    return result.reset_index(drop=True)
