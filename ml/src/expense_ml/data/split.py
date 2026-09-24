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


def remove_conflicting_text_groups(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Remove every text group whose canonical labels disagree.

    Keeping one arbitrary label would silently corrupt supervised training. Keeping
    both labels would preserve contradictory supervision. Dropping the complete
    ambiguous group leaves the remaining corpus suitable for deterministic,
    leakage-safe splitting.
    """
    required = {"text", "label"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(
            f"remove_conflicting_text_groups requires columns: {sorted(required)}; "
            f"missing {sorted(missing)}"
        )

    data = frame.copy()
    conflicts = data.groupby("text", sort=False)["label"].nunique()
    conflicted_texts = set(conflicts[conflicts > 1].index)
    mask = data["text"].isin(conflicted_texts)

    conflicting_rows = data.loc[mask]
    label_pairs = (
        conflicting_rows.groupby("text", sort=False)["label"]
        .unique()
        .map(lambda labels: sorted(str(label) for label in labels))
    )
    source_pairs: dict[str, list[str]] = {}
    if "source" in conflicting_rows:
        source_pairs = {
            str(text): sorted(str(source) for source in values)
            for text, values in conflicting_rows.groupby("text", sort=False)["source"].unique().items()
        }

    summary = {
        "conflicting_text_groups": len(conflicted_texts),
        "rows_removed": int(mask.sum()),
        "label_conflict_examples": {
            str(text): labels for text, labels in label_pairs.head(10).items()
        },
        "source_conflict_examples": {
            text: values for text, values in list(source_pairs.items())[:10]
        },
    }
    return data.loc[~mask].reset_index(drop=True), summary


def _candidate_group_split(
    data: pd.DataFrame,
    holdout_fraction: float,
    seed: int,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if len(data) < 2:
        return _empty_like(data), data.copy().reset_index(drop=True)

    target = data["label"].value_counts(normalize=True)
    splitter = GroupShuffleSplit(
        n_splits=7,
        test_size=holdout_fraction,
        random_state=seed,
    )
    candidates: list[tuple[float, object, object]] = []
    for train_idx, holdout_idx in splitter.split(data, data["label"], groups=data["_group"]):
        candidate = data.iloc[holdout_idx]
        proportions = candidate["label"].value_counts(normalize=True).reindex(
            target.index,
            fill_value=0.0,
        )
        distribution_error = float((proportions - target).abs().sum())
        size_error = abs(len(candidate) / len(data) - holdout_fraction)
        candidates.append((distribution_error + size_error, train_idx, holdout_idx))

    _, train_idx, holdout_idx = min(candidates, key=lambda item: item[0])
    return data.iloc[train_idx].copy(), data.iloc[holdout_idx].copy()


def _validate_group_labels(data: pd.DataFrame) -> None:
    conflicts = data.groupby("_group", sort=False)["label"].nunique()
    conflicted = conflicts[conflicts > 1]
    if len(conflicted):
        examples = (
            data[data["_group"].isin(conflicted.index)]
            .groupby("_group")["label"]
            .unique()
            .head(10)
        )
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
    if (
        not 0 < test_size < 1
        or not 0 < validation_size < 1
        or test_size + validation_size >= 1
    ):
        raise ValueError("test_size and validation_size must be positive and sum to less than 1")
    if "text" not in frame or "label" not in frame:
        raise ValueError("split_dataset requires text and label columns")

    data = frame.copy()
    if "source" not in data:
        data["source"] = "unknown"
    if "country" not in data:
        data["country"] = "unknown"
    data["source"] = data["source"].fillna("unknown").astype(str)
    data["country"] = data["country"].fillna("unknown").astype(str)

    data, conflict_summary = remove_conflicting_text_groups(data)
    if conflict_summary["rows_removed"]:
        print(
            "Removed ambiguous duplicate-text groups before splitting: "
            f"{conflict_summary['conflicting_text_groups']} groups / "
            f"{conflict_summary['rows_removed']} rows"
        )

    data["_group"] = data["text"].fillna("").astype(str).map(_hash_text)
    _validate_group_labels(data)

    # Keep the India holdout country-pure without allowing cross-country text
    # duplicates to cross the holdout boundary. Groups containing any non-India
    # row are therefore excluded from the India-specific holdout candidate pool.
    group_country_sets = data.groupby("_group", sort=False)["country"].apply(
        lambda values: {str(value).casefold() for value in values}
    )
    india_only_groups = set(group_country_sets[group_country_sets.map(lambda values: values == {"india"})].index)
    india_rows = data[
        data["country"].str.casefold().eq("india")
        & data["_group"].isin(india_only_groups)
    ]

    if len(india_rows) >= 20:
        _, india_candidate_holdout = _candidate_group_split(
            india_rows,
            holdout_fraction=0.20,
            seed=seed + 1,
        )
        india_holdout_groups = set(india_candidate_holdout["_group"])
        india_holdout = data[data["_group"].isin(india_holdout_groups)].copy()
        general = data[~data["_group"].isin(india_holdout_groups)].copy()
    else:
        india_holdout = _empty_like(india_rows)
        general = data.copy()

    if len(general) < 5:
        train = _drop_private_columns(general)
        return SplitResult(
            train=train,
            validation=_empty_like(train),
            test=_empty_like(train),
            india_holdout=_drop_private_columns(india_holdout),
        )

    train, temp = _candidate_group_split(
        general,
        holdout_fraction=test_size + validation_size,
        seed=seed,
    )
    validation_fraction_of_temp = validation_size / (test_size + validation_size)
    test, validation = _candidate_group_split(
        temp,
        holdout_fraction=validation_fraction_of_temp,
        seed=seed + 2,
    )

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
