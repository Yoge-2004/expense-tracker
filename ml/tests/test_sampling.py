import pandas as pd
import pytest

from expense_ml.data.sampling import balanced_training_sample


def test_balanced_training_sample_is_deterministic_and_bounded():
    frame = pd.DataFrame(
        [
            {"text": f"usa-{i}", "label": "food", "source": "global", "country": "USA"}
            for i in range(80)
        ]
        + [
            {"text": f"india-{i}", "label": "food", "source": "finee-india", "country": "India"}
            for i in range(20)
        ]
        + [
            {"text": f"india-t-{i}", "label": "transportation", "source": "synthetic", "country": "India"}
            for i in range(20)
        ]
    )
    a = balanced_training_sample(frame, max_rows=25, seed=17)
    b = balanced_training_sample(frame, max_rows=25, seed=17)
    assert len(a) == 25
    assert a["text"].tolist() == b["text"].tolist()
    assert a["text"].nunique() == len(a)
    assert set(a["country"]) == {"USA", "India"}
    assert set(a["source"]) == {"global", "finee-india", "synthetic"}
    assert set(a["label"]) == {"food", "transportation"}


def test_balanced_training_sample_rejects_impossible_label_budget():
    frame = pd.DataFrame(
        [
            {"text": f"sample-{i}", "label": label, "source": "global", "country": "USA"}
            for label in ("food", "transportation", "healthcare")
            for i in range(10)
        ]
    )
    with pytest.raises(ValueError, match="too small to preserve all"):
        balanced_training_sample(frame, max_rows=2, seed=1)
