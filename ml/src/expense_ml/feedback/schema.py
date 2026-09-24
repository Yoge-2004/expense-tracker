from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class FeedbackRecord:
    """One backend-approved user/model feedback record."""

    feedback_id: str
    transaction_id: str
    text: str
    predicted_category: str
    corrected_category: str
    confidence: float
    model_version: str
    created_at: str
    training_status: str
    source: str = "spring-boot"

    @classmethod
    def from_mapping(cls, payload: Mapping[str, object]) -> "FeedbackRecord":
        required = {
            "feedback_id",
            "transaction_id",
            "text",
            "predicted_category",
            "corrected_category",
            "confidence",
            "model_version",
            "created_at",
            "training_status",
        }
        missing = sorted(required - set(payload))
        if missing:
            raise ValueError(f"Feedback record is missing required fields: {missing}")
        return cls(
            feedback_id=str(payload["feedback_id"]),
            transaction_id=str(payload["transaction_id"]),
            text=str(payload["text"]),
            predicted_category=str(payload["predicted_category"]),
            corrected_category=str(payload["corrected_category"]),
            confidence=float(payload["confidence"]),
            model_version=str(payload["model_version"]),
            created_at=str(payload["created_at"]),
            training_status=str(payload["training_status"]),
            source=str(payload.get("source", "spring-boot")),
        )
