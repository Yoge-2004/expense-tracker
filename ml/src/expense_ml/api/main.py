"""Expense Tracker ML inference API.

FastAPI service that exposes the transaction-intelligence models (category
classification, merchant matching, duplicate detection, anomaly scoring and
spending forecasts) to the Spring Boot backend.

The service listens on loopback only. In the combined container, nginx exposes
just ``GET /health`` publicly; every other route is reached by the backend over
``127.0.0.1``. Interactive docs are served at ``/docs`` (Swagger UI) and
``/redoc`` on that loopback address.
"""

from __future__ import annotations

import logging
import re
import sys
import threading
import time
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..inference.model_registry import ModelRegistry
from ..inference.service import InferenceService
from .logging_buffer import get_log_handler, setup_api_logging

setup_api_logging()
logger = logging.getLogger(__name__)


class ClassificationRequest(BaseModel):
    """Free-text transaction description to categorise."""

    description: str = Field(
        min_length=1,
        max_length=4000,
        description="Raw transaction text, e.g. a merchant name or bank-statement line.",
        examples=["SWIGGY ORDER 48213 BANGALORE"],
    )
    top_n: int = Field(
        default=3,
        ge=1,
        le=10,
        description="How many ranked category candidates to return in `top_k`.",
    )

    @field_validator("description")
    @classmethod
    def non_blank_description(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("description must be non-empty")
        return value


class ClassificationResponse(BaseModel):
    """Predicted category plus ranked alternatives and model provenance."""

    category: str = Field(description="Best-matching category label.", examples=["Food & Dining"])
    confidence: float = Field(description="Model confidence for `category`, from 0 to 1.", examples=[0.93])
    top_k: list[dict[str, float | str]] = Field(
        description="Ranked candidates, each `{category, confidence}`, best first.",
        examples=[[{"category": "Food & Dining", "confidence": 0.93}, {"category": "Groceries", "confidence": 0.04}]],
    )
    model_revision: str = Field(description="Identifier of the model revision that produced the result.")
    model_type: str = Field(description="Model family in use, e.g. `tfidf` or `transformer`.")


class AnalysisResponse(ClassificationResponse):
    """Classification result extended with an `analysis` summary block."""

    analysis: dict[str, float | str] = Field(
        description="Summary of the decision: `classification` label and its `confidence`."
    )


class MerchantMatchRequest(BaseModel):
    """Messy merchant text to resolve against the known-merchant index."""

    query: str = Field(
        min_length=1,
        max_length=200,
        description="Merchant text as it appears on a statement.",
        examples=["AMZN MKTP IN*2K4"],
    )
    top_k: int = Field(default=5, ge=1, le=20, description="Maximum number of matches to return.")


class MerchantMatchItem(BaseModel):
    """One candidate merchant and how closely it matches the query."""

    merchant: str = Field(description="Canonical merchant name.", examples=["Amazon"])
    similarity: float = Field(description="Cosine similarity from 0 to 1 (higher is closer).", examples=[0.8123])


class MerchantMatchResponse(BaseModel):
    """Echo of the query with its ranked merchant matches."""

    query: str = Field(description="The query that was matched.")
    matches: list[MerchantMatchItem] = Field(description="Matches ordered by similarity, best first.")


class DuplicateCheckRequest(BaseModel):
    """A new entry and the existing entries to compare it against."""

    query: str = Field(
        min_length=1,
        max_length=500,
        description="Text of the new entry, e.g. a description about to be saved.",
        examples=["Netflix monthly subscription"],
    )
    candidates: list[str] = Field(
        min_length=1,
        max_length=1000,
        description="Existing entries to compare with (each at most 500 characters).",
        examples=[["Netflix subscription", "Grocery run"]],
    )
    threshold: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0,
        description="Minimum similarity for a candidate to count as a duplicate.",
    )
    top_k: int = Field(default=5, ge=1, le=20, description="Maximum number of matches to return.")

    @field_validator("candidates")
    @classmethod
    def validate_candidates(cls, candidates: list[str]) -> list[str]:
        for c in candidates:
            if len(c) > 500:
                raise ValueError("individual candidate string must not exceed 500 characters")
        return candidates


class DuplicateMatchItem(BaseModel):
    """A candidate that is similar enough to the query to be a likely duplicate."""

    text: str = Field(description="The matching candidate text.")
    similarity: float = Field(description="Similarity from 0 to 1 (higher is closer).")
    index: int = Field(description="Zero-based position of the candidate in the request's `candidates` list.")


class DuplicateCheckResponse(BaseModel):
    """Candidates at or above the requested similarity threshold."""

    query: str = Field(description="The query that was checked.")
    matches: list[DuplicateMatchItem] = Field(description="Likely duplicates, most similar first.")


class AnomalyScoreRequest(BaseModel):
    """Transactions to score for unusual behaviour."""

    transactions: list[dict[str, Any]] = Field(
        min_length=1,
        max_length=10000,
        description=(
            "Transaction records. Numeric fields `amount`, `balance`, `hour` and `day_of_week` "
            "are used when present (`amount` is required by the model); any other fields are "
            "passed through unchanged to the result."
        ),
        examples=[[{"amount": 4999.0, "hour": 3, "day_of_week": 6, "balance": 1200.0}]],
    )


class AnomalyScoreResponse(BaseModel):
    """Input transactions annotated with anomaly scores."""

    results: list[dict[str, Any]] = Field(
        description="Each input record plus `anomaly_score` (lower is more unusual) and `is_anomaly`."
    )
    total_anomalies: int = Field(description="Number of records flagged as anomalies.")


class SpendingForecastRequest(BaseModel):
    """Spending history used to project future daily totals."""

    history: list[dict[str, Any]] = Field(
        min_length=28,
        max_length=5000,
        description=(
            "At least 28 transaction records, each with a date field (`date`, `transaction_date`, "
            "`timestamp` or `datetime`) and an amount field (`amount`, `value` or `transaction_amount`). "
            "Records are summed per day."
        ),
        examples=[[{"date": "2026-10-01", "amount": 420.5}, {"date": "2026-10-02", "amount": 85.0}]],
    )
    horizon_days: int = Field(default=7, ge=1, le=30, description="Number of future days to forecast.")


class ForecastDayItem(BaseModel):
    """Predicted total spend for a single future day."""

    date: str = Field(description="Calendar date in ISO format (YYYY-MM-DD).", examples=["2026-11-16"])
    predicted_amount: float = Field(description="Predicted total spend for that day.", examples=[312.4])


class SpendingForecastResponse(BaseModel):
    """Day-by-day spending forecast."""

    horizon_days: int = Field(description="Number of days forecast.")
    forecast: list[ForecastDayItem] = Field(description="One entry per forecast day, in date order.")


API_DESCRIPTION = """
Machine-learning endpoints behind the **Expense Tracker** smart features.

## What it does
- **Classification**: predict a spending category from free text.
- **Merchants**: resolve messy statement text to a canonical merchant.
- **Duplicates**: flag a new entry that closely matches existing ones.
- **Anomalies**: score transactions for unusual amount, hour or day patterns.
- **Forecast**: project daily spending for the next 1 to 30 days.

## Conventions
- Business routes live under `/api/v1/` and accept and return JSON.
- Validation failures return `422`; an unavailable or still-loading model returns `503`.
- There is no built-in authentication. The service listens on loopback only and is
  called by the Spring Boot backend, so keep it off public networks.
"""

OPENAPI_TAGS = [
    {"name": "Classification", "description": "Predict a spending category from a transaction description."},
    {"name": "Merchants", "description": "Match noisy merchant text to the known-merchant index."},
    {"name": "Duplicates", "description": "Detect near-duplicate entries."},
    {"name": "Anomalies", "description": "Score transactions for unusual behaviour."},
    {"name": "Forecast", "description": "Project future daily spending."},
    {"name": "Operations", "description": "Health, logs and model hot-reload for operators."},
]

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"description": "Request body failed validation."},
    503: {"description": "The ML model is unavailable or still loading."},
}

app = FastAPI(
    title="Expense Tracker ML API",
    version="0.3.0",
    summary="Transaction intelligence for Expense Tracker",
    description=API_DESCRIPTION,
    openapi_tags=OPENAPI_TAGS,
    license_info={"name": "Apache 2.0", "url": "https://www.apache.org/licenses/LICENSE-2.0"},
)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        if request.url.path.endswith("/logs"):
            return await call_next(request)
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        safe_method = re.sub(r"[\r\n]", "", request.method)[:16]
        safe_path = re.sub(r"[\r\n]", "", request.url.path)[:256]
        logger.info("%s %s -> %d (%.2fms)", safe_method, safe_path, response.status_code, elapsed_ms)
        return response


app.add_middleware(RequestLoggingMiddleware)

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


@app.get(
    "/health",
    tags=["Operations"],
    summary="Service and model health",
    response_description="`status` is `ok` when the model is loaded, or `degraded` with a `model_error`.",
)
def health() -> dict:
    """Report whether the primary model and each auxiliary model (merchant, duplicate,
    anomaly, forecast) are loaded, together with runtime details.

    Always answers with HTTP 200 so load balancers can read the body; check `status`.
    """
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


@app.get("/logs", include_in_schema=False)
@app.get(
    "/api/v1/logs",
    tags=["Operations"],
    summary="Recent service log entries",
    response_description="Newest log entries from the in-memory buffer.",
)
def get_logs(
    lines: int = Query(default=150, ge=1, le=1000, description="Maximum number of entries to return."),
    level: str = Query(default="ALL", max_length=20, description="Minimum level filter, e.g. `ERROR`, or `ALL`."),
    query: str | None = Query(default=None, max_length=200, description="Only entries containing this text."),
) -> list[dict[str, Any]]:
    """Return recent log lines from the in-memory buffer, optionally filtered.

    `/logs` is a legacy alias of this route and is hidden from the schema.
    """
    return get_log_handler().get_logs(limit=lines, level=level, query=query)


@app.post("/reload", include_in_schema=False)
@app.post(
    "/api/v1/reload",
    tags=["Operations"],
    summary="Reload models from disk",
    response_description="Metadata of the freshly loaded model.",
    responses={500: {"description": "Reload failed; the previous state is reported in `/health`."}},
)
def reload_models() -> dict[str, Any]:
    """Re-read the model registry so a newly trained or promoted model takes effect
    without restarting the service.

    `/reload` is a legacy alias of this route and is hidden from the schema.
    """
    global _registry, _load_error
    with _registry_lock:
        try:
            _registry = ModelRegistry.from_environment()
            _load_error = None
            logger.info(
                "Successfully reloaded ModelRegistry: type=%s, revision=%s",
                _registry.loaded.model_type,
                _registry.loaded.revision,
            )
            return {
                "status": "reloaded",
                "model": _registry.metadata(),
                "timestamp": datetime.now(UTC).isoformat(),
            }
        except Exception as exc:
            _load_error = f"{type(exc).__name__}: {exc}"
            logger.error("Failed to reload ModelRegistry: %s", exc)
            raise HTTPException(status_code=500, detail=f"Model reload failed: {exc}") from exc


@app.post(
    "/api/v1/classify",
    response_model=ClassificationResponse,
    tags=["Classification"],
    summary="Classify a transaction description",
    responses=ERROR_RESPONSES,
)
def classify(request: ClassificationRequest) -> dict:
    """Predict the spending category for a description and return the top `top_n` candidates."""
    return _service().classify(request.description, top_n=request.top_n)


@app.post(
    "/api/v1/analyze",
    response_model=AnalysisResponse,
    tags=["Classification"],
    summary="Classify and summarise a description",
    responses=ERROR_RESPONSES,
)
def analyze(request: ClassificationRequest) -> dict:
    """Same as `/api/v1/classify`, with an extra `analysis` block summarising the decision."""
    return _service().analyze(request.description, top_n=request.top_n)


@app.post(
    "/api/v1/merchants/match",
    response_model=MerchantMatchResponse,
    tags=["Merchants"],
    summary="Match text to known merchants",
    responses=ERROR_RESPONSES,
)
def match_merchant(request: MerchantMatchRequest) -> dict:
    """Return the closest canonical merchants for noisy statement text."""
    matches = _service().match_merchant(request.query, top_k=request.top_k)
    return {"query": request.query, "matches": matches}


@app.post(
    "/api/v1/duplicates/check",
    response_model=DuplicateCheckResponse,
    tags=["Duplicates"],
    summary="Find likely duplicate entries",
    responses=ERROR_RESPONSES,
)
def check_duplicates(request: DuplicateCheckRequest) -> dict:
    """Compare `query` with each candidate and return those at or above `threshold`."""
    matches = _service().check_duplicates(
        request.query, request.candidates, threshold=request.threshold, top_k=request.top_k
    )
    return {"query": request.query, "matches": matches}


@app.post(
    "/api/v1/anomalies/score",
    response_model=AnomalyScoreResponse,
    tags=["Anomalies"],
    summary="Score transactions for anomalies",
    responses=ERROR_RESPONSES,
)
def score_anomalies(request: AnomalyScoreRequest) -> dict:
    """Score each transaction with an Isolation Forest and report how many look anomalous."""
    results = _service().score_anomalies(request.transactions)
    anomalies_count = sum(1 for r in results if r.get("is_anomaly") is True)
    return {"results": results, "total_anomalies": anomalies_count}


@app.post(
    "/api/v1/forecast/spending",
    response_model=SpendingForecastResponse,
    tags=["Forecast"],
    summary="Forecast daily spending",
    responses={**ERROR_RESPONSES, 400: {"description": "History lacks a usable date or amount column."}},
)
def forecast_spending(request: SpendingForecastRequest) -> dict:
    """Project daily spending for the next `horizon_days` from at least 28 days of history."""
    try:
        forecast = _service().forecast_spending(request.history, horizon_days=request.horizon_days)
        return {"horizon_days": request.horizon_days, "forecast": forecast}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
