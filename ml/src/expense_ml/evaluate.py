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
    confidence_threshold: float
    confidence_coverage: float
    high_confidence_accuracy: float | None


def evaluate_model(
    model,
    frame: pd.DataFrame,
    model_name: str,
    *,
    batch_size: int = 8192,
    confidence_threshold: float = 0.70,
    progress: bool = True,
) -> EvaluationResult:
    if batch_size < 1:
        raise ValueError("batch_size must be >= 1")
    if not 0 <= confidence_threshold <= 1:
        raise ValueError("confidence_threshold must be between 0 and 1")
    if "text" not in frame or "label" not in frame:
        raise ValueError("evaluate_model requires text and label columns")

    truth = frame["label"].tolist()
    predicted: list[str] = []
    confidences: list[float] = []
    iterator = range(0, len(frame), batch_size)
    for start in tqdm(
        iterator,
        total=(len(frame) + batch_size - 1) // batch_size,
        unit="batch",
        desc=f"Evaluating {model_name}",
        disable=not progress,
    ):
        prediction = model.predict(frame["text"].iloc[start : start + batch_size].tolist())
        predicted.extend(prediction.labels)
        confidences.extend(float(value) for value in prediction.confidence)

    if len(predicted) != len(truth) or len(confidences) != len(truth):
        raise ValueError(
            f"Model '{model_name}' returned an invalid prediction count: "
            f"labels={len(predicted)}, confidence={len(confidences)}, expected={len(truth)}"
        )

    labels = sorted(set(truth) | set(predicted))
    high_conf_mask = [score >= confidence_threshold for score in confidences]
    high_confidence_accuracy = None
    if any(high_conf_mask):
        high_truth = [y for y, keep in zip(truth, high_conf_mask, strict=True) if keep]
        high_pred = [y for y, keep in zip(predicted, high_conf_mask, strict=True) if keep]
        high_confidence_accuracy = float(accuracy_score(high_truth, high_pred))

    return EvaluationResult(
        model_name=model_name,
        accuracy=float(accuracy_score(truth, predicted)) if truth else 0.0,
        macro_f1=float(f1_score(truth, predicted, average="macro", zero_division=0)) if truth else 0.0,
        weighted_f1=float(f1_score(truth, predicted, average="weighted", zero_division=0)) if truth else 0.0,
        report=classification_report(truth, predicted, labels=labels, output_dict=True, zero_division=0) if truth else {},
        confusion_matrix=confusion_matrix(truth, predicted, labels=labels).tolist() if truth else [],
        samples=len(frame),
        confidence_threshold=confidence_threshold,
        confidence_coverage=float(sum(high_conf_mask) / len(high_conf_mask)) if high_conf_mask else 0.0,
        high_confidence_accuracy=high_confidence_accuracy,
    )


def evaluate_by_country(
    model,
    frame: pd.DataFrame,
    model_name: str,
    *,
    minimum_samples: int = 100,
    batch_size: int = 8192,
    confidence_threshold: float = 0.70,
    progress: bool = True,
) -> dict[str, dict]:
    if "country" not in frame:
        return {}
    results: dict[str, dict] = {}
    for country, group in frame.groupby("country", dropna=False, sort=True):
        country_name = str(country)
        if len(group) < minimum_samples:
            continue
        result = evaluate_model(
            model,
            group,
            f"{model_name}-{country_name}",
            batch_size=batch_size,
            confidence_threshold=confidence_threshold,
            progress=progress,
        )
        results[country_name] = asdict(result)
    return results


def validate_quality(
    result: EvaluationResult,
    *,
    minimum_accuracy: float,
    minimum_macro_f1: float,
    minimum_confidence_coverage: float = 0.0,
    minimum_high_confidence_accuracy: float | None = None,
) -> None:
    failures = []
    if result.accuracy < minimum_accuracy:
        failures.append(f"accuracy={result.accuracy:.4f} < {minimum_accuracy:.4f}")
    if result.macro_f1 < minimum_macro_f1:
        failures.append(f"macro_f1={result.macro_f1:.4f} < {minimum_macro_f1:.4f}")
    if result.confidence_coverage < minimum_confidence_coverage:
        failures.append(
            f"confidence_coverage={result.confidence_coverage:.4f} < "
            f"{minimum_confidence_coverage:.4f}"
        )
    if minimum_high_confidence_accuracy is not None:
        if result.high_confidence_accuracy is None:
            failures.append("high_confidence_accuracy is unavailable because no predictions met the confidence threshold")
        elif result.high_confidence_accuracy < minimum_high_confidence_accuracy:
            failures.append(
                f"high_confidence_accuracy={result.high_confidence_accuracy:.4f} < "
                f"{minimum_high_confidence_accuracy:.4f}"
            )
    if failures:
        raise ValueError(f"Quality gate failed for {result.model_name}: " + "; ".join(failures))


def save_result(result: EvaluationResult, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(asdict(result), indent=2), encoding="utf-8")


def compare_models(results: list[EvaluationResult]) -> dict:
    if not results:
        return {"models": [], "selection_metric": "macro_f1", "selected": None}
    selected = max(results, key=lambda result: (result.macro_f1, result.accuracy, result.weighted_f1))
    return {
        "models": [asdict(result) for result in results],
        "selection_metric": "macro_f1",
        "selected": selected.model_name,
    }
