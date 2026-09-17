import pandas as pd

from expense_ml.data.split import split_dataset


def test_split_is_deterministic_and_has_no_exact_text_leakage():
    rows = []
    for i in range(50):
        rows.append({"text": f"merchant {i}", "label": "food" if i % 2 else "transport", "source": "global", "country": "USA"})
    rows.extend(
        [
            {"text": "repeated merchant", "label": "food", "source": "global", "country": "USA"},
            {"text": "repeated merchant", "label": "food", "source": "finee-india", "country": "India"},
            {"text": "repeated merchant", "label": "food", "source": "synthetic-indian-transactions", "country": "India"},
        ]
    )
    frame = pd.DataFrame(rows)
    a = split_dataset(frame, seed=7, test_size=.2, validation_size=.1)
    b = split_dataset(frame, seed=7, test_size=.2, validation_size=.1)
    assert a.train["text"].tolist() == b.train["text"].tolist()
    for left, right in (
        (a.train, a.test),
        (a.train, a.validation),
        (a.train, a.india_holdout),
        (a.validation, a.test),
        (a.validation, a.india_holdout),
        (a.test, a.india_holdout),
    ):
        assert set(left["text"]) & set(right["text"]) == set()


def test_split_uses_country_metadata_for_india_holdout():
    frame = pd.DataFrame(
        [
            {"text": f"india {i}", "label": "food" if i % 2 else "transport", "source": "global", "country": "India"}
            for i in range(100)
        ]
        + [
            {"text": f"usa {i}", "label": "food" if i % 2 else "transport", "source": "global", "country": "USA"}
            for i in range(100)
        ]
    )
    result = split_dataset(frame, seed=11, test_size=.2, validation_size=.1)
    assert len(result.india_holdout) > 0
    assert set(result.india_holdout["country"]) == {"India"}
