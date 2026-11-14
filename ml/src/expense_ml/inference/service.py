from __future__ import annotations

import logging
from typing import Any

from ..data.normalize import normalize_text
from ..models.auxiliary import (
    DuplicateSimilarityModel,
    MerchantSimilarityIndex,
    SpendingForecastModel,
    TransactionAnomalyModel,
)
from .model_registry import ModelRegistry

logger = logging.getLogger(__name__)


class InferenceService:
    def __init__(self, registry: ModelRegistry):
        self.registry = registry

    def get_merchant_index(self) -> MerchantSimilarityIndex:
        return self.registry.get_merchant_index()

    def get_duplicate_model(self) -> DuplicateSimilarityModel:
        return self.registry.get_duplicate_model()

    def get_anomaly_model(self) -> TransactionAnomalyModel:
        return self.registry.get_anomaly_model()

    def get_forecast_model(self) -> SpendingForecastModel:
        return self.registry.get_forecast_model()

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
