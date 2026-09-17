import pandas as pd
import pytest


def test_fetch_configured_datasets_normalizes_multiple_sources(tmp_path, monkeypatch):
    from expense_ml.data import fetch as fetch_module

    fake = [
        {"text": "Swiggy order", "category": "Food & Dining"},
        {"text": "Uber ride", "category": "Transportation"},
    ]
    monkeypatch.setattr(fetch_module, "pd", pd)
    monkeypatch.setattr("datasets.load_dataset", lambda *args, **kwargs: fake)

    frame, manifests = fetch_module.fetch_configured_datasets(
        [
            {
                "source": "global-transaction-categorization",
                "dataset_id": "demo/dataset",
                "split": "train",
                "text_column": "text",
                "label_column": "category",
                "default_country": "USA",
                "default_currency": "USD",
            }
        ],
        tmp_path,
        progress=False,
    )

    assert list(frame.columns) == ["text", "label", "source", "source_label", "country", "currency", "language", "record_id"]
    assert frame["label"].tolist() == ["food_dining", "transportation"]
    assert frame["country"].tolist() == ["USA", "USA"]
    assert manifests[0]["dataset_id"] == "demo/dataset"
    assert (tmp_path / "normalized" / "global-transaction-categorization.parquet").exists()


def test_fetch_huggingface_dataset_passes_hf_token(tmp_path, monkeypatch):
    from expense_ml.data import fetch as fetch_module

    captured = {}

    def fake_load_dataset(*args, **kwargs):
        captured.update(kwargs)
        return [{"text": "Swiggy order", "category": "Food & Dining"}]

    monkeypatch.setattr("datasets.load_dataset", fake_load_dataset)
    monkeypatch.setenv("HF_TOKEN", "test-token")
    fetch_module.fetch_huggingface_dataset(
        dataset_id="demo/dataset", text_column="text", label_column="category",
        source="global-transaction-categorization", cache_dir=tmp_path, progress=False,
    )
    assert captured["token"] == "test-token"


def test_fetch_huggingface_dataset_rejects_unmapped_source(tmp_path, monkeypatch):
    from expense_ml.data import fetch as fetch_module

    monkeypatch.setattr(
        "datasets.load_dataset",
        lambda *args, **kwargs: [{"text": "example", "category": "Food"}],
    )
    with pytest.raises(ValueError, match="No canonical taxonomy mapping"):
        fetch_module.fetch_huggingface_dataset(
            dataset_id="new/source",
            text_column="text",
            label_column="category",
            source="new-source",
            cache_dir=tmp_path,
            progress=False,
        )


def test_fetch_huggingface_dataset_extracts_finee_chatml_category(tmp_path, monkeypatch):
    from expense_ml.data import fetch as fetch_module

    fake = [{
        "messages": [
            {"role": "system", "content": "Extract financial entities."},
            {"role": "user", "content": "Extract financial entities from: HDFC Bank: Rs.2,500 debited for Swiggy"},
            {"role": "assistant", "content": '{"amount": 2500.0, "merchant": "Swiggy", "category": "food"}'},
        ]
    }]
    monkeypatch.setattr("datasets.load_dataset", lambda *args, **kwargs: fake)

    frame, _ = fetch_module.fetch_huggingface_dataset(
        dataset_id="Ranjit0034/finee-dataset",
        text_column="messages",
        label_column="messages",
        source="finee-india",
        cache_dir=tmp_path,
        progress=False,
        dataset_format="finee-chatml",
    )
    assert frame.loc[0, "text"] == "hdfc bank: rs.2,500 debited for swiggy"
    assert frame.loc[0, "label"] == "food_dining"
    assert frame.loc[0, "source_label"] == "food"
    assert frame.loc[0, "country"] == "India"
    assert frame.loc[0, "currency"] == "INR"


def test_fetch_huggingface_dataset_skips_finee_rows_without_category(tmp_path, monkeypatch):
    from expense_ml.data import fetch as fetch_module

    fake = [
        {
            "messages": [
                {"role": "user", "content": "Extract financial entities from: Bank transfer with no category"},
                {"role": "assistant", "content": '{"amount": 500.0}'},
            ]
        },
        {
            "messages": [
                {"role": "user", "content": "Extract financial entities from: Zomato payment"},
                {"role": "assistant", "content": '{"amount": 300.0, "category": "food"}'},
            ]
        },
    ]
    monkeypatch.setattr("datasets.load_dataset", lambda *args, **kwargs: fake)

    frame, _ = fetch_module.fetch_huggingface_dataset(
        dataset_id="Ranjit0034/finee-dataset",
        text_column="messages",
        label_column="messages",
        source="finee-india",
        cache_dir=tmp_path,
        progress=False,
        dataset_format="finee-chatml",
    )

    assert len(frame) == 1
    assert frame.loc[0, "text"] == "zomato payment"
    assert frame.loc[0, "label"] == "food_dining"


def test_fetch_huggingface_dataset_rejects_unknown_finee_category(tmp_path, monkeypatch):
    from expense_ml.data import fetch as fetch_module

    fake = [{
        "messages": [
            {"role": "user", "content": "Extract financial entities from: Example"},
            {"role": "assistant", "content": '{"category": "new-finee-category"}'},
        ]
    }]
    monkeypatch.setattr("datasets.load_dataset", lambda *args, **kwargs: fake)

    with pytest.raises(ValueError, match="without an explicit canonical mapping|Unknown category"):
        fetch_module.fetch_huggingface_dataset(
            dataset_id="Ranjit0034/finee-dataset",
            text_column="messages",
            label_column="messages",
            source="finee-india",
            cache_dir=tmp_path,
            progress=False,
            dataset_format="finee-chatml",
        )
