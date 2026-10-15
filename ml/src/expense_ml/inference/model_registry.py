from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import os

from ..models.tfidf import TfidfCategoryModel
from ..models.transformer import TransformerCategoryModel


DEFAULT_MODEL_ID = "Yoge-2004/expense-intelligence-model"
DEFAULT_MODEL_REVISION = "production"


@dataclass(frozen=True)
class LoadedModel:
    model: object
    model_type: str
    revision: str
    source: str


class ModelRegistry:
    """Resolve and load one explicitly configured or default production model revision."""

    def __init__(self, loaded: LoadedModel):
        self.loaded = loaded

    @classmethod
    def from_environment(cls) -> "ModelRegistry":
        model_id = os.getenv("MODEL_ID", "").strip() or DEFAULT_MODEL_ID
        model_revision = os.getenv("MODEL_REVISION", "").strip() or DEFAULT_MODEL_REVISION
        configured_type = os.getenv("MODEL_TYPE", "").strip().lower()

        path, source = cls._resolve_path(model_id, model_revision)

        if configured_type in {"transformer", "tfidf"}:
            model_type = configured_type
        else:
            model_type = cls._detect_model_type(path)

        if model_type == "transformer":
            model = TransformerCategoryModel.load(path)
        else:
            model = TfidfCategoryModel.load(path)
            model_type = "tfidf"

        return cls(LoadedModel(model, model_type, model_revision, source))

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
            except Exception:
                pass
        if (path / "model.joblib").exists():
            return "tfidf"
        if (path / "config.json").exists() or (path / "model.safetensors").exists():
            return "transformer"
        return "tfidf"

    @staticmethod
    def _resolve_path(model_id: str, revision: str) -> tuple[Path, str]:
        local = Path(model_id)
        if local.exists():
            return local, str(local)

        try:
            from huggingface_hub import snapshot_download
        except ImportError as exc:
            raise RuntimeError("huggingface-hub is required to load Hub-hosted models") from exc

        token = os.getenv("HF_TOKEN")
        try:
            local_path = snapshot_download(repo_id=model_id, revision=revision, token=token)
            return Path(local_path), f"hf://{model_id}@{revision}"
        except Exception as primary_exc:
            if revision != "main":
                try:
                    local_path = snapshot_download(repo_id=model_id, revision="main", token=token)
                    return Path(local_path), f"hf://{model_id}@main"
                except Exception:
                    pass
            raise RuntimeError(
                f"Unable to load model repository '{model_id}' at revision '{revision}'"
            ) from primary_exc

    def metadata(self) -> dict:
        model_metadata = getattr(self.loaded.model, "labels", None)
        return {
            "model_type": self.loaded.model_type,
            "revision": self.loaded.revision,
            "source": self.loaded.source,
            "labels": list(model_metadata or []),
        }
