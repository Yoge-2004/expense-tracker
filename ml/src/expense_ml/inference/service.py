from __future__ import annotations

from dataclasses import asdict

from .model_registry import ModelRegistry


class InferenceService:
    def __init__(self, registry: ModelRegistry):
        self.registry = registry

    def classify(self, description: str, top_n: int = 3) -> dict:
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
