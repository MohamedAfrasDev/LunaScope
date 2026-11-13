"""Time Machine variants (FR-10, spec 8.4, test case 14) on the SYNTHETIC stack with the real worker.

Case 14: a five-day shift. Each run keeps its own UTC, events and countdown; the comparison states
its alignment mode, and a calendar comparison of non-overlapping windows is refused.
"""

import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from lunascope.main import create_app
from lunascope.stacks import ServiceConfig

FIVE_DAYS = 5 * 86400
BODY = {"mission": {"start_utc": "2027-01-10T00:00:00Z", "duration_s": 172800},
        "terrain": {"radius_km": 20, "az_step_deg": 1.0},
        "sites": [{"site_id": "rule-89.5S-E0"},
                  {"custom": {"lat_deg": -89.2, "lon_deg": 45.0, "source": "test point", "precision_m": 50}}]}
URL = "/api/v1/analyses"


def wait(c, run_id, timeout=90):
    import time
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = c.get(f"{URL}/{run_id}").json()
        if r["status"] in ("complete", "complete_with_warnings", "failed"):
            return r
        time.sleep(0.3)
    raise AssertionError("run did not finish")


def shift(c, run_id, offset_s, variant_type="date_shift"):
    return c.post(f"{URL}/{run_id}/variants",
                  content=json.dumps({"variant_type": variant_type, "changes": {"start_offset_s": offset_s}}))


@pytest.fixture(scope="module")
def tm(tmp_path_factory):
    cfg = ServiceConfig(data_dir=tmp_path_factory.mktemp("tm"), stack_kind="synthetic")
    with TestClient(create_app(cfg)) as c:
        base = c.post(URL, content=json.dumps(BODY)).json()["run_id"]
        wait(c, base)
        v = shift(c, base, FIVE_DAYS)
        child = v.json()["run_id"]
        wait(c, child)
        yield c, base, v, child


def test_a_date_shift_is_a_linked_run_that_changes_only_the_start(tm):
    c, base, v, child = tm
    j = v.json()
    assert v.status_code == 202 and j["attached"] is False and child != base
    assert j["parent_run_id"] == base and j["variant_type"] == "date_shift"
    assert j["changed_fields"] == ["mission.start_utc"]
    assert j["parent_start_utc"] == "2027-01-10T00:00:00Z" and j["start_utc"] == "2027-01-15T00:00:00Z"
    store = c.app.state.store
    parent_req = json.loads(store.get(base)["request_json"])
    child_req = json.loads(store.get(child)["request_json"])
    child_req["mission"]["start_utc"] = parent_req["mission"]["start_utc"]
    assert child_req == parent_req  # custom site included, copied verbatim


def test_the_same_shift_attaches_and_a_fresh_request_with_the_same_inputs_is_the_same_run(tm):
    c, base, _, child = tm
    again = shift(c, base, FIVE_DAYS)
    assert again.status_code == 200 and again.json()["run_id"] == child and again.json()["attached"] is True
    fresh = json.loads(json.dumps(BODY))
    fresh["mission"]["start_utc"] = "2027-01-15T00:00:00Z"
    r = c.post(URL, content=json.dumps(fresh))
    assert r.status_code == 200 and r.json()["run_id"] == child
    assert c.app.state.store.get(child)["current_attempt"] == 1  # computed once
    links = c.get(f"{URL}/{base}/variants").json()
    assert [x["child_run_id"] for x in links["children"]] == [child]  # one link, not three
    assert links["children"][0]["start_utc"] == "2027-01-15T00:00:00Z" and links["parents"] == []
    back = c.get(f"{URL}/{child}/variants").json()
    assert [x["parent_run_id"] for x in back["parents"]] == [base] and back["start_utc"] == "2027-01-15T00:00:00Z"


def test_case_14_each_panel_has_its_own_utc_events_and_countdown(tm):
    c, base, _, child = tm
    starts = {base: datetime(2027, 1, 10, tzinfo=UTC), child: datetime(2027, 1, 15, tzinfo=UTC)}
    for rid, start in starts.items():
        res = c.get(f"{URL}/{rid}/results", params={"site": "rule-89.5S-E0", "include": "intervals,events"}).json()
        terrain = res["sites"][0]["target_metrics"]["sun_center"]["terrain"]
        first = terrain["intervals"][0]
        assert first["start_s"] == 0 and first["start_utc"] == start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        last = terrain["intervals"][-1]
        assert last["end_utc"].startswith((start + timedelta(seconds=172800)).strftime("%Y-%m-%dT%H:%M"))
        for e in terrain["events"]:  # every event time is on this run's own clock
            t = datetime.fromisoformat(e["t_utc"])
            assert abs((t - start).total_seconds() - e["t_s"]) < 1e-3
        cd = c.get(f"{URL}/{rid}/countdown", params={"site": "rule-89.5S-E0", "target": "sun_center", "t": 0}).json()
        assert cd["run_id"] == rid and cd["t"] == 0
    # the synthetic tracks depend on elapsed time only, so elapsed alignment shows no change ...
    el = c.post("/api/v1/comparisons", content=json.dumps({"runs": [base, child], "alignment": "elapsed"})).json()
    assert el["shift_s"] == FIVE_DAYS and [x["field"] for x in el["changed"]] == ["mission.start_utc"]
    assert el["runs"]["a"]["start_utc"] != el["runs"]["b"]["start_utc"]
    for s in el["sites"]:
        assert s["targets"]["sun_center"]["delta"]["availability_lower"] == 0
    # ... and calendar alignment refuses windows that never overlap (2-day runs, 5 days apart)
    cal = c.post("/api/v1/comparisons", content=json.dumps({"runs": [base, child], "alignment": "calendar"}))
    assert cal.status_code == 422 and cal.json()["error"]["code"] == "INCOMPATIBLE_RUNS"


def test_a_backwards_shift_and_a_shift_of_the_variant_are_linked_too(tm):
    c, _, _, child = tm
    back = shift(c, child, -86400)
    assert back.status_code == 202 and back.json()["start_utc"] == "2027-01-14T00:00:00Z"
    assert back.json()["parent_run_id"] == child
    wait(c, back.json()["run_id"])
    cal = c.post("/api/v1/comparisons", content=json.dumps(
        {"runs": [child, back.json()["run_id"]], "alignment": "calendar"})).json()
    assert cal["overlap"]["duration_s"] == 86400 and cal["overlap"]["start_utc"] == "2027-01-15T00:00:00Z"


@pytest.mark.parametrize(("body", "field"), [
    ({"variant_type": "date_shift", "changes": {"start_offset_s": 0}}, "changes.start_offset_s"),
    ({"variant_type": "date_shift", "changes": {"start_offset_s": 90}}, "changes.start_offset_s"),
    ({"variant_type": "date_shift", "changes": {"start_offset_s": 31 * 86400}}, "changes.start_offset_s"),
    ({"variant_type": "date_shift", "changes": {"start_offset_s": 86400, "radius_km": 200}}, "changes.radius_km"),
    ({"variant_type": "sensitivity", "changes": {"start_offset_s": 86400}}, "variant_type"),
    ({"variant_type": "date_shift"}, "changes"),
])
def test_variant_input_errors_name_the_field(tm, body, field):
    c, base, _, _ = tm
    r = c.post(f"{URL}/{base}/variants", content=json.dumps(body))
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_INPUT"
    assert r.json()["error"]["field"] == field


def test_unknown_parent_is_404_and_a_shift_out_of_coverage_is_refused(tm):
    c, _, _, _ = tm
    assert shift(c, "0" * 64, 86400).status_code == 404
    assert c.get(f"{URL}/{'0' * 64}/variants").status_code == 404
    early = json.loads(json.dumps(BODY))
    early["mission"]["start_utc"] = "2020-01-02T00:00:00Z"
    rid = c.post(URL, content=json.dumps(early)).json()["run_id"]
    r = shift(c, rid, -2 * 86400)
    assert r.status_code == 422 and "outside" in r.json()["error"]["message"]


def test_replay_mode_serves_packaged_variants_only(tm):
    c, base, _, child = tm
    data_dir = c.app.state.cfg.data_dir
    with TestClient(create_app(ServiceConfig(data_dir=data_dir, stack_kind="synthetic", mode="replay"))) as r:
        ok = shift(r, base, FIVE_DAYS)
        assert ok.status_code == 200 and ok.json()["run_id"] == child
        miss = shift(r, base, 2 * 86400)
        assert miss.status_code == 409 and miss.json()["error"]["code"] == "REPLAY_ONLY"
