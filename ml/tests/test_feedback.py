import pytest

from expense_ml.feedback.client import FeedbackClientError, count_training_feedback
from expense_ml.feedback.schema import FeedbackRecord
from expense_ml.feedback.validation import eligible_feedback, validate_feedback_rows


def _record(**overrides):
    values = {
        "feedback_id": "1",
        "transaction_id": "t1",
        "text": "coffee shop",
        "predicted_category": "shopping_retail",
        "corrected_category": "food_dining",
        "confidence": 0.8,
        "model_version": "category-transformer@1.0.0",
        "created_at": "2026-09-18T00:00:00Z",
        "training_status": "eligible",
    }
    values.update(overrides)
    return FeedbackRecord(**values)


def test_feedback_validator_rejects_unknown_categories():
    with pytest.raises(ValueError, match="Unknown category"):
        validate_feedback_rows([_record(corrected_category="not_real")])


def test_feedback_validator_rejects_conflicting_eligible_corrections():
    with pytest.raises(ValueError, match="Conflicting eligible feedback corrections"):
        validate_feedback_rows([
            _record(feedback_id="1", corrected_category="food_dining"),
            _record(feedback_id="2", corrected_category="transportation"),
        ])


def test_eligible_feedback_excludes_pending_records():
    records = [
        _record(feedback_id="1", training_status="eligible"),
        _record(feedback_id="2", training_status="pending"),
    ]
    result = eligible_feedback(records)
    assert [record.feedback_id for record in result] == ["1"]


@pytest.mark.parametrize("base_url", ["file:///etc", "ftp://host/path", "javascript:alert(1)", "http://"])
def test_feedback_client_rejects_non_http_urls(base_url):
    with pytest.raises(FeedbackClientError, match="http"):
        count_training_feedback(base_url, "token")
