from __future__ import annotations

from pathlib import Path
from typing import Any

from ..data.normalize import normalize_text
from ..models.auxiliary import (
    DuplicateSimilarityModel,
    MerchantSimilarityIndex,
    SpendingForecastModel,
    TransactionAnomalyModel,
)
from .model_registry import ModelRegistry


class InferenceService:
    _merchant_index: MerchantSimilarityIndex | None = None
    _duplicate_model: DuplicateSimilarityModel | None = None
    _anomaly_model: TransactionAnomalyModel | None = None
    _forecast_model: SpendingForecastModel | None = None

    def __init__(self, registry: ModelRegistry):
        self.registry = registry

    @classmethod
    def get_merchant_index(cls) -> MerchantSimilarityIndex:
        if cls._merchant_index is None:
            candidates = [
                Path("models/merchant-similarity/model.joblib"),
                Path(__file__).resolve().parents[3] / "models" / "merchant-similarity" / "model.joblib",
            ]
            for p in candidates:
                if p.exists():
                    cls._merchant_index = MerchantSimilarityIndex.load(p)
                    break
            if cls._merchant_index is None:
                cls._merchant_index = MerchantSimilarityIndex.fit(["amazon", "swiggy", "uber", "netflix", "walmart"])
        return cls._merchant_index

    @classmethod
    def get_duplicate_model(cls) -> DuplicateSimilarityModel:
        if cls._duplicate_model is None:
            candidates = [
                Path("models/duplicate-similarity/model.joblib"),
                Path(__file__).resolve().parents[3] / "models" / "duplicate-similarity" / "model.joblib",
            ]
            for p in candidates:
                if p.exists():
                    cls._duplicate_model = DuplicateSimilarityModel.load(p)
                    break
            if cls._duplicate_model is None:
                cls._duplicate_model = DuplicateSimilarityModel.fit(["payment", "transfer", "purchase"])
        return cls._duplicate_model

    @classmethod
    def get_anomaly_model(cls) -> TransactionAnomalyModel:
        if cls._anomaly_model is None:
            candidates = [
                Path("models/transaction-anomaly/model.joblib"),
                Path(__file__).resolve().parents[3] / "models" / "transaction-anomaly" / "model.joblib",
            ]
            for p in candidates:
                if p.exists():
                    cls._anomaly_model = TransactionAnomalyModel.load(p)
                    break
            if cls._anomaly_model is None:
                cls._anomaly_model = TransactionAnomalyModel.default_baseline()
        return cls._anomaly_model

    @classmethod
    def get_forecast_model(cls) -> SpendingForecastModel:
        if cls._forecast_model is None:
            candidates = [
                Path("models/spending-forecast/model.joblib"),
                Path(__file__).resolve().parents[3] / "models" / "spending-forecast" / "model.joblib",
            ]
            for p in candidates:
                if p.exists():
                    cls._forecast_model = SpendingForecastModel.load(p)
                    break
            if cls._forecast_model is None:
                cls._forecast_model = SpendingForecastModel.default_baseline()
        return cls._forecast_model

    def classify(self, description: str, top_n: int = 3) -> dict:
        text = normalize_text(description)
        if not text:
            text = description.strip()
        if not text:
            raise ValueError("description must be non-empty")
        prediction = self.registry.loaded.model.predict([text], top_n=top_n)
        return {
            "category": prediction.labels[0],
            "confidence": prediction.confidence[0],
            "top_k": [
                {"category": label, "confidence": confidence}
                for label, confidence in prediction.top_k[0]
            ],
            "model_revision": self.registry.loaded.revision,
            "model_type": self.registry.loaded.model_type,
        }

    def analyze(self, description: str, top_n: int = 3) -> dict:
        result = self.classify(description, top_n=top_n)
        result["analysis"] = {
            "classification": result["category"],
            "confidence": result["confidence"],
        }
        return result

    def match_merchant(self, text: str, top_k: int = 5) -> list[dict[str, str | float]]:
        idx = self.get_merchant_index()
        matches = idx.match(text, top_k=top_k)
        return [{"merchant": m.merchant, "similarity": round(m.score, 4)} for m in matches]

    def check_duplicates(
        self, query: str, candidates: list[str], threshold: float = 0.85, top_k: int = 5
    ) -> list[dict[str, str | float | int]]:
        model = self.get_duplicate_model()
        return model.find_similar(query, candidates, threshold=threshold, top_k=top_k)

    def score_anomalies(self, transactions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        model = self.get_anomaly_model()
        return model.score_transactions(transactions)

    def forecast_spending(
        self, daily_records: list[dict[str, Any]], horizon_days: int = 7
    ) -> list[dict[str, str | float]]:
        model = self.get_forecast_model()
        return model.forecast(daily_records, horizon_days=horizon_days)
