from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from scipy.sparse import hstack


@dataclass
class PredictionBatch:
    labels: list[str]
    confidence: list[float]
    top_k: list[list[tuple[str, float]]]


class TfidfCategoryModel:
    def __init__(self, word_vectorizer: TfidfVectorizer, char_vectorizer: TfidfVectorizer, classifier: LogisticRegression, labels: list[str]):
        self.word_vectorizer = word_vectorizer
        self.char_vectorizer = char_vectorizer
        self.classifier = classifier
        self.labels = labels

    @classmethod
    def fit(cls, texts, labels, seed: int = 42) -> "TfidfCategoryModel":
        word = TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=120_000, sublinear_tf=True)
        char = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=2, max_features=80_000, sublinear_tf=True)
        X = hstack([word.fit_transform(texts), char.fit_transform(texts)])
        classes = sorted(set(labels))
        clf = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=seed, n_jobs=-1)
        clf.fit(X, labels)
        return cls(word, char, clf, classes)

    def predict(self, texts, top_n: int = 3) -> PredictionBatch:
        X = hstack([self.word_vectorizer.transform(texts), self.char_vectorizer.transform(texts)])
        probs = self.classifier.predict_proba(X)
        order = np.argsort(-probs, axis=1)[:, :top_n]
        labels = [self.classifier.classes_[row[0]] for row in order]
        confidence = [float(probs[i, row[0]]) for i, row in enumerate(order)]
        top_k = [[(str(self.classifier.classes_[j]), float(probs[i, j])) for j in row] for i, row in enumerate(order)]
        return PredictionBatch(labels, confidence, top_k)

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path / "model.joblib")
        (path / "metadata.json").write_text(json.dumps({"model_type": "tfidf_logistic_regression", "labels": self.labels}, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "TfidfCategoryModel":
        return joblib.load(path / "model.joblib")
