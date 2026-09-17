import pandas as pd

from expense_ml.data.split import split_dataset, remove_conflicting_text_groups


def test_split_is_deterministic_and_has_no_exact_text_leakage():
    rows = []
    for i in range(50):
        rows.append({"text": f"merchant {i}", "label": "food", "source": "global", "country": "USA"})
        rows.append({"text": f"merchant {i + 50}", "label": "transportation", "source": "global", "country": "Canada"})
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
    combined_partition_texts = set().union(*(set(part["text"]) for part in (a.train, a.validation, a.test, a.india_holdout)))
    assert "repeated merchant" in combined_partition_texts
    assert "repeated merchant" not in set(a.india_holdout["text"])


def test_cross_country_duplicate_is_excluded_from_india_holdout():
    frame = pd.DataFrame(
        [
            {"text": "same narration", "label": "food", "source": "global", "country": "USA"},
            {"text": "same narration", "label": "food", "source": "global", "country": "India"},
        ]
        + [
            {"text": f"india {i}", "label": "food", "source": "global", "country": "India"}
            for i in range(100)
        ]
        + [
            {"text": f"usa {i}", "label": "transportation", "source": "global", "country": "USA"}
            for i in range(100)
        ]
    )
    result = split_dataset(frame, seed=17, test_size=.2, validation_size=.1)
    assert "same narration" not in set(result.india_holdout["text"])


def test_split_uses_country_metadata_for_india_holdout():
    frame = pd.DataFrame(
        [
            {"text": f"india {i}", "label": "food", "source": "global", "country": "India"}
            for i in range(100)
        ]
        + [
            {"text": f"usa {i}", "label": "transportation", "source": "global", "country": "USA"}
            for i in range(100)
        ]
    )
    result = split_dataset(frame, seed=11, test_size=.2, validation_size=.1)
    assert len(result.india_holdout) > 0
    assert set(result.india_holdout["country"]) == {"India"}


def test_conflicting_text_groups_are_removed_before_splitting():
    frame = pd.DataFrame(
        [
            {"text": "ambiguous narration", "label": "food_dining", "source": "global", "country": "USA"},
            {"text": "ambiguous narration", "label": "shopping_retail", "source": "finee", "country": "India"},
            {"text": "clear food", "label": "food_dining", "source": "global", "country": "USA"},
            {"text": "clear transport", "label": "transportation", "source": "global", "country": "USA"},
        ]
    )

    cleaned, summary = remove_conflicting_text_groups(frame)

    assert "ambiguous narration" not in set(cleaned["text"])
    assert set(cleaned["text"]) == {"clear food", "clear transport"}
    assert summary["conflicting_text_groups"] == 1
    assert summary["rows_removed"] == 2
