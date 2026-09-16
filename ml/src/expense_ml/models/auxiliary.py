from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler


def _merchant_key(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r"\b(?:upi|imps|neft|rtgs|txn|ref|rrn)\b", " ", text)
    text = re.sub(r"\d+", " ", text)
    text = re.sub(r"[^a-z0-9& ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class MerchantMatch:
    merchant: str
    score: float


class MerchantSimilarityIndex:
    def __init__(self, vectorizer: TfidfVectorizer, index: NearestNeighbors, merchants: list[str]):
        self.vectorizer = vectorizer
        self.index = index
        self.merchants = merchants

    @classmethod
    def fit(cls, texts: list[str]) -> "MerchantSimilarityIndex":
        merchants = sorted({_merchant_key(x) for x in texts if _merchant_key(x)})
        if not merchants:
            raise ValueError("No merchant-like text was available for indexing.")
        vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=1, sublinear_tf=True)
        matrix = vectorizer.fit_transform(merchants)
        index = NearestNeighbors(metric="cosine", n_neighbors=min(5, len(merchants))).fit(matrix)
        return cls(vectorizer, index, merchants)

    def match(self, text: str, top_k: int = 5) -> list[MerchantMatch]:
        q = self.vectorizer.transform([_merchant_key(text)])
        distances, positions = self.index.kneighbors(q, n_neighbors=min(top_k, len(self.merchants)))
        return [MerchantMatch(self.merchants[p], float(1.0 - d)) for d, p in zip(distances[0], positions[0])]

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path / "model.joblib")


class DuplicateSimilarityModel:
    def __init__(self, vectorizer: TfidfVectorizer, matrix):
        self.vectorizer = vectorizer
        self.matrix = matrix

    @classmethod
    def fit(cls, texts: list[str]) -> "DuplicateSimilarityModel":
        vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1, sublinear_tf=True)
        matrix = vectorizer.fit_transform(texts)
        return cls(vectorizer, matrix)

    def duplicate_pairs(self, threshold: float = 0.92, max_pairs: int = 50_000) -> list[tuple[int, int, float]]:
        nn = NearestNeighbors(metric="cosine", radius=1.0 - threshold, n_jobs=-1).fit(self.matrix)
        graph = nn.radius_neighbors_graph(self.matrix, mode="distance")
        rows, cols = graph.nonzero()
        pairs = []
        for i, j in zip(rows, cols):
            if i < j:
                pairs.append((int(i), int(j), float(1.0 - graph[i, j])))
                if len(pairs) >= max_pairs:
                    break
        return pairs

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path / "model.joblib")


class TransactionAnomalyModel:
    def __init__(self, model: IsolationForest, feature_columns: list[str], scaler: StandardScaler):
        self.model = model
        self.feature_columns = feature_columns
        self.scaler = scaler

    @classmethod
    def fit(cls, frame: pd.DataFrame, seed: int = 42) -> tuple["TransactionAnomalyModel", pd.DataFrame]:
        numeric = frame.copy()
        feature_columns = []
        for candidate in ("amount", "balance", "hour", "day_of_week"):
            if candidate in numeric.columns:
                numeric[candidate] = pd.to_numeric(numeric[candidate], errors="coerce")
                if numeric[candidate].notna().any():
                    feature_columns.append(candidate)
        if "amount" not in feature_columns:
            raise ValueError("Anomaly detection requires a numeric amount column.")
        features = numeric[feature_columns].replace([np.inf, -np.inf], np.nan).fillna(0.0)
        scaler = StandardScaler().fit(features)
        X = scaler.transform(features)
        model = IsolationForest(n_estimators=300, contamination="auto", random_state=seed, n_jobs=-1).fit(X)
        output = frame.copy()
        output["anomaly_score"] = model.decision_function(X)
        output["is_anomaly"] = model.predict(X).astype(int) == -1
        return cls(model, feature_columns, scaler), output

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path / "model.joblib")


@dataclass
class ForecastResult:
    mae: float
    rmse: float
    r2: float
    actual: pd.Series
    predicted: pd.Series


class SpendingForecastModel:
    def __init__(self, model: HistGradientBoostingRegressor, feature_columns: list[str]):
        self.model = model
        self.feature_columns = feature_columns

    @staticmethod
    def _daily_frame(frame: pd.DataFrame) -> pd.DataFrame:
        date_col = next((c for c in ("date", "transaction_date", "timestamp", "datetime") if c in frame.columns), None)
        amount_col = next((c for c in ("amount", "value", "transaction_amount") if c in frame.columns), None)
        if not date_col or not amount_col:
            raise ValueError("Spending forecast requires date/timestamp and amount columns.")
        dates = pd.to_datetime(frame[date_col], errors="coerce")
        amounts = pd.to_numeric(frame[amount_col], errors="coerce")
        daily = pd.DataFrame({"date": dates.dt.floor("D"), "amount": amounts}).dropna()
        return daily.groupby("date", as_index=True)["amount"].sum().sort_index().to_frame()

    @classmethod
    def fit(cls, frame: pd.DataFrame, seed: int = 42, holdout_days: int = 28):
        daily = cls._daily_frame(frame)
        if len(daily) < holdout_days + 35:
            raise ValueError("Spending forecast needs at least 63 daily observations.")
        work = daily.copy()
        work["dow"] = work.index.dayofweek
        work["day"] = work.index.day
        work["month"] = work.index.month
        work["lag_1"] = work["amount"].shift(1)
        work["lag_7"] = work["amount"].shift(7)
        work["lag_28"] = work["amount"].shift(28)
        work["roll_7"] = work["amount"].shift(1).rolling(7).mean()
        work["roll_28"] = work["amount"].shift(1).rolling(28).mean()
        work = work.dropna()
        features = ["dow", "day", "month", "lag_1", "lag_7", "lag_28", "roll_7", "roll_28"]
        split_at = len(work) - holdout_days
        train, test = work.iloc[:split_at], work.iloc[split_at:]
        model = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, random_state=seed)
        model.fit(train[features], train["amount"])
        pred = pd.Series(model.predict(test[features]), index=test.index, name="predicted")
        actual = test["amount"].rename("actual")
        return cls(model, features), ForecastResult(
            mae=float(mean_absolute_error(actual, pred)),
            rmse=float(mean_squared_error(actual, pred) ** 0.5),
            r2=float(r2_score(actual, pred)),
            actual=actual,
            predicted=pred,
        )

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path / "model.joblib")
