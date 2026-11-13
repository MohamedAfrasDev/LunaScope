"""The HTTP service end to end on the SYNTHETIC stack, with the real worker subprocess."""

import hashlib
import json
import time

import pytest
from fastapi.testclient import TestClient

from lunascope.main import create_app
from lunascope.stacks import ServiceConfig

BODY = {"mission": {"start_utc": "2027-01-10T00:00:00Z", "duration_s": 172800},
        "terrain": {"radius_km": 20, "az_step_deg": 1.0},
        "sites": [{"site_id": "rule-89.5S-E0"}, {"site_id": "rule-89.5S-E120"}]}
URL = "/api/v1/analyses"


def post(c, body=BODY):
    return c.post(URL, content=json.dumps(body))


def wait(c, run_id, timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = c.get(f"{URL}/{run_id}").json()
        if r["status"] in ("complete", "complete_with_warnings", "failed"):
            return r
        time.sleep(0.3)
    raise AssertionError("run did not finish")


@pytest.fixture(scope="module")
def svc(tmp_path_factory):
    cfg = ServiceConfig(data_dir=tmp_path_factory.mktemp("svc"), stack_kind="synthetic")
    with TestClient(create_app(cfg)) as c:
        first = post(c)
        yield c, first, wait(c, first.json()["run_id"])


def test_admission_returns_202_with_a_stable_run_id_and_no_work_is_repeated(svc):
    c, first, done = svc
    j = first.json()
    assert first.status_code == 202 and len(j["run_id"]) == 64 and j["attached"] is False
    again = post(c)
    assert again.status_code == 200 and again.json()["run_id"] == j["run_id"]
    assert again.json()["attached"] is True and again.json()["status"] == done["status"]
    assert c.app.state.store.get(j["run_id"])["current_attempt"] == 1  # one execution only


def test_status_has_the_matrix_and_is_labelled_synthetic_and_unverified(svc):
    _, _, done = svc
    assert done["status"] == "complete_with_warnings" and done["result_state"] == "synthetic_demonstration"
    assert done["verified"] is False and "DEMONSTRATION_DATA" in done["warnings"]
    assert [m["site_id"] for m in done["matrix"]] == ["rule-89.5S-E0", "rule-89.5S-E120"]
    sun = done["matrix"][0]["targets"]["sun_center"]
    assert set(sun) == {"terrain", "flat"} and sun["terrain"]["outcome"] in {"PASS", "FAIL", "INDETERMINATE", "EXCLUDED"}
    assert 0 <= sun["terrain"]["availability_lower"] <= sun["terrain"]["availability_upper"] <= 1
    assert "score" not in json.dumps(done) and "rank" not in json.dumps(done)


def test_results_are_summary_by_default_and_arrays_only_on_request(svc):
    c, first, _ = svc
    rid = first.json()["run_id"]
    r = c.get(f"{URL}/{rid}/results").json()
    sun = r["sites"][0]["target_metrics"]["sun_center"]["terrain"]
    assert "metrics" in sun and "intervals" not in sun and "events" not in sun
    assert r["sites"][0]["validity"] == "unverified" and r["result_state"] == "synthetic_demonstration"
    full = c.get(f"{URL}/{rid}/results", params={"site": "rule-89.5S-E120", "target": "sun_center",
                                                 "include": "intervals,events,series"}).json()
    assert len(full["sites"]) == 1 and list(full["sites"][0]["target_metrics"]) == ["sun_center"]
    t = full["sites"][0]["target_metrics"]["sun_center"]
    assert t["terrain"]["intervals"] and "events" in t["flat"] and len(t["series"]["az_deg"]) == 289
    assert c.get(f"{URL}/{rid}/results", params={"include": "bogus"}).status_code == 422
    assert c.get(f"{URL}/{rid}/results", params={"site": "nope"}).status_code == 404


def test_provenance_and_horizon_endpoints(svc):
    c, first, _ = svc
    rid = first.json()["run_id"]
    p = c.get(f"{URL}/{rid}/provenance").json()
    assert p["result_state"] == "synthetic_demonstration" and p["validated_scopes"] == []
    assert p["resources"] and p["sites"][0]["horizon"]["cache_key"] and "azimuth_deg" not in p["sites"][0]["horizon"]
    assert p["sites"][0]["geometry"]["sun_center"]["raw_sha256"]
    assert "series" not in p["sites"][0]["geometry"]["sun_center"]
    h = c.get(f"{URL}/{rid}/horizon/rule-89.5S-E0").json()
    assert len(h["azimuth_deg"]) == 360 and h["sectors"]["certified"] == 360
    assert c.get(f"{URL}/{rid}/horizon/missing").status_code == 404


def test_export_is_an_investigative_bundle_and_a_verified_one_is_refused(svc):
    c, first, _ = svc
    rid = first.json()["run_id"]
    r = c.get(f"{URL}/{rid}/export")
    assert r.status_code == 200 and r.headers["x-bundle-kind"] == "investigative"
    assert r.headers["x-content-sha256"] == hashlib.sha256(r.content).hexdigest()
    assert r.headers["x-result-state"] == "synthetic_demonstration"
    blocked = c.get(f"{URL}/{rid}/export", params={"verified": "true"})
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "EXPORT_BLOCKED_UNVERIFIED"


def test_errors_use_the_envelope_with_field_path_and_correlation_id(svc):
    c, _, _ = svc
    bad = json.loads(json.dumps(BODY))
    bad["terrain"]["az_step_deg"] = 0.7
    r = c.post(URL, content=json.dumps(bad), headers={"x-correlation-id": "abc123"})
    e = r.json()["error"]
    assert r.status_code == 422 and e["code"] == "INVALID_INPUT" and "az_step_deg" in e["field"]
    assert e["correlation_id"] == "abc123" and r.headers["x-correlation-id"] == "abc123"
    assert c.get(f"{URL}/{'0' * 64}").json()["error"]["code"] == "NOT_FOUND"
    assert c.get(f"{URL}/not-an-id").status_code == 404
    unknown = c.post(URL, content=json.dumps({**BODY, "sites": [{"site_id": "nowhere"}]}))
    assert unknown.status_code == 422 and unknown.json()["error"]["field"] == "sites.0.site_id"


def test_the_same_request_gives_the_same_run_id_in_a_different_deployment(svc, tmp_path):
    c, first, _ = svc
    with TestClient(create_app(ServiceConfig(data_dir=tmp_path, stack_kind="synthetic"))) as other:
        assert post(other).json()["run_id"] == first.json()["run_id"]
    changed = json.loads(json.dumps(BODY))
    changed["requirements"] = {"sun_min_availability": 0.7}
    assert post(c, changed).json()["run_id"] != first.json()["run_id"]


def test_sites_resources_and_custom_site_endpoints(svc):
    c, _, _ = svc
    s = c.get("/api/v1/sites").json()
    assert len(s["sites"]) == 3 and "NOT candidate" in s["note"] and s["sites"][0]["dem_coverage_150km"]["fully_covered"]
    res = c.get("/api/v1/resources").json()["resources"]
    ids = {r["resource_id"]: r for r in res}
    assert ids["dem-lola-80s-20mpp-adj"]["readiness"] == "integrity_verified"
    assert "scientifically_approved" not in {r["readiness"] for r in res}
    ok = c.post("/api/v1/sites/custom", content=json.dumps(
        {"lat_deg": -88.0, "lon_deg": 30.0, "lon_direction": "west_positive", "source": "typed", "precision_m": 50}))
    assert ok.status_code == 200 and ok.json()["lon_east_deg"] == pytest.approx(330.0)
    assert ok.json()["source_point_kept_separate"]["lon_deg"] == 30.0
    near_edge = c.post("/api/v1/sites/custom", content=json.dumps(
        {"lat_deg": -81.0, "lon_deg": 10.0, "source": "typed", "precision_m": 50})).json()
    assert near_edge["dem_coverage_150km"]["fully_covered"] is False
    assert c.post("/api/v1/sites/custom", content=json.dumps({"lat_deg": -10})).status_code == 422


def test_health_reports_limits_and_queue(svc):
    c, _, _ = svc
    h = c.get("/api/v1/health").json()
    assert h["limits"] == {"max_running": 2, "max_queued": 8, "run_timeout_s": 60.0}
    assert h["result_state"] == "synthetic_demonstration" and h["resources_ok"] is False


# ---- admission control and replay ----------------------------------------------------------------
class IdleRunner:
    """A runner that never executes anything, to hold runs in the queue."""

    reconciled: dict = {}  # noqa: RUF012

    def start(self): ...
    def stop(self): ...
    def notify(self): ...
    def running_ids(self): return []


def test_a_full_queue_returns_503_retry_after_but_existing_runs_still_attach(tmp_path):
    cfg = ServiceConfig(data_dir=tmp_path, stack_kind="synthetic", max_queued=2)
    with TestClient(create_app(cfg, runner=IdleRunner())) as c:
        bodies = []
        for i in range(2):
            b = json.loads(json.dumps(BODY))
            b["requirements"] = {"sun_min_availability": 0.1 * (i + 1)}
            bodies.append(b)
            assert post(c, b).status_code == 202
        extra = json.loads(json.dumps(BODY))
        extra["requirements"] = {"sun_min_availability": 0.9}
        r = post(c, extra)
        assert r.status_code == 503 and r.headers["retry-after"] == "10"
        assert r.json()["error"]["code"] == "QUEUE_FULL" and r.json()["error"]["retryable"] is True
        assert post(c, bodies[0]).status_code == 200  # attaching needs no capacity
        queued = post(c, bodies[0]).json()
        assert c.get(f"{URL}/{queued['run_id']}/results").status_code == 409  # NOT_READY while queued


def test_replay_mode_serves_known_runs_only(tmp_path, svc):
    live_cfg = ServiceConfig(data_dir=tmp_path, stack_kind="synthetic")
    with TestClient(create_app(live_cfg)) as c:
        rid = post(c).json()["run_id"]
        wait(c, rid)
    replay_cfg = ServiceConfig(data_dir=tmp_path, stack_kind="synthetic", mode="replay")
    with TestClient(create_app(replay_cfg)) as c:
        assert post(c).status_code == 200  # packaged, known
        other = json.loads(json.dumps(BODY))
        other["requirements"] = {"sun_min_availability": 0.2}
        r = post(c, other)
        assert r.status_code == 409 and r.json()["error"]["code"] == "REPLAY_ONLY"
        assert c.get(f"{URL}/{rid}/results").status_code == 200


def test_a_service_token_protects_everything_except_the_health_probe(tmp_path):
    cfg = ServiceConfig(data_dir=tmp_path, stack_kind="synthetic", api_token="s3cret-token")
    with TestClient(create_app(cfg, runner=IdleRunner())) as c:
        assert c.get("/api/v1/health").status_code == 200
        for bad in (None, "Bearer wrong", "s3cret-token", "Bearer s3cret-token-extra"):
            r = c.get("/api/v1/sites", headers={"authorization": bad} if bad else {})
            assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHORIZED"
            assert post(c).status_code == 401
        ok = c.get("/api/v1/sites", headers={"authorization": "Bearer s3cret-token"})
        assert ok.status_code == 200
        r = c.post(URL, content=json.dumps(BODY), headers={"authorization": "Bearer s3cret-token"})
        assert r.status_code == 202


def test_countdown_endpoint_is_server_decided_and_bounded(svc):
    c, first, _ = svc
    rid = first.json()["run_id"]
    res = c.get(f"{URL}/{rid}/results", params={"site": "rule-89.5S-E0", "target": "sun_center",
                                                "include": "events"}).json()
    ev = res["sites"][0]["target_metrics"]["sun_center"]["terrain"]["events"]
    cd = f"{URL}/{rid}/countdown"
    q = {"site": "rule-89.5S-E0", "target": "sun_center", "horizon": "terrain"}
    start = c.get(cd, params={**q, "t": 0}).json()
    assert start["kind"] == "set" and start["at"] == pytest.approx(ev[0]["t_s"])
    assert start["remaining_s"] == pytest.approx(ev[0]["t_s"]) and start["result_state"] == "synthetic_demonstration"
    mid = c.get(cd, params={**q, "t": ev[0]["t_s"] + 3600}).json()
    assert mid["kind"] == "rise" and mid["state"] == "H"  # hidden after the set
    last = c.get(cd, params={**q, "t": 172800}).json()
    assert last["kind"] == "mission_end" and "censored" in last["text"]
    assert c.get(cd, params={**q, "horizon": "flat", "t": 0}).json()["kind"] == "no_event"
    for bad in ({"t": -1}, {"t": 172801}, {"t": "nan"}, {"t": 0, "target": "moon"}, {"t": 0, "horizon": "x"}):
        r = c.get(cd, params={**q, **bad})
        assert r.status_code == 422, bad
    assert c.get(cd, params={**q, "site": "nope", "t": 0}).status_code == 404
