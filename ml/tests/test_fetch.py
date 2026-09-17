import pandas as pd


def test_fetch_configured_datasets_normalizes_multiple_sources(tmp_path, monkeypatch):
    from expense_ml.data import fetch as fetch_module

    class FakeDataset(list):
        pass

    fake = FakeDataset([
        {"text": "Swiggy order", "category": "Food"},
        {"text": "Uber ride", "category": "Transport"},
    ])

    monkeypatch.setattr(fetch_module, "pd", pd)
    monkeypatch.setattr(
        "datasets.load_dataset",
        lambda *args, **kwargs: fake,
    )

    frame, manifests = fetch_module.fetch_configured_datasets(
        [
            {
                "source": "demo",
                "dataset_id": "demo/dataset",
                "split": "train",
                "text_column": "text",
                "label_column": "category",
            }
        ],
        tmp_path,
        progress=False,
    )

    assert list(frame.columns) == ["text", "label", "source"]
    assert len(frame) == 2
    assert manifests[0]["dataset_id"] == "demo/dataset"
    assert (tmp_path / "normalized" / "demo.parquet").exists()


def test_fetch_huggingface_dataset_passes_hf_token(tmp_path, monkeypatch):
    from expense_ml.data import fetch as fetch_module

    captured = {}

    def fake_load_dataset(*args, **kwargs):
        captured.update(kwargs)
        return [{"text": "Swiggy order", "category": "Food"}]

    monkeypatch.setattr("datasets.load_dataset", fake_load_dataset)
    monkeypatch.setenv("HF_TOKEN", "test-token")

    fetch_module.fetch_huggingface_dataset(
        dataset_id="demo/dataset",
        text_column="text",
        label_column="category",
        source="demo-token",
        cache_dir=tmp_path,
        progress=False,
    )

    assert captured["token"] == "test-token"
