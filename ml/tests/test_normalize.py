import pandas as pd

from expense_ml.data.normalize import normalize_text, prepare_dataframe


def test_normalize_text_collapses_whitespace_and_unicode():
    assert normalize_text("  Café\u00a0Coffee  ") == "café coffee"


def test_prepare_dataframe_drops_empty_and_duplicate_rows():
    frame = pd.DataFrame({"text": ["Food  Shop", "food shop", None], "label": ["Food", "food", "Food"], "source": ["a", "b", "a"]})
    result = prepare_dataframe(frame)
    assert len(result) == 1
    assert result.iloc[0]["text"] == "food shop"
