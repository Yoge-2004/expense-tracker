from __future__ import annotations

import hashlib
import json

import pandas as pd

from ..data.normalize import normalize_text, prepare_dataframe
from ..data.split import remove_conflicting_text_groups
from ..data.taxonomy import CANONICAL_CATEGORIES
from ..feedback.schema import FeedbackRecord
from ..feedback.validation import eligible_feedback


def feedback_fingerprint(records: list[FeedbackRecord]) -> str:
    payload = [
        {
            "feedback_id": record.feedback_id,
            "transaction_id": record.transaction_id,
            "text": normalize_text(record.text),
            "corrected_category": record.corrected_category,
        }
        for record in sorted(records, key=lambda item: item.feedback_id)
    ]
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def training_data_fingerprint(frame: pd.DataFrame) -> str:
    """Create a deterministic fingerprint for the complete training corpus."""
    columns = [
        column
        for column in ("text", "label", "source", "country", "currency", "language", "record_id")
        if column in frame
    ]
    payload = (
        frame.loc[:, columns]
        .fillna("")
        .astype(str)
        .sort_values(columns)
        .to_json(orient="records", force_ascii=False)
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_training_frame(
    base_frame: pd.DataFrame,
    feedback_records: list[FeedbackRecord],
) -> pd.DataFrame:
    """Build a canonical training corpus from curated data and eligible feedback."""
    base = prepare_dataframe(
        base_frame,
        progress=False,
        canonicalize=False,
        strict_taxonomy=False,
    )
    unexpected = sorted(set(base["label"]) - set(CANONICAL_CATEGORIES))
    if unexpected:
        raise ValueError(f"Base training data contains non-canonical labels: {unexpected}")

    eligible = eligible_feedback(feedback_records)
    feedback_frame = pd.DataFrame(
        [
            {
                "text": normalize_text(record.text),
                "label": record.corrected_category,
                "source": "verified-feedback",
                "source_label": record.corrected_category,
                "country": "unknown",
                "currency": "unknown",
                "language": "unknown",
                "record_id": record.feedback_id,
                "feedback_id": record.feedback_id,
                "transaction_id": record.transaction_id,
                "feedback_model_version": record.model_version,
            }
            for record in eligible
        ]
    )
    if feedback_frame.empty:
        return base.reset_index(drop=True)

    combined = pd.concat([base, feedback_frame], ignore_index=True, sort=False)
    combined = prepare_dataframe(
        combined,
        progress=False,
        canonicalize=False,
        strict_taxonomy=False,
    )
    combined, _ = remove_conflicting_text_groups(combined)
    combined = combined.drop_duplicates(
        subset=["text", "label"],
        keep="first",
    ).reset_index(drop=True)
    return combined
