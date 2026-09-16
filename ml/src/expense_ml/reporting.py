from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import ConfusionMatrixDisplay


def _save(fig, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(path, dpi=220, bbox_inches="tight")
    plt.close(fig)


def save_classification_figures(result: Any, out_dir: Path, prefix: str) -> None:
    labels = list(result.report.keys())
    labels = [x for x in labels if x not in {"accuracy", "macro avg", "weighted avg"}]
    f1 = [result.report[x]["f1-score"] for x in labels]
    precision = [result.report[x]["precision"] for x in labels]
    recall = [result.report[x]["recall"] for x in labels]

    fig, ax = plt.subplots(figsize=(10, 6))
    x = np.arange(len(labels))
    width = 0.25
    ax.bar(x - width, precision, width, label="Precision")
    ax.bar(x, recall, width, label="Recall")
    ax.bar(x + width, f1, width, label="F1")
    ax.set_xticks(x, labels, rotation=40, ha="right")
    ax.set_ylim(0, 1)
    ax.set_title(f"{prefix} per-class metrics")
    ax.legend()
    _save(fig, out_dir / f"{prefix.lower()}_per_class_metrics.png")

    cm = np.asarray(result.confusion_matrix)
    fig, ax = plt.subplots(figsize=(10, 8))
    ConfusionMatrixDisplay(cm, display_labels=labels).plot(ax=ax, xticks_rotation=45, colorbar=False)
    ax.set_title(f"{prefix} confusion matrix")
    _save(fig, out_dir / f"{prefix.lower()}_confusion_matrix.png")


def save_dataset_figures(frame: pd.DataFrame, out_dir: Path) -> None:
    counts = frame["label"].value_counts().sort_values(ascending=True)
    fig, ax = plt.subplots(figsize=(10, 7))
    counts.plot.barh(ax=ax)
    ax.set_title("Training dataset class distribution")
    ax.set_xlabel("Rows")
    _save(fig, out_dir / "dataset_class_distribution.png")


def save_model_comparison(results: list[dict], out_dir: Path) -> None:
    if not results:
        return
    df = pd.DataFrame(results).set_index("model_name")
    cols = [c for c in ["accuracy", "macro_f1", "weighted_f1"] if c in df]
    fig, ax = plt.subplots(figsize=(9, 5))
    df[cols].plot.bar(ax=ax)
    ax.set_ylim(0, 1)
    ax.set_title("Model validation comparison")
    ax.set_ylabel("Score")
    ax.tick_params(axis="x", rotation=20)
    _save(fig, out_dir / "model_comparison.png")


def save_anomaly_figure(scores: np.ndarray, out_dir: Path) -> None:
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.hist(scores, bins=40)
    ax.set_title("Anomaly score distribution")
    ax.set_xlabel("Anomaly score")
    ax.set_ylabel("Transactions")
    _save(fig, out_dir / "anomaly_score_distribution.png")


def save_spending_forecast(actual: pd.Series, predicted: pd.Series, out_dir: Path) -> None:
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(actual.index, actual.values, label="Actual")
    ax.plot(predicted.index, predicted.values, label="Predicted")
    ax.set_title("Spending forecast: chronological holdout")
    ax.set_ylabel("Spend")
    ax.legend()
    _save(fig, out_dir / "spending_forecast.png")


def save_data_quality(frame: pd.DataFrame, out_dir: Path) -> dict:
    summary = {
        "rows": int(len(frame)),
        "columns": list(frame.columns),
        "missing_by_column": {c: int(frame[c].isna().sum()) for c in frame.columns},
        "duplicate_text_rows": int(frame["text"].duplicated().sum()) if "text" in frame else None,
    }
    if "text" in frame:
        lengths = frame["text"].astype(str).str.len()
        summary["text_length"] = {
            "mean": float(lengths.mean()),
            "median": float(lengths.median()),
            "p95": float(lengths.quantile(.95)),
            "max": int(lengths.max()),
        }
        fig, ax = plt.subplots(figsize=(9, 5))
        ax.hist(lengths.clip(upper=250), bins=40)
        ax.set_title("Transaction text length distribution")
        ax.set_xlabel("Characters")
        ax.set_ylabel("Transactions")
        _save(fig, out_dir / "text_length_distribution.png")
    return summary


def write_json(data: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def write_master_report(manifest: dict, report_dir: Path) -> None:
    report_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for name, meta in manifest["models"].items():
        status = meta.get("status", "unknown")
        reason = meta.get("reason", "")
        rows.append(f"| {name} | {status} | {meta.get('artifact', '')} | {reason} |")
    body = "\n".join([
        f"# Expense Tracker ML Training Report — {manifest['run_id']}",
        "",
        f"- Pipeline version: `{manifest['pipeline_version']}`",
        f"- Seed: `{manifest['seed']}`",
        f"- Python: `{manifest['python'].splitlines()[0]}`",
        "",
        "## Model Artifacts",
        "",
        "| Model | Status | Artifact | Notes |",
        "|---|---|---|---|",
        *rows,
        "",
        "## Outputs",
        "",
        "Machine-readable metrics are stored as JSON under `reports/`.",
        "High-resolution figures are stored under `reports/figures/` as PNG files.",
    ])
    (report_dir / "REPORT.md").write_text(body + "\n", encoding="utf-8")
