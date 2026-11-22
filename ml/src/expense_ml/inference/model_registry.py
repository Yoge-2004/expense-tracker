from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import dataclass
from pathlib import Path

from ..models.auxiliary import (
    DuplicateSimilarityModel,
    MerchantSimilarityIndex,
    SpendingForecastModel,
    TransactionAnomalyModel,
)
from ..models.tfidf import TfidfCategoryModel
from ..models.transformer import TransformerCategoryModel

logger = logging.getLogger(__name__)

DEFAULT_MODEL_ID = "Yoge-2004/expense-intelligence-model"
DEFAULT_MODEL_REVISION = "production"


@dataclass(frozen=True)
class LoadedModel:
    model: object
    model_type: str
    revision: str
    source: str
    path: Path | None = None


class ModelRegistry:
    """Resolve, load, and manage the full 5-model ML intelligence fleet."""

    def __init__(self, loaded: LoadedModel):
        self.loaded = loaded
        self._aux_lock = threading.Lock()
        self._merchant_index: MerchantSimilarityIndex | None = None
        self._duplicate_model: DuplicateSimilarityModel | None = None
        self._anomaly_model: TransactionAnomalyModel | None = None
        self._forecast_model: SpendingForecastModel | None = None

    @classmethod
    def from_environment(cls) -> ModelRegistry:
        model_id = os.getenv("MODEL_ID", "").strip() or DEFAULT_MODEL_ID
        model_revision = os.getenv("MODEL_REVISION", "").strip() or DEFAULT_MODEL_REVISION
        configured_type = os.getenv("MODEL_TYPE", "").strip().lower()

        path, resolved_revision, source = cls._resolve_path(model_id, model_revision)

        if configured_type in {"transformer", "tfidf"}:
            model_type = configured_type
        else:
            model_type = cls._detect_model_type(path)

        if model_type == "transformer":
            model = TransformerCategoryModel.load(path)
        else:
            model = TfidfCategoryModel.load(path)
            model_type = "tfidf"

        return cls(LoadedModel(model, model_type, resolved_revision, source, path=path))

    def _find_auxiliary_artifact(self, folder_name: str) -> Path | None:
        aux_env = os.getenv("AUXILIARY_MODEL_DIR", "").strip()
        candidates: list[Path] = []
        if aux_env:
            candidates.append(Path(aux_env) / folder_name / "model.joblib")
            candidates.append(Path(aux_env) / folder_name)
        if self.loaded.path:
            candidates.append(self.loaded.path / folder_name / "model.joblib")
            candidates.append(self.loaded.path.parent / folder_name / "model.joblib")
        candidates.extend([
            Path("models") / folder_name / "model.joblib",
            Path("ml/models") / folder_name / "model.joblib",
            Path(__file__).resolve().parents[3] / "models" / folder_name / "model.joblib",
            Path(__file__).resolve().parents[3] / "ml" / "models" / folder_name / "model.joblib",
        ])
        for candidate in candidates:
            if candidate.exists():
                return candidate
        return None

    def get_merchant_index(self) -> MerchantSimilarityIndex:
        if self._merchant_index is None:
            with self._aux_lock:
                if self._merchant_index is None:
                    path = self._find_auxiliary_artifact("merchant-similarity")
                    if path:
                        try:
                            self._merchant_index = MerchantSimilarityIndex.load(path)
                        except Exception as exc:  # noqa: BLE001
                            logger.warning("Failed to load merchant index from %s: %s", path, exc)
                    if self._merchant_index is None:
                        self._merchant_index = MerchantSimilarityIndex.fit(
                            ["amazon", "swiggy", "uber", "netflix", "walmart"]
                        )
        return self._merchant_index

    def get_duplicate_model(self) -> DuplicateSimilarityModel:
        if self._duplicate_model is None:
            with self._aux_lock:
                if self._duplicate_model is None:
                    path = self._find_auxiliary_artifact("duplicate-similarity")
                    if path:
                        try:
                            self._duplicate_model = DuplicateSimilarityModel.load(path)
                        except Exception as exc:  # noqa: BLE001
                            logger.warning("Failed to load duplicate model from %s: %s", path, exc)
                    if self._duplicate_model is None:
                        self._duplicate_model = DuplicateSimilarityModel.fit(
                            ["payment", "transfer", "purchase"]
                        )
        return self._duplicate_model

    def get_anomaly_model(self) -> TransactionAnomalyModel:
        if self._anomaly_model is None:
            with self._aux_lock:
                if self._anomaly_model is None:
                    path = self._find_auxiliary_artifact("transaction-anomaly")
                    if path:
                        try:
                            self._anomaly_model = TransactionAnomalyModel.load(path)
                        except Exception as exc:  # noqa: BLE001
                            logger.warning("Failed to load anomaly model from %s: %s", path, exc)
                    if self._anomaly_model is None:
                        self._anomaly_model = TransactionAnomalyModel.default_baseline()
        return self._anomaly_model

    def get_forecast_model(self) -> SpendingForecastModel:
        if self._forecast_model is None:
            with self._aux_lock:
                if self._forecast_model is None:
                    path = self._find_auxiliary_artifact("spending-forecast")
                    if path:
                        try:
                            self._forecast_model = SpendingForecastModel.load(path)
                        except Exception as exc:  # noqa: BLE001
                            logger.warning("Failed to load forecast model from %s: %s", path, exc)
                    if self._forecast_model is None:
                        self._forecast_model = SpendingForecastModel.default_baseline()
        return self._forecast_model

    def auxiliary_status(self) -> dict[str, dict[str, object]]:
        """Describe loaded auxiliary models without loading large artifacts as a side effect."""
        merchant = self._merchant_index
        duplicate = self._duplicate_model
        anomaly = self._anomaly_model
        forecast = self._forecast_model
        return {
            "merchant_similarity": {
                "status": "ready" if merchant is not None else "lazy",
                "indexed_count": len(merchant.merchants) if merchant is not None else None,
                "vocab_size": len(getattr(getattr(merchant, "vectorizer", None), "vocabulary_", {}))
                if merchant is not None else None,
            },
            "duplicate_similarity": {
                "status": "ready" if duplicate is not None else "lazy",
                "vocab_size": len(getattr(getattr(duplicate, "vectorizer", None), "vocabulary_", {}))
                if duplicate is not None else None,
            },
            "transaction_anomaly": {
                "status": "ready" if anomaly is not None else "lazy",
                "model_class": type(getattr(anomaly, "model", None)).__name__ if anomaly is not None else None,
                "features": list(getattr(anomaly, "feature_columns", [])) if anomaly is not None else [],
            },
            "spending_forecast": {
                "status": "ready" if forecast is not None else "lazy",
                "model_class": type(getattr(forecast, "model", None)).__name__ if forecast is not None else None,
                "features": list(getattr(forecast, "feature_columns", [])) if forecast is not None else [],
            },
        }

    @staticmethod
    def _detect_model_type(path: Path) -> str:
        metadata_file = path / "metadata.json"
        if metadata_file.exists():
            try:
                data = json.loads(metadata_file.read_text(encoding="utf-8"))
                m_type = str(data.get("model_type", "")).lower()
                if "tfidf" in m_type:
                    return "tfidf"
                if "transformer" in m_type:
                    return "transformer"
            except (json.JSONDecodeError, OSError) as exc:
                logger.debug("Failed to parse metadata.json in %s: %s", path, exc)
        if (path / "model.joblib").exists():
            return "tfidf"
        if (path / "config.json").exists() or (path / "model.safetensors").exists():
            return "transformer"
        return "tfidf"

    @staticmethod
    def _resolve_path(model_id: str, revision: str) -> tuple[Path, str, str]:
        local = Path(model_id)
        if local.exists():
            return local, "local", str(local)

        try:
            from huggingface_hub import snapshot_download
        except ImportError as exc:
            raise RuntimeError("huggingface-hub is required to load Hub-hosted models") from exc

        token = os.getenv("HF_TOKEN")
        try:
            local_path = snapshot_download(repo_id=model_id, revision=revision, token=token)
            return Path(local_path), revision, f"hf://{model_id}@{revision}"
        except Exception as primary_exc:
            if revision != "main":
                try:
                    local_path = snapshot_download(repo_id=model_id, revision="main", token=token)
                    return Path(local_path), "main", f"hf://{model_id}@main"
                except Exception as fallback_exc:  # noqa: BLE001
                    logger.debug("Fallback to main revision failed: %s", fallback_exc)
            raise RuntimeError(
                f"Unable to load model repository '{model_id}' at revision '{revision}'"
            ) from primary_exc

    def metadata(self) -> dict:
        model_metadata = getattr(self.loaded.model, "labels", None)
        auxiliary = self.auxiliary_status()
        return {
            "model_type": self.loaded.model_type,
            "revision": self.loaded.revision,
            "source": self.loaded.source,
            "labels": list(model_metadata or []),
            "fleet": {
                "category_classifier": {
                    "type": self.loaded.model_type,
                    "revision": self.loaded.revision,
                    "classes": len(list(model_metadata or [])),
                },
                "merchant_similarity": {
                    "status": auxiliary["merchant_similarity"]["status"],
                    "indexed_merchants": auxiliary["merchant_similarity"]["indexed_count"],
                },
                "duplicate_detector": {
                    "status": auxiliary["duplicate_similarity"]["status"],
                    "vocab_size": auxiliary["duplicate_similarity"]["vocab_size"],
                },
                "anomaly_detector": {
                    "status": auxiliary["transaction_anomaly"]["status"],
                    "model_class": auxiliary["transaction_anomaly"]["model_class"],
                    "features": auxiliary["transaction_anomaly"]["features"],
                },
                "spending_forecaster": {
                    "status": auxiliary["spending_forecast"]["status"],
                    "model_class": auxiliary["spending_forecast"]["model_class"],
                    "features": auxiliary["spending_forecast"]["features"],
                },
            },
        }
