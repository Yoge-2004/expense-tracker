from __future__ import annotations

import logging
import sys
import threading
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..inference.model_registry import ModelRegistry
from ..inference.service import InferenceService

logger = logging.getLogger(__name__)


class ClassificationRequest(BaseModel):
    description: str = Field(min_length=1, max_length=4000)
    top_n: int = Field(default=3, ge=1, le=10)

    @field_validator("description")
    @classmethod
    def non_blank_description(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("description must be non-empty")
        return value


class ClassificationResponse(BaseModel):
    category: str
    confidence: float
    top_k: list[dict[str, float | str]]
    model_revision: str
    model_type: str


class AnalysisResponse(ClassificationResponse):
    analysis: dict[str, float | str]


class MerchantMatchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    top_k: int = Field(default=5, ge=1, le=20)


class MerchantMatchItem(BaseModel):
    merchant: str
    similarity: float


class MerchantMatchResponse(BaseModel):
    query: str
    matches: list[MerchantMatchItem]


class DuplicateCheckRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    candidates: list[str] = Field(min_length=1, max_length=1000)
    threshold: float = Field(default=0.85, ge=0.0, le=1.0)
    top_k: int = Field(default=5, ge=1, le=20)


class DuplicateMatchItem(BaseModel):
    text: str
    similarity: float
    index: int


class DuplicateCheckResponse(BaseModel):
    query: str
    matches: list[DuplicateMatchItem]


class AnomalyScoreRequest(BaseModel):
    transactions: list[dict[str, Any]] = Field(min_length=1, max_length=10000)


class AnomalyScoreResponse(BaseModel):
    results: list[dict[str, Any]]
    total_anomalies: int


class SpendingForecastRequest(BaseModel):
    history: list[dict[str, Any]] = Field(min_length=28, max_length=5000)
    horizon_days: int = Field(default=7, ge=1, le=30)


class ForecastDayItem(BaseModel):
    date: str
    predicted_amount: float


class SpendingForecastResponse(BaseModel):
    horizon_days: int
    forecast: list[ForecastDayItem]


app = FastAPI(title="Expense Tracker ML API", version="0.3.0")
_registry_lock = threading.Lock()
_registry: ModelRegistry | None = None
_load_error: str | None = None


def _service() -> InferenceService:
    global _registry, _load_error
    if _registry is None:
        with _registry_lock:
            if _registry is None:
                try:
                    _registry = ModelRegistry.from_environment()
                    _load_error = None
                except Exception as exc:  # noqa: BLE001
                    _load_error = f"{type(exc).__name__}: {exc}"
                    logger.error("Failed to load model registry from environment: %s", exc)
    if _registry is None:
        raise HTTPException(status_code=503, detail="ML model is unavailable")
    return InferenceService(_registry)


@app.get("/health")
def health() -> dict:
    try:
        service = _service()
    except HTTPException:
        return {"status": "degraded", "model_error": _load_error or "model not loaded"}

    aux_status = {}
    try:
        merchant_idx = service.get_merchant_index()
        aux_status["merchant_similarity"] = {
            "status": "ready",
            "indexed_count": len(getattr(merchant_idx, "merchants", [])),
            "vocab_size": len(getattr(getattr(merchant_idx, "vectorizer", None), "vocabulary_", {})),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Merchant similarity health check failed: %s", exc)
        aux_status["merchant_similarity"] = {"status": "error", "error": str(exc)}

    try:
        dup_model = service.get_duplicate_model()
        aux_status["duplicate_similarity"] = {
            "status": "ready",
            "vocab_size": len(getattr(getattr(dup_model, "vectorizer", None), "vocabulary_", {})),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Duplicate similarity health check failed: %s", exc)
        aux_status["duplicate_similarity"] = {"status": "error", "error": str(exc)}

    try:
        anomaly_model = service.get_anomaly_model()
        aux_status["transaction_anomaly"] = {
            "status": "ready",
            "model_class": type(getattr(anomaly_model, "model", None)).__name__,
            "features": list(getattr(anomaly_model, "feature_columns", [])),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Transaction anomaly health check failed: %s", exc)
        aux_status["transaction_anomaly"] = {"status": "error", "error": str(exc)}

    try:
        forecast_model = service.get_forecast_model()
        aux_status["spending_forecast"] = {
            "status": "ready",
            "model_class": type(getattr(forecast_model, "model", None)).__name__,
            "features": list(getattr(forecast_model, "feature_columns", [])),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Spending forecast health check failed: %s", exc)
        aux_status["spending_forecast"] = {"status": "error", "error": str(exc)}

    return {
        "status": "ok",
        "model": service.registry.metadata(),
        "auxiliary_models": aux_status,
        "runtime": {
            "python_version": sys.version.split()[0],
            "framework": "FastAPI + scikit-learn",
            "timestamp": datetime.now(UTC).isoformat(),
        },
    }


@app.post("/api/v1/classify", response_model=ClassificationResponse)
def classify(request: ClassificationRequest) -> dict:
    return _service().classify(request.description, top_n=request.top_n)


@app.post("/api/v1/analyze", response_model=AnalysisResponse)
def analyze(request: ClassificationRequest) -> dict:
    return _service().analyze(request.description, top_n=request.top_n)


@app.post("/api/v1/merchants/match", response_model=MerchantMatchResponse)
def match_merchant(request: MerchantMatchRequest) -> dict:
    matches = _service().match_merchant(request.query, top_k=request.top_k)
    return {"query": request.query, "matches": matches}


@app.post("/api/v1/duplicates/check", response_model=DuplicateCheckResponse)
def check_duplicates(request: DuplicateCheckRequest) -> dict:
    matches = _service().check_duplicates(
        request.query, request.candidates, threshold=request.threshold, top_k=request.top_k
    )
    return {"query": request.query, "matches": matches}


@app.post("/api/v1/anomalies/score", response_model=AnomalyScoreResponse)
def score_anomalies(request: AnomalyScoreRequest) -> dict:
    results = _service().score_anomalies(request.transactions)
    anomalies_count = sum(1 for r in results if r.get("is_anomaly") is True)
    return {"results": results, "total_anomalies": anomalies_count}


@app.post("/api/v1/forecast/spending", response_model=SpendingForecastResponse)
def forecast_spending(request: SpendingForecastRequest) -> dict:
    try:
        forecast = _service().forecast_spending(request.history, horizon_days=request.horizon_days)
        return {"horizon_days": request.horizon_days, "forecast": forecast}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
