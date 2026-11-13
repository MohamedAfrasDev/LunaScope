from fastapi.testclient import TestClient

from lunascope.main import create_app
from lunascope.stacks import ServiceConfig


def test_health_reports_synthetic_and_unverified_resources(tmp_path):
    app = create_app(ServiceConfig(data_dir=tmp_path, stack_kind="synthetic"))
    with TestClient(app) as c:
        body = c.get("/api/v1/health").json()
    assert body["status"] == "ok"
    assert body["result_state"] == "synthetic_demonstration"
    assert isinstance(body["resources_ok"], bool) and body["resources_approved"] is False
