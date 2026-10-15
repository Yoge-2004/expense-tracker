from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
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
    ax.bar(x + width, f1, width, label="F1-score")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=40, ha="right", fontsize=9)
    ax.set_ylim(0, 1.05)
    ax.set_title(f"{result.model_name} Per-Class Performance")
    ax.legend()
    _save(fig, out_dir / f"{prefix}_classification_metrics.png")

    fig, ax = plt.subplots(figsize=(11, 9))
    disp = ConfusionMatrixDisplay(confusion_matrix=np.array(result.confusion_matrix), display_labels=labels)
    disp.plot(ax=ax, cmap="Blues", xticks_rotation=45, colorbar=False)
    ax.set_title(f"{result.model_name} Confusion Matrix")
    _save(fig, out_dir / f"{prefix}_confusion_matrix.png")


def save_dataset_figures(frame: pd.DataFrame, out_dir: Path) -> None:
    counts = frame["label"].value_counts()
    fig, ax = plt.subplots(figsize=(10, 5))
    counts.plot(kind="bar", ax=ax, color="#1f77b4")
    ax.set_title("Dataset Label Distribution")
    ax.set_xlabel("Label")
    ax.set_ylabel("Count")
    ax.tick_params(axis="x", rotation=40)
    _save(fig, out_dir / "dataset_label_distribution.png")

    if "country" in frame.columns:
        counts = frame["country"].value_counts().head(10)
        fig, ax = plt.subplots(figsize=(8, 4))
        counts.plot(kind="bar", ax=ax, color="#2ca02c")
        ax.set_title("Dataset Country Distribution (Top 10)")
        ax.set_xlabel("Country")
        ax.set_ylabel("Count")
        ax.tick_params(axis="x", rotation=30)
        _save(fig, out_dir / "dataset_country_distribution.png")


def save_model_comparison(results: list[Any], out_dir: Path) -> None:
    names = [r.model_name for r in results]
    acc = [r.accuracy for r in results]
    macro_f1 = [r.macro_f1 for r in results]
    weighted_f1 = [r.weighted_f1 for r in results]

    x = np.arange(len(names))
    width = 0.25
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(x - width, acc, width, label="Accuracy")
    ax.bar(x, macro_f1, width, label="Macro F1")
    ax.bar(x + width, weighted_f1, width, label="Weighted F1")
    ax.set_xticks(x)
    ax.set_xticklabels(names)
    ax.set_ylim(0, 1.05)
    ax.set_title("Model Comparison")
    ax.legend()
    _save(fig, out_dir / "model_comparison.png")


def write_json(data: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
