from __future__ import annotations

from dataclasses import dataclass
import hashlib

import pandas as pd
from sklearn.model_selection import GroupShuffleSplit


@dataclass(frozen=True)
class SplitResult:
    train: pd.DataFrame
    validation: pd.DataFrame
    test: pd.DataFrame
    india_holdout: pd.DataFrame


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _empty_like(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.iloc[0:0].copy().reset_index(drop=True)


def _candidate_group_split(data: pd.DataFrame, holdout_fraction: float, seed: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    if len(data) < 2:
        return _empty_like(data), data.copy().reset_index(drop=True)

    target = data["label"].value_counts(normalize=True)
    splitter = GroupShuffleSplit(n_splits=5, test_size=holdout_fraction, random_state=seed)
    candidates: list[tuple[float, object, object]] = []
    for train_idx, holdout_idx in splitter.split(data, data["label"], groups=data["_group"]):
        candidate = data.iloc[holdout_idx]
        proportions = candidate["label"].value_counts(normalize=True).reindex(target.index, fill_value=0.0)
        distribution_error = float((proportions - target).abs().sum())
        size_error = abs(len(candidate) / len(data) - holdout_fraction)
        candidates.append((distribution_error + size_error, train_idx, holdout_idx))

    _, train_idx, holdout_idx = min(candidates, key=lambda item: item[0])
    return data.iloc[train_idx].copy(), data.iloc[holdout_idx].copy()


def _validate_group_labels(data: pd.DataFrame) -> None:
    conflicts = data.groupby("_group", sort=False)["label"].nunique()
    conflicted = conflicts[conflicts > 1]
    if len(conflicted):
        examples = data[data["_group"].isin(conflicted.index)].groupby("_group")["label"].unique().head(10)
        formatted = "; ".join(f"{group}: {labels.tolist()}" for group, labels in examples.items())
        raise ValueError(
            "Conflicting labels were found for identical normalized transaction text. "
            f"Resolve source-label mappings before training. Examples: {formatted}"
        )


def _drop_private_columns(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.drop(columns=["_group"], errors="ignore").reset_index(drop=True)


def split_dataset(
    frame: pd.DataFrame,
    seed: int = 42,
    test_size: float = 0.15,
    validation_size: float = 0.15,
) -> SplitResult:
    if not 0 < test_size < 1 or not 0 < validation_size < 1 or test_size + validation_size >= 1:
        raise ValueError("test_size and validation_size must be positive and sum to less than 1")
    if "text" not in frame or "label" not in frame:
        raise ValueError("split_dataset requires text and label columns")

    data = frame.copy()
    if "source" not in data:
        data["source"] = "unknown"
    data["source"] = data["source"].fillna("unknown").astype(str)
    if "country" not in data:
        data["country"] = "unknown"
    data["country"] = data["country"].fillna("unknown").astype(str)
    data["_group"] = data["text"].fillna("").astype(str).map(_hash_text)
    _validate_group_labels(data)

    india_mask = data["country"].str.casefold().eq("india")
    india = data[india_mask]
    general = data[~india_mask]

    if len(india) >= 20:
        india_train, india_holdout = _candidate_group_split(india, holdout_fraction=0.20, seed=seed + 1)
        general = pd.concat([general, india_train], ignore_index=True)
    else:
        india_holdout = _empty_like(india)

    if len(general) < 5:
        train = _drop_private_columns(general)
        return SplitResult(
            train=train,
            validation=_empty_like(train),
            test=_empty_like(train),
            india_holdout=_drop_private_columns(india_holdout),
        )

    train, temp = _candidate_group_split(general, holdout_fraction=test_size + validation_size, seed=seed)
    validation_fraction_of_temp = validation_size / (test_size + validation_size)
    test, validation = _candidate_group_split(temp, holdout_fraction=validation_fraction_of_temp, seed=seed + 2)

    result = SplitResult(
        train=_drop_private_columns(train),
        validation=_drop_private_columns(validation),
        test=_drop_private_columns(test),
        india_holdout=_drop_private_columns(india_holdout),
    )

    partitions = [result.train, result.validation, result.test, result.india_holdout]
    for left_index, left in enumerate(partitions):
        for right in partitions[left_index + 1 :]:
            if set(left["text"]) & set(right["text"]):
                raise AssertionError("Exact normalized transaction text leaked between data splits.")
    return result
