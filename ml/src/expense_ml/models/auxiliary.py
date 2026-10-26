from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Any

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
    def fit(cls, texts: list[str], max_merchants: int = 100_000) -> "MerchantSimilarityIndex":
        merchants = sorted({_merchant_key(x) for x in texts if _merchant_key(x)})
        if len(merchants) > max_merchants:
            rng = np.random.default_rng(42)
            merchants = sorted(rng.choice(merchants, size=max_merchants, replace=False).tolist())
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

    @classmethod
    def load(cls, path: Path) -> "MerchantSimilarityIndex":
        target = path / "model.joblib" if path.is_dir() else path
        return joblib.load(target)


class DuplicateSimilarityModel:
    def __init__(self, vectorizer: TfidfVectorizer, matrix):
        self.vectorizer = vectorizer
        self.matrix = matrix

    @classmethod
    def fit(cls, texts: list[str], max_rows: int = 200_000) -> "DuplicateSimilarityModel":
        if len(texts) > max_rows:
            rng = np.random.default_rng(42)
            texts = rng.choice(np.asarray(texts, dtype=object), size=max_rows, replace=False).tolist()
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

    def find_similar(
        self, query: str, candidates: list[str], threshold: float = 0.85, top_k: int = 5
    ) -> list[dict[str, str | float | int]]:
        if not candidates or not query or not str(query).strip():
            return []
        from sklearn.metrics.pairwise import cosine_similarity

        q_vec = self.vectorizer.transform([str(query).strip()])
        cand_mat = self.vectorizer.transform([str(c) for c in candidates])
        scores = cosine_similarity(q_vec, cand_mat)[0]
        results = []
        for idx, score in enumerate(scores):
            if float(score) >= threshold:
                results.append(
                    {
                        "text": candidates[idx],
                        "similarity": round(float(score), 4),
                        "index": idx,
                    }
                )
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:top_k]

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path / "model.joblib")

    @classmethod
    def load(cls, path: Path) -> "DuplicateSimilarityModel":
        target = path / "model.joblib" if path.is_dir() else path
        return joblib.load(target)


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

    def score(self, frame: pd.DataFrame) -> pd.DataFrame:
        numeric = frame.copy()
        for col in self.feature_columns:
            if col not in numeric.columns:
                numeric[col] = 0.0
            else:
                numeric[col] = pd.to_numeric(numeric[col], errors="coerce").fillna(0.0)
        features = numeric[self.feature_columns].replace([np.inf, -np.inf], np.nan).fillna(0.0)
        X = self.scaler.transform(features)
        output = frame.copy()
        output["anomaly_score"] = [round(float(s), 4) for s in self.model.decision_function(X)]
        output["is_anomaly"] = [bool(a) for a in (self.model.predict(X).astype(int) == -1)]
        return output

    def score_transactions(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not records:
            return []
        frame = pd.DataFrame(records)
        scored = self.score(frame)
        return scored.to_dict(orient="records")

    @classmethod
    def default_baseline(cls, seed: int = 42) -> "TransactionAnomalyModel":
        rng = np.random.default_rng(seed)
        n = 1000
        amounts = rng.exponential(scale=50.0, size=n) + rng.uniform(5.0, 500.0, size=n)
        hours = rng.integers(0, 24, size=n)
        dows = rng.integers(0, 7, size=n)
        balances = rng.uniform(500.0, 10000.0, size=n)
        synth = pd.DataFrame({
            "amount": amounts,
            "hour": hours,
            "day_of_week": dows,
            "balance": balances,
        })
        model, _ = cls.fit(synth, seed=seed)
        return model

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path / "model.joblib")

    @classmethod
    def load(cls, path: Path) -> "TransactionAnomalyModel":
        target = path / "model.joblib" if path.is_dir() else path
        return joblib.load(target)


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

    def forecast(self, frame: pd.DataFrame | list[dict[str, Any]], horizon_days: int = 7) -> list[dict[str, str | float]]:
        if isinstance(frame, list):
            frame = pd.DataFrame(frame)
        daily = self._daily_frame(frame)
        if len(daily) < 28:
            raise ValueError(f"Need at least 28 days of daily spending history to forecast (received {len(daily)}).")
        work = daily.copy()
        forecasts = []
        last_date = pd.to_datetime(work.index.max())
        for i in range(1, horizon_days + 1):
            next_date = last_date + pd.DateOffset(days=int(i))
            amounts = work["amount"]
            lag_1 = float(amounts.iloc[-1])
            lag_7 = float(amounts.iloc[-7]) if len(amounts) >= 7 else lag_1
            lag_28 = float(amounts.iloc[-28]) if len(amounts) >= 28 else lag_7
            roll_7 = float(amounts.iloc[-7:].mean())
            roll_28 = float(amounts.iloc[-28:].mean())
            row = pd.DataFrame([{
                "dow": next_date.dayofweek,
                "day": next_date.day,
                "month": next_date.month,
                "lag_1": lag_1,
                "lag_7": lag_7,
                "lag_28": lag_28,
                "roll_7": roll_7,
                "roll_28": roll_28,
            }])[self.feature_columns]
            pred_amount = max(0.0, float(self.model.predict(row)[0]))
            forecasts.append({
                "date": next_date.strftime("%Y-%m-%d"),
                "predicted_amount": round(pred_amount, 2),
            })
            work.loc[next_date] = pred_amount
        return forecasts

    @classmethod
    def default_baseline(cls, seed: int = 42) -> "SpendingForecastModel":
        rng = np.random.default_rng(seed)
        dates = pd.date_range("2026-01-01", periods=90, freq="D")
        amounts = 30.0 + 10.0 * np.sin(np.arange(90) * 2 * np.pi / 7) + rng.normal(0, 5.0, 90)
        synth = pd.DataFrame({"date": dates, "amount": np.maximum(5.0, amounts)})
        model, _ = cls.fit(synth, seed=seed, holdout_days=14)
        return model

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path / "model.joblib")

    @classmethod
    def load(cls, path: Path) -> "SpendingForecastModel":
        target = path / "model.joblib" if path.is_dir() else path
        return joblib.load(target)
