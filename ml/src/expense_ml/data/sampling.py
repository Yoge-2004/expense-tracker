from __future__ import annotations

import math

import pandas as pd


def balanced_training_sample(frame: pd.DataFrame, max_rows: int, seed: int) -> pd.DataFrame:
    """Deterministically sample across country/source/class groups.

    The evaluation sets are never sampled; this helper is used only for the
    computationally expensive training stages.
    """
    if max_rows < 1:
        raise ValueError("max_rows must be >= 1")
    if len(frame) <= max_rows:
        return frame.sample(frac=1.0, random_state=seed).reset_index(drop=True)

    group_columns = [column for column in ("country", "source", "label") if column in frame.columns]
    if not group_columns:
        return frame.sample(n=max_rows, random_state=seed).reset_index(drop=True)

    grouped = frame.groupby(group_columns, dropna=False, sort=False)
    per_group_cap = max(1, math.ceil(max_rows / grouped.ngroups))
    pieces: list[pd.DataFrame] = []
    for _, group in grouped:
        n = min(len(group), per_group_cap)
        pieces.append(group.sample(n=n, random_state=seed))

    sampled = pd.concat(pieces, ignore_index=True) if pieces else frame.iloc[0:0].copy()
    if len(sampled) > max_rows:
        sampled = sampled.sample(n=max_rows, random_state=seed)
    elif len(sampled) < max_rows:
        remaining = frame.drop(index=sampled.index, errors="ignore")
        if len(remaining):
            needed = min(max_rows - len(sampled), len(remaining))
            sampled = pd.concat(
                [sampled, remaining.sample(n=needed, random_state=seed + 1)],
                ignore_index=True,
            )
    return sampled.sample(frac=1.0, random_state=seed).reset_index(drop=True)
