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
