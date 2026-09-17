import pandas as pd

from expense_ml.feedback.schema import FeedbackRecord
from expense_ml.training.dataset import build_training_frame


def _feedback(status: str, text: str, feedback_id: str = "f1") -> FeedbackRecord:
    return FeedbackRecord(
        feedback_id=feedback_id,
        transaction_id=feedback_id.replace("f", "t"),
        text=text,
        predicted_category="shopping_retail",
        corrected_category="food_dining",
        confidence=0.6,
        model_version="category-transformer@1.0.0",
        created_at="2026-09-18T00:00:00Z",
        training_status=status,
    )


def test_training_frame_adds_only_eligible_feedback_and_preserves_canonical_labels():
    base = pd.DataFrame([
        {"text": "grocery", "label": "food_dining", "source": "base", "country": "India"},
        {"text": "taxi", "label": "transportation", "source": "base", "country": "India"},
    ])
    records = [
        _feedback("eligible", "restaurant", "f1"),
        _feedback("pending", "noise", "f2"),
    ]

    result = build_training_frame(base, records)

    assert len(result) == 3
    assert "restaurant" in set(result["text"])
    assert "noise" not in set(result["text"])
    assert set(result["label"]) <= {"food_dining", "transportation"}
