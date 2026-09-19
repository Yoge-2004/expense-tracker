from __future__ import annotations

import math

import pandas as pd


def balanced_training_sample(frame: pd.DataFrame, max_rows: int, seed: int) -> pd.DataFrame:
    """Deterministically sample across country/source/class groups without replacement.

    Every label present in the input is guaranteed to remain represented when the
    requested sample can contain at least one row per label.
    """
    if max_rows < 1:
        raise ValueError("max_rows must be >= 1")
    if frame.empty:
        return frame.copy().reset_index(drop=True)

    labels = frame["label"].dropna().astype(str).unique().tolist() if "label" in frame.columns else []
    if labels and max_rows < len(labels):
        raise ValueError(
            f"max_rows={max_rows} is too small to preserve all {len(labels)} training labels."
        )
    if len(frame) <= max_rows:
        return frame.sample(frac=1.0, random_state=seed).reset_index(drop=True)

    group_columns = [column for column in ("country", "source", "label") if column in frame.columns]
    if not group_columns:
        selected = frame.sample(n=max_rows, random_state=seed)
    else:
        grouped = frame.groupby(group_columns, dropna=False, sort=False)
        per_group_cap = max(1, math.ceil(max_rows / grouped.ngroups))
        sampled_indices: list[int] = []
        for _, group in grouped:
            n = min(len(group), per_group_cap)
            sampled_indices.extend(group.sample(n=n, random_state=seed).index.tolist())
        selected = frame.loc[sampled_indices]

        if len(selected) > max_rows:
            # Downsample while explicitly retaining one representative per class.
            keep_indices = []
            for _, group in selected.groupby("label", sort=False):
                keep_indices.append(group.sample(n=1, random_state=seed).index[0])
            keep_index_set = set(keep_indices)
            remainder = selected.drop(index=keep_index_set)
            needed_remainder = max_rows - len(keep_indices)
            selected = pd.concat(
                [selected.loc[keep_indices], remainder.sample(n=needed_remainder, random_state=seed + 1)],
                ignore_index=False,
            )
        elif len(selected) < max_rows:
            remaining = frame.drop(index=selected.index)
            needed = min(max_rows - len(selected), len(remaining))
            if needed:
                selected = pd.concat(
                    [selected, remaining.sample(n=needed, random_state=seed + 1)],
                    ignore_index=False,
                )

    if len(selected) != max_rows:
        raise AssertionError("Balanced sampler failed to produce the requested number of unique rows.")
    if selected.index.has_duplicates:
        raise AssertionError("Balanced sampler selected the same source row more than once.")
    if labels and not set(labels).issubset(set(selected["label"].astype(str))):
        missing = sorted(set(labels) - set(selected["label"].astype(str)))
        raise AssertionError(f"Balanced sampler dropped training labels: {missing}")
    return selected.sample(frac=1.0, random_state=seed).reset_index(drop=True)
