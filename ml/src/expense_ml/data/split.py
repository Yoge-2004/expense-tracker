from __future__ import annotations

from dataclasses import dataclass
import hashlib

import pandas as pd
from sklearn.model_selection import train_test_split


@dataclass(frozen=True)
class SplitResult:
    train: pd.DataFrame
    validation: pd.DataFrame
    test: pd.DataFrame
    india_holdout: pd.DataFrame


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def split_dataset(frame: pd.DataFrame, seed: int = 42, test_size: float = .15, validation_size: float = .15) -> SplitResult:
    if not 0 < test_size < 1 or not 0 < validation_size < 1 or test_size + validation_size >= 1:
        raise ValueError("test_size and validation_size must be positive and sum to less than 1")

    data = frame.copy()
    if "source" not in data:
        data["source"] = "unknown"
    else:
        data["source"] = data["source"].fillna("unknown").astype(str)
    data["_text_hash"] = data["text"].map(_hash_text)
    data = data.drop_duplicates("_text_hash").reset_index(drop=True)
    india_mask = data["source"].str.contains(r"india|indian|finee|synthetic", case=False, regex=True, na=False)
    india = data[india_mask].drop(columns="_text_hash")
    general = data[~india_mask]
    if len(india) >= 20:
        india_train, india_holdout = train_test_split(india, test_size=.20, random_state=seed, stratify=india["label"] if india["label"].value_counts().min() >= 2 else None)
        general = pd.concat([general, india_train], ignore_index=True)
    else:
        india_holdout = pd.DataFrame(columns=data.columns.drop("_text_hash"))
        general = data.drop(columns="_text_hash")

    stratify = general["label"] if general["label"].value_counts().min() >= 2 else None
    train, temp = train_test_split(general, test_size=test_size + validation_size, random_state=seed, stratify=stratify)
    relative_test = test_size / (test_size + validation_size)
    stratify_temp = temp["label"] if temp["label"].value_counts().min() >= 2 else None
    test, validation = train_test_split(temp, test_size=1-relative_test, random_state=seed, stratify=stratify_temp)
    return SplitResult(train.reset_index(drop=True), validation.reset_index(drop=True), test.reset_index(drop=True), india_holdout.reset_index(drop=True))
