import pandas as pd
import pytest

from expense_ml.data.normalize import normalize_text, prepare_dataframe
from expense_ml.data.taxonomy import canonicalize_category


def test_normalize_text_collapses_whitespace_and_unicode():
    assert normalize_text("  Café\u00a0Coffee  ") == "café coffee"


def test_prepare_dataframe_drops_empty_and_duplicate_rows():
    frame = pd.DataFrame(
        {
            "text": ["Food  Shop", "food shop", None],
            "label": ["Food", "food", "Food"],
            "source": ["a", "b", "a"],
        }
    )
    result = prepare_dataframe(frame)
    assert len(result) == 1
    assert result.iloc[0]["text"] == "food shop"


def test_taxonomy_maps_source_labels_to_stable_categories():
    assert canonicalize_category("Food & Dining", "global-transaction-categorization") == "food_dining"
    assert canonicalize_category("food", "finee-india") == "food_dining"
    assert canonicalize_category("Transportation & Gas", "synthetic-indian-transactions") == "transportation"


def test_taxonomy_rejects_unknown_configured_source_labels():
    with pytest.raises(ValueError, match="Unknown category"):
        canonicalize_category("brand-new-category", "finee-india")


def test_prepare_dataframe_preserves_country_and_currency():
    frame = pd.DataFrame(
        {
            "text": ["Uber ride", "Tesco purchase"],
            "label": ["Transportation", "Shopping & Retail"],
            "source": ["global-transaction-categorization"] * 2,
            "country": ["USA", "uk"],
            "currency": ["usd", "gbp"],
        }
    )
    result = prepare_dataframe(frame)
    assert result["country"].tolist() == ["USA", "UK"]
    assert result["currency"].tolist() == ["USD", "GBP"]
