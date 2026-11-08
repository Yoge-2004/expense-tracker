import logging

from fastapi.testclient import TestClient

from expense_ml.api.logging_buffer import RingBufferLogHandler
from expense_ml.api.main import app

client = TestClient(app)


def test_health_contract():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] in {"ok", "degraded"}


def test_logs_endpoint_contract():
    response = client.get("/api/v1/logs?lines=50")
    assert response.status_code == 200
    logs = response.json()
    assert isinstance(logs, list)
    assert len(logs) > 0
    first = logs[0]
    assert "timestamp" in first
    assert "level" in first
    assert "logger" in first
    assert "message" in first


def test_logs_endpoint_filtering():
    response = client.get("/api/v1/logs?level=INFO&query=logging")
    assert response.status_code == 200
    logs = response.json()
    assert isinstance(logs, list)
    for entry in logs:
        assert entry["level"] in {"INFO", "WARN", "ERROR"}


def test_logs_tqdm_progress_collapsed_to_single_entry():
    handler = RingBufferLogHandler(capacity=50)
    logger = logging.getLogger("test_tqdm_logger")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

    # Emit multiple tqdm progress lines for the same training loop
    for i in range(1, 11):
        percent = i * 10
        logger.info(f"\rTraining: {percent}%|{'#' * i}{' ' * (10 - i)}| {i}/10 [00:0{i}<00:0{10 - i}, 10.0it/s]")

    # Verify that the ring buffer collapsed the 10 progress lines into a single entry
    logs = handler.get_logs(limit=50, query="Training")
    assert len(logs) == 1
    assert "100%|##########| 10/10" in logs[0]["message"]


def test_logs_secret_redaction():
    handler = RingBufferLogHandler(capacity=20)
    logger = logging.getLogger("test_secret_logger")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

    logger.info("Initializing Space sync with hf_1234567890abcdef1234567890 and token=super_secret_token_123")
    logs = handler.get_logs(limit=10)
    assert len(logs) == 1
    assert "hf_1234567890abcdef1234567890" not in logs[0]["message"]
    assert "hf_[REDACTED]" in logs[0]["message"]
    assert "super_secret_token_123" not in logs[0]["message"]
    assert "token=[REDACTED]" in logs[0]["message"]


def test_logs_level_severity_filtering():
    handler = RingBufferLogHandler(capacity=20)
    logger = logging.getLogger("test_levels_logger")
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    logger.debug("Debug event")
    logger.info("Info event")
    logger.warning("Warning event")
    logger.error("Error event")

    # WARN filter should return WARN and ERROR (severity >= 30)
    warn_logs = handler.get_logs(level="WARN")
    levels = [entry["level"] for entry in warn_logs]
    assert "DEBUG" not in levels
    assert "INFO" not in levels
    assert "WARN" in levels
    assert "ERROR" in levels

    # ERROR filter should return only ERROR
    error_logs = handler.get_logs(level="ERROR")
    levels = [entry["level"] for entry in error_logs]
    assert levels == ["ERROR"]


def test_duplicate_check_rejects_oversized_candidate_string():
    giant_string = "a" * 501
    response = client.post(
        "/api/v1/duplicates/check",
        json={
            "query": "Uber airport",
            "candidates": [giant_string],
        },
    )
    assert response.status_code == 422


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
