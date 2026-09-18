from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json

import joblib
import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression


@dataclass
class PredictionBatch:
    labels: list[str]
    confidence: list[float]
    top_k: list[list[tuple[str, float]]]


class TfidfCategoryModel:
    def __init__(
        self,
        word_vectorizer: TfidfVectorizer,
        char_vectorizer: TfidfVectorizer,
        classifier: LogisticRegression,
        labels: list[str],
    ):
        self.word_vectorizer = word_vectorizer
        self.char_vectorizer = char_vectorizer
        self.classifier = classifier
        self.labels = labels

    @classmethod
    def fit(cls, texts, labels, seed: int = 42) -> "TfidfCategoryModel":
        word = TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=2,
            max_features=120_000,
            sublinear_tf=True,
        )
        char = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(3, 5),
            min_df=2,
            max_features=80_000,
            sublinear_tf=True,
        )
        X = hstack([word.fit_transform(texts), char.fit_transform(texts)], format="csr")
        classes = sorted(set(labels))
        if len(classes) < 2:
            raise ValueError("TfidfCategoryModel.fit requires at least two distinct labels.")
        clf = LogisticRegression(
            solver="saga",
            max_iter=100,
            tol=1e-3,
            class_weight="balanced",
            random_state=seed,
        )
        clf.fit(X, labels)
        return cls(word, char, clf, classes)

    def predict(self, texts, top_n: int = 3) -> PredictionBatch:
        if top_n < 1:
            raise ValueError("top_n must be >= 1")
        values = list(texts)
        if not values:
            return PredictionBatch([], [], [])
        effective_top_n = min(top_n, len(self.labels))
        if effective_top_n < 1:
            raise ValueError("The model has no learned labels")
        X = hstack(
            [
                self.word_vectorizer.transform(values),
                self.char_vectorizer.transform(values),
            ],
            format="csr",
        )
        probs = self.classifier.predict_proba(X)
        order = np.argsort(-probs, axis=1)[:, :effective_top_n]
        labels = [str(self.classifier.classes_[row[0]]) for row in order]
        confidence = [float(probs[i, row[0]]) for i, row in enumerate(order)]
        top_k = [
            [(str(self.classifier.classes_[j]), float(probs[i, j])) for j in row]
            for i, row in enumerate(order)
        ]
        return PredictionBatch(labels, confidence, top_k)

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path / "model.joblib")
        metadata = {
            "model_type": "tfidf_logistic_regression",
            "labels": self.labels,
            "word_features": "word 1-2 grams, max_features=120000",
            "character_features": "char_wb 3-5 grams, max_features=80000",
            "solver": "saga",
        }
        (path / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "TfidfCategoryModel":
        return joblib.load(path / "model.joblib")
