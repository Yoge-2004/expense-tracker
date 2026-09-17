from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable

from ..data.normalize import normalize_text
from ..data.taxonomy import CANONICAL_CATEGORIES
from .schema import FeedbackRecord

_ALLOWED_STATUSES = {"pending", "eligible", "rejected", "consumed"}


def validate_feedback_rows(records: Iterable[FeedbackRecord]) -> list[FeedbackRecord]:
    """Validate and deterministically filter feedback eligible for training."""
    values = list(records)
    seen_ids: set[str] = set()
    conflicts: dict[str, set[str]] = defaultdict(set)
    valid: list[FeedbackRecord] = []

    for record in values:
        if not record.feedback_id.strip() or not record.transaction_id.strip():
            raise ValueError("Feedback identifiers must be non-empty")
        if record.feedback_id in seen_ids:
            raise ValueError(f"Duplicate feedback_id: {record.feedback_id}")
        seen_ids.add(record.feedback_id)

        text = normalize_text(record.text)
        if not text:
            raise ValueError(f"Feedback {record.feedback_id} has empty transaction text")
        if record.predicted_category not in CANONICAL_CATEGORIES:
            raise ValueError(f"Unknown category in predicted_category: {record.predicted_category}")
        if record.corrected_category not in CANONICAL_CATEGORIES:
            raise ValueError(f"Unknown category in corrected_category: {record.corrected_category}")
        if not 0 <= record.confidence <= 1:
            raise ValueError(f"Feedback {record.feedback_id} confidence must be between 0 and 1")
        if not record.model_version.strip():
            raise ValueError(f"Feedback {record.feedback_id} model_version must be non-empty")
        if record.training_status not in _ALLOWED_STATUSES:
            raise ValueError(
                f"Feedback {record.feedback_id} has unsupported training_status: {record.training_status}"
            )
        if record.training_status == "eligible":
            conflicts[text].add(record.corrected_category)

        valid.append(record)

    conflicting_texts = {text for text, labels in conflicts.items() if len(labels) > 1}
    if conflicting_texts:
        examples = sorted(conflicting_texts)[:10]
        raise ValueError(f"Conflicting eligible feedback corrections for normalized text: {examples}")

    return valid


def eligible_feedback(records: Iterable[FeedbackRecord]) -> list[FeedbackRecord]:
    """Return validated records explicitly marked eligible for training."""
    validated = validate_feedback_rows(records)
    return [record for record in validated if record.training_status == "eligible"]
