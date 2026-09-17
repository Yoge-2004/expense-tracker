from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..inference.model_registry import ModelRegistry
from ..inference.service import InferenceService


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


app = FastAPI(title="Expense Tracker ML API", version="0.2.0")
_registry: ModelRegistry | None = None
_load_error: str | None = None


def _service() -> InferenceService:
    global _registry, _load_error
    if _registry is None:
        try:
            _registry = ModelRegistry.from_environment()
            _load_error = None
        except Exception as exc:
            _load_error = f"{type(exc).__name__}: {exc}"
    if _registry is None:
        raise HTTPException(status_code=503, detail="ML model is unavailable")
    return InferenceService(_registry)


@app.get("/health")
def health() -> dict:
    try:
        service = _service()
    except HTTPException:
        return {"status": "degraded", "model_error": _load_error or "model not loaded"}
    return {"status": "ok", "model": service.registry.metadata()}


@app.post("/api/v1/classify", response_model=ClassificationResponse)
def classify(request: ClassificationRequest) -> dict:
    return _service().classify(request.description, top_n=request.top_n)


@app.post("/api/v1/analyze", response_model=AnalysisResponse)
def analyze(request: ClassificationRequest) -> dict:
    return _service().analyze(request.description, top_n=request.top_n)
