from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import json

import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score


@dataclass
class EvaluationResult:
    model_name: str
    accuracy: float
    macro_f1: float
    weighted_f1: float
    report: dict
    confusion_matrix: list[list[int]]
    samples: int


def evaluate_model(model, frame: pd.DataFrame, model_name: str) -> EvaluationResult:
    predictions = model.predict(frame["text"].tolist())
    truth = frame["label"].tolist()
    labels = sorted(set(truth) | set(predictions.labels))
    return EvaluationResult(model_name=model_name, accuracy=float(accuracy_score(truth, predictions.labels)), macro_f1=float(f1_score(truth, predictions.labels, average="macro", zero_division=0)), weighted_f1=float(f1_score(truth, predictions.labels, average="weighted", zero_division=0)), report=classification_report(truth, predictions.labels, labels=labels, output_dict=True, zero_division=0), confusion_matrix=confusion_matrix(truth, predictions.labels, labels=labels).tolist(), samples=len(frame))


def save_result(result: EvaluationResult, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(asdict(result), indent=2), encoding="utf-8")


def compare_models(results: list[EvaluationResult]) -> dict:
    return {"models": [asdict(x) for x in results], "selection_metric": "macro_f1", "selected": max(results, key=lambda x: x.macro_f1).model_name if results else None}
