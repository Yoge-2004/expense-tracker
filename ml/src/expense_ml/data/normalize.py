from __future__ import annotations

import re
import unicodedata

import pandas as pd

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


def prepare_dataframe(frame: pd.DataFrame) -> pd.DataFrame:
    missing = set(REQUIRED_COLUMNS) - set(frame.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    result = frame.loc[:, REQUIRED_COLUMNS].copy()
    result["text"] = result["text"].map(normalize_text)
    result["label"] = result["label"].map(normalize_category)
    result["source"] = result["source"].fillna("unknown").astype(str)
    result = result[(result["text"] != "") & (result["label"] != "")]
    result = result.drop_duplicates(subset=["text", "label"], keep="first")
    return result.reset_index(drop=True)
