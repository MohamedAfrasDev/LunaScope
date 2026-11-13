from fastapi.testclient import TestClient

from lunascope.main import app


def test_health_reports_synthetic_and_unverified_resources():
    r = TestClient(app).get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["result_state"] == "synthetic_demonstration"
    assert body["resources_ok"] is False
