from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json

import numpy as np


@dataclass
class PredictionBatch:
    labels: list[str]
    confidence: list[float]
    top_k: list[list[tuple[str, float]]]


class TransformerCategoryModel:
    def __init__(self, model, tokenizer, labels: list[str], max_length: int = 96):
        self.model = model
        self.tokenizer = tokenizer
        self.labels = labels
        self.max_length = max_length

    @classmethod
    def build(cls, model_name: str, labels: list[str], max_length: int = 96):
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        if len(labels) < 2:
            raise ValueError("TransformerCategoryModel.build requires at least two labels.")
        label2id = {label: i for i, label in enumerate(labels)}
        id2label = {i: label for label, i in label2id.items()}
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            num_labels=len(labels),
            label2id=label2id,
            id2label=id2label,
        )
        return cls(model, tokenizer, labels, max_length)

    def predict(self, texts, top_n: int = 3) -> PredictionBatch:
        import torch

        if top_n < 1:
            raise ValueError("top_n must be >= 1")
        values = list(texts)
        if not values:
            return PredictionBatch([], [], [])
        effective_top_n = min(top_n, len(self.labels))
        if effective_top_n < 1:
            raise ValueError("The model has no learned labels")

        self.model.eval()
        device = next(self.model.parameters()).device
        inputs = self.tokenizer(
            values,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        inputs = {key: value.to(device) for key, value in inputs.items()}
        with torch.inference_mode():
            probabilities = torch.softmax(self.model(**inputs).logits, dim=-1).cpu().numpy()
        if probabilities.shape[1] != len(self.labels):
            raise ValueError(
                f"Model output has {probabilities.shape[1]} classes but metadata contains "
                f"{len(self.labels)} labels."
            )
        order = np.argsort(-probabilities, axis=1)[:, :effective_top_n]
        labels = [self.labels[int(row[0])] for row in order]
        confidence = [float(probabilities[i, row[0]]) for i, row in enumerate(order)]
        top_k = [
            [(self.labels[int(j)], float(probabilities[i, j])) for j in row]
            for i, row in enumerate(order)
        ]
        return PredictionBatch(labels, confidence, top_k)

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        self.model.save_pretrained(path)
        self.tokenizer.save_pretrained(path)
        metadata = {
            "model_type": "transformer",
            "labels": self.labels,
            "max_length": self.max_length,
            "model_name": self.model.config.name_or_path,
        }
        (path / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: Path):
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        metadata = json.loads((path / "metadata.json").read_text(encoding="utf-8"))
        labels = metadata["labels"]
        if len(labels) < 2:
            raise ValueError("Saved transformer metadata must contain at least two labels.")
        model = AutoModelForSequenceClassification.from_pretrained(path)
        if getattr(model.config, "num_labels", len(labels)) != len(labels):
            raise ValueError("Saved transformer model label count does not match metadata.")
        return cls(
            model,
            AutoTokenizer.from_pretrained(path),
            labels,
            metadata["max_length"],
        )
