from fastapi.testclient import TestClient

from expense_ml.api.main import app

client = TestClient(app)


def test_health_contract():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] in {"ok", "degraded"}


def test_classify_rejects_empty_description():
    response = client.post("/api/v1/classify", json={"description": ""})
    assert response.status_code == 422


def test_classify_accepts_top_n_range_validation():
    response = client.post("/api/v1/classify", json={"description": "coffee", "top_n": 0})
    assert response.status_code == 422


def test_merchants_match_endpoint():
    response = client.post("/api/v1/merchants/match", json={"query": "swiggy delivery", "top_k": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "swiggy delivery"
    assert "matches" in data
    assert isinstance(data["matches"], list)


def test_duplicates_check_endpoint():
    response = client.post(
        "/api/v1/duplicates/check",
        json={
            "query": "Uber airport ride",
            "candidates": ["UBER TRIP AIRPORT", "Amazon purchase", "Starbucks coffee"],
            "threshold": 0.5,
            "top_k": 3,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["matches"]) >= 1
    assert data["matches"][0]["text"] == "UBER TRIP AIRPORT"


def test_anomalies_score_endpoint():
    response = client.post(
        "/api/v1/anomalies/score",
        json={
            "transactions": [
                {"amount": 15.0, "hour": 12, "day_of_week": 2, "balance": 2000.0},
                {"amount": 999999.0, "hour": 3, "day_of_week": 0, "balance": 10.0},
            ]
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 2
    assert "is_anomaly" in data["results"][0]
    assert "anomaly_score" in data["results"][0]


def test_forecast_spending_endpoint():
    import pandas as pd
    dates = pd.date_range("2026-01-01", periods=30, freq="D").strftime("%Y-%m-%d").tolist()
    history = [{"date": d, "amount": 50.0 + (i % 7) * 5.0} for i, d in enumerate(dates)]
    response = client.post(
        "/api/v1/forecast/spending",
        json={"history": history, "horizon_days": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["horizon_days"] == 5
    assert len(data["forecast"]) == 5
    assert "predicted_amount" in data["forecast"][0]
