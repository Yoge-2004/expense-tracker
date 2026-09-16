import pandas as pd

from expense_ml.data.split import split_dataset


def test_split_is_deterministic_and_has_no_exact_text_leakage():
    rows = [{"text": f"merchant {i}", "label": "food" if i % 2 else "transport", "source": "global"} for i in range(100)]
    frame = pd.DataFrame(rows)
    a = split_dataset(frame, seed=7, test_size=.2, validation_size=.1)
    b = split_dataset(frame, seed=7, test_size=.2, validation_size=.1)
    assert a.train["text"].tolist() == b.train["text"].tolist()
    assert set(a.train.text) & set(a.test.text) == set()
    assert set(a.train.text) & set(a.validation.text) == set()
