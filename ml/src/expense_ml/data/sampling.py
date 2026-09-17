from __future__ import annotations

import math

import pandas as pd


def balanced_training_sample(frame: pd.DataFrame, max_rows: int, seed: int) -> pd.DataFrame:
    """Deterministically sample across country/source/class groups without replacement."""
    if max_rows < 1:
        raise ValueError("max_rows must be >= 1")
    if len(frame) <= max_rows:
        return frame.sample(frac=1.0, random_state=seed).reset_index(drop=True)

    group_columns = [column for column in ("country", "source", "label") if column in frame.columns]
    if not group_columns:
        return frame.sample(n=max_rows, random_state=seed).reset_index(drop=True)

    grouped = frame.groupby(group_columns, dropna=False, sort=False)
    per_group_cap = max(1, math.ceil(max_rows / grouped.ngroups))
    sampled_indices: list[int] = []
    for _, group in grouped:
        n = min(len(group), per_group_cap)
        sampled_indices.extend(group.sample(n=n, random_state=seed).index.tolist())

    selected = frame.loc[sampled_indices]
    if len(selected) > max_rows:
        selected = selected.sample(n=max_rows, random_state=seed)
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
    return selected.sample(frac=1.0, random_state=seed).reset_index(drop=True)
