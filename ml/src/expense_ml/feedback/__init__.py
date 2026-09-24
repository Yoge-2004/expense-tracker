"""Feedback ingestion and validation for continuous learning."""

from .schema import FeedbackRecord
from .validation import validate_feedback_rows

__all__ = ["FeedbackRecord", "validate_feedback_rows"]
