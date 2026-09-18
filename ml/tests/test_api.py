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
