import pandas as pd

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
    a = balanced_training_sample(frame, max_rows=30, seed=17)
    b = balanced_training_sample(frame, max_rows=30, seed=17)
    assert len(a) == 30
    assert a["text"].tolist() == b["text"].tolist()
    assert set(a["country"]) == {"USA", "India"}
    assert set(a["source"]) == {"global", "finee-india", "synthetic"}
