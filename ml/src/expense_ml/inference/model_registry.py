from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os

from ..models.tfidf import TfidfCategoryModel
from ..models.transformer import TransformerCategoryModel


@dataclass(frozen=True)
class LoadedModel:
    model: object
    model_type: str
    revision: str
    source: str


class ModelRegistry:
    """Resolve and load one explicitly configured production model revision."""

    def __init__(self, loaded: LoadedModel):
        self.loaded = loaded

    @classmethod
    def from_environment(cls) -> "ModelRegistry":
        model_id = os.getenv("MODEL_ID", "").strip()
        model_revision = os.getenv("MODEL_REVISION", "main").strip() or "main"
        model_type = os.getenv("MODEL_TYPE", "transformer").strip().lower()
        if not model_id:
            raise RuntimeError("MODEL_ID must identify an explicit local path or Hugging Face model repository")
        if model_type not in {"transformer", "tfidf"}:
            raise RuntimeError("MODEL_TYPE must be 'transformer' or 'tfidf'")

        path, source = cls._resolve_path(model_id, model_revision)
        if model_type == "transformer":
            model = TransformerCategoryModel.load(path)
        else:
            model = TfidfCategoryModel.load(path)
        return cls(LoadedModel(model, model_type, model_revision, source))

    @staticmethod
    def _resolve_path(model_id: str, revision: str) -> tuple[Path, str]:
        local = Path(model_id)
        if local.exists():
            return local, str(local)

        try:
            from huggingface_hub import snapshot_download
        except ImportError as exc:
            raise RuntimeError("huggingface-hub is required to load Hub-hosted models") from exc

        try:
            local_path = snapshot_download(repo_id=model_id, revision=revision)
        except Exception as exc:
            raise RuntimeError(
                f"Unable to load model repository '{model_id}' at revision '{revision}'"
            ) from exc
        return Path(local_path), f"hf://{model_id}@{revision}"

    def metadata(self) -> dict:
        model_metadata = getattr(self.loaded.model, "labels", None)
        return {
            "model_type": self.loaded.model_type,
            "revision": self.loaded.revision,
            "source": self.loaded.source,
            "labels": list(model_metadata or []),
        }
