"""Alternatives search (FR-11, spec 8.4): bounded batches, idempotent, a strip that never counts
unfinished or failed dates as pass or fail, and an objective that is stated, not hidden."""

import json
import time

import pytest
from fastapi.testclient import TestClient

from lunascope import alternatives
from lunascope.main import create_app
from lunascope.stacks import ServiceConfig

BODY = {"mission": {"start_utc": "2027-01-10T00:00:00Z", "duration_s": 86400},
        "terrain": {"radius_km": 20, "az_step_deg": 1.0}, "sites": [{"site_id": "rule-89.5S-E0"}]}
URL = "/api/v1/analyses"


def post(c, rid, changes, vt="alternatives_search"):
    return c.post(f"{URL}/{rid}/variants", content=json.dumps({"variant_type": vt, "changes": changes}))


def wait_run(c, rid, timeout=240):
    t0 = time.time()
    while True:
        s = c.get(f"{URL}/{rid}").json()
        if s["status"] in ("complete", "complete_with_warnings", "failed"):
            return s
        assert time.time() - t0 < timeout
        time.sleep(0.3)


def wait_strip(c, rid, sid, timeout=240):
    t0 = time.time()
    while True:
        strip = c.get(f"{URL}/{rid}/searches/{sid}").json()
        if strip["complete"]:
            return strip
        assert time.time() - t0 < timeout, strip["counts"]
        time.sleep(0.4)


@pytest.fixture(scope="module")
def svc(tmp_path_factory):
    with TestClient(create_app(ServiceConfig(data_dir=tmp_path_factory.mktemp("alt"), stack_kind="synthetic"))) as c:
        base = c.post(URL, content=json.dumps(BODY)).json()["run_id"]
        wait_run(c, base)
        yield c, base


def test_a_search_plans_every_date_up_front_and_returns_before_any_work_finishes(svc):
    c, base = svc
    r = post(c, base, {"from_days": -2, "to_days": 2})
    j = r.json()
    assert r.status_code == 202 and j["planned"] == 4 and j["attached"] is False  # -2, -1, +1, +2 (0 is the baseline)
    assert "not a score or a ranking" in j["objective"] and j["variant_type"] == "alternatives_search"
    strip = c.get(j["status_url"]).json()
    assert [d["offset_days"] for d in strip["dates"]] == [-2, -1, 0, 1, 2]
    assert strip["dates"][2]["state"] == "baseline" and strip["counts"]["planned"] == 5


def test_the_same_search_is_one_search_and_does_not_repeat_work(svc):
    c, base = svc
    first = post(c, base, {"from_days": -2, "to_days": 2}).json()
    again = post(c, base, {"from_days": -2, "to_days": 2})
    assert again.status_code == 200 and again.json()["search_id"] == first["search_id"]
    assert again.json()["attached"] is True
    other = post(c, base, {"from_days": -2, "to_days": 2, "step_days": 2}).json()  # -2, 0, +2: a different search
    assert other["search_id"] != first["search_id"]
    ids = [x["search_id"] for x in c.get(f"{URL}/{base}/searches").json()["searches"]]
    assert ids.count(first["search_id"]) == 1


def test_the_strip_fills_in_and_counts_only_finished_dates(svc):
    c, base = svc
    sid = post(c, base, {"from_days": -3, "to_days": 3}).json()["search_id"]
    strip = wait_strip(c, base, sid)
    n = strip["counts"]
    assert n["planned"] == 7 and n["tested"] == 7 and n["pending"] == 0 and n["failed_runs"] == 0
    assert n["passing"] + n["failing"] + n["unknown"] == n["tested"]
    for d in strip["dates"]:
        assert d["verdict"] in ("pass", "fail", "unknown") and d["sites"][0]["site_id"] == "rule-89.5S-E0"
    assert strip["dates"][0]["start_utc"] == "2027-01-07T00:00:00Z"
    assert strip["dates"][-1]["start_utc"] == "2027-01-13T00:00:00Z"
    assert strip["dates"][3]["state"] == "baseline" and strip["dates"][3]["run_id"] == base
    # each shifted date is an ordinary, linked run: the same one a manual date shift gives
    manual = post(c, base, {"start_offset_s": 3 * 86400}, "date_shift").json()
    assert manual["run_id"] == strip["dates"][-1]["run_id"] and manual["attached"] is True
    assert "rank" not in json.dumps({k: v for k, v in strip.items() if k != "objective"})


def test_at_most_a_batch_of_a_search_is_in_flight_at_once(svc, monkeypatch):
    c, base = svc
    store = c.app.state.store
    monkeypatch.setattr(alternatives, "BATCH", 2)
    seen = []
    orig = store.get_search

    def spy(search_id):
        s = orig(search_id)
        if s:
            seen.append(sum(1 for i in s["items"] if i["status"] in ("queued", "running")))
        return s
    monkeypatch.setattr(store, "get_search", spy)
    sid = post(c, base, {"from_days": 4, "to_days": 9}).json()["search_id"]  # six new dates
    wait_strip(c, base, sid)
    assert seen
    assert max(seen) <= 2, f"in flight peaked at {max(seen)}"


def test_a_full_queue_pauses_admission_instead_of_failing_the_search(tmp_path):
    cfg = ServiceConfig(data_dir=tmp_path, stack_kind="synthetic", max_queued=1, max_running=1)
    with TestClient(create_app(cfg)) as c:
        base = c.post(URL, content=json.dumps(BODY)).json()["run_id"]
        wait_run(c, base)
        sid = post(c, base, {"from_days": 1, "to_days": 5}).json()["search_id"]
        strip = wait_strip(c, base, sid, timeout=400)
        assert strip["counts"]["tested"] == 6 and strip["counts"]["failed_runs"] == 0


def test_a_failed_date_is_shown_as_failed_and_never_counted_as_a_pass_or_fail(svc):
    c, base = svc
    sid = post(c, base, {"from_days": 10, "to_days": 11}).json()["search_id"]
    strip = wait_strip(c, base, sid)
    child = strip["dates"][-1]["run_id"]
    with c.app.state.store._conn() as con:  # simulate a worker failure after the fact
        con.execute("UPDATE runs SET status='failed', error_code='TIMEOUT', error_detail='x' WHERE run_id=?", (child,))
    strip = c.get(f"{URL}/{base}/searches/{sid}").json()
    last = strip["dates"][-1]
    assert last["state"] == "failed" and last["verdict"] is None and last["error"]["code"] == "TIMEOUT"
    assert strip["counts"]["failed_runs"] == 1 and strip["counts"]["tested"] == 2  # the baseline and one date
    assert strip["counts"]["pending"] == 0 and strip["complete"] is True


@pytest.mark.parametrize(("changes", "field"), [
    ({"from_days": 3, "to_days": 1}, "changes"),
    ({"from_days": -30, "to_days": 30}, "changes"),  # 61 dates
    ({"from_days": 0, "to_days": 0}, "changes"),  # only the baseline
    ({"from_days": -31, "to_days": 1}, "changes.from_days"),
    ({"from_days": 1, "to_days": 2, "step_days": 0}, "changes.step_days"),
    ({"from_days": 1, "to_days": 2, "radius_km": 5}, "changes.radius_km"),
])
def test_search_input_errors_name_the_field(svc, changes, field):
    c, base = svc
    r = post(c, base, changes)
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_INPUT"
    assert r.json()["error"]["field"] == field


def test_the_largest_margin_is_per_site_among_passing_dates_only(svc):
    c, base = svc
    sid = post(c, base, {"from_days": 1, "to_days": 2}).json()["search_id"]
    strip = wait_strip(c, base, sid)
    best = strip["largest_margin_among_passing"]["rule-89.5S-E0"]
    passing = [d["offset_s"] for d in strip["dates"] if d["verdict"] == "pass"]
    assert (best in passing) if passing else (best is None)  # no passing date: nothing is named


def test_unknown_searches_and_other_runs_searches_are_404(svc):
    c, base = svc
    assert c.get(f"{URL}/{base}/searches/{'0' * 32}").status_code == 404
    assert c.get(f"{URL}/{base}/searches/not-hex").status_code == 404
    assert post(c, "0" * 64, {"from_days": 1, "to_days": 2}).status_code == 404


def test_replay_mode_serves_packaged_searches_and_refuses_new_ones(svc):
    c, base = svc
    sid = post(c, base, {"from_days": 1, "to_days": 2}).json()["search_id"]
    wait_strip(c, base, sid)
    data_dir = c.app.state.cfg.data_dir
    with TestClient(create_app(ServiceConfig(data_dir=data_dir, stack_kind="synthetic", mode="replay"))) as r:
        ok = post(r, base, {"from_days": 1, "to_days": 2})
        assert ok.status_code == 200 and ok.json()["search_id"] == sid
        assert r.get(ok.json()["status_url"]).json()["complete"]
        new = post(r, base, {"from_days": 20, "to_days": 22})
        assert new.status_code == 409 and new.json()["error"]["code"] == "REPLAY_ONLY"
