from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import json

import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from tqdm.auto import tqdm


@dataclass
class EvaluationResult:
    model_name: str
    accuracy: float
    macro_f1: float
    weighted_f1: float
    report: dict
    confusion_matrix: list[list[int]]
    samples: int


def evaluate_model(
    model,
    frame: pd.DataFrame,
    model_name: str,
    *,
    batch_size: int = 8192,
    progress: bool = True,
) -> EvaluationResult:
    if batch_size < 1:
        raise ValueError("batch_size must be >= 1")
    truth = frame["label"].tolist()
    predicted: list[str] = []
    iterator = range(0, len(frame), batch_size)
    for start in tqdm(iterator, total=(len(frame) + batch_size - 1) // batch_size, unit="batch", desc=f"Evaluating {model_name}", disable=not progress):
        predicted.extend(model.predict(frame["text"].iloc[start : start + batch_size].tolist()).labels)
    labels = sorted(set(truth) | set(predicted))
    return EvaluationResult(
        model_name=model_name,
        accuracy=float(accuracy_score(truth, predicted)),
        macro_f1=float(f1_score(truth, predicted, average="macro", zero_division=0)),
        weighted_f1=float(f1_score(truth, predicted, average="weighted", zero_division=0)),
        report=classification_report(truth, predicted, labels=labels, output_dict=True, zero_division=0),
        confusion_matrix=confusion_matrix(truth, predicted, labels=labels).tolist(),
        samples=len(frame),
    )


def save_result(result: EvaluationResult, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(asdict(result), indent=2), encoding="utf-8")


def compare_models(results: list[EvaluationResult]) -> dict:
    return {"models": [asdict(x) for x in results], "selection_metric": "macro_f1", "selected": max(results, key=lambda x: x.macro_f1).model_name if results else None}
