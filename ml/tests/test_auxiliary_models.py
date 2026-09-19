import numpy as np
import pandas as pd

from expense_ml.models import MerchantSimilarityIndex, SpendingForecastModel
from expense_ml.reporting import save_anomaly_figure, save_dataset_figures, save_model_comparison


def test_merchant_index_matches_similar_narration():
    index = MerchantSimilarityIndex.fit([
        "swiggy order 123",
        "uber ride 456",
        "amazon purchase 9",
    ])
    matches = index.match("swiggy order 999", top_k=1)
    assert matches[0].merchant == "swiggy order"


def test_spending_forecast_rejects_insufficient_history():
    frame = pd.DataFrame({
        "date": pd.date_range("2025-01-01", periods=20, freq="D"),
        "amount": range(20),
        "text": ["x"] * 20,
        "label": ["Food"] * 20,
    })
    try:
        SpendingForecastModel.fit(frame)
        raise AssertionError("Expected insufficient-history validation to fail")
    except ValueError as exc:
        assert "at least 63" in str(exc)


def test_reporting_exports_pngs(tmp_path):
    frame = pd.DataFrame({"label": ["Food", "Food", "Transport"]})
    save_dataset_figures(frame, tmp_path)
    save_model_comparison([{"model_name": "a", "accuracy": .8, "macro_f1": .8, "weighted_f1": .8}], tmp_path)
    save_anomaly_figure(np.array([-.1, .1, .2]), tmp_path)
    assert (tmp_path / "dataset_class_distribution.png").exists()
    assert (tmp_path / "model_comparison.png").exists()
    assert (tmp_path / "anomaly_score_distribution.png").exists()
