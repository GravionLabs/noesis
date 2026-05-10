from __future__ import annotations

from fastapi.testclient import TestClient

from noesis_embedder.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "provider" in body
    assert "model" in body


def test_health_default_provider_is_openai():
    response = client.get("/health")
    assert response.json()["provider"] == "openai"
