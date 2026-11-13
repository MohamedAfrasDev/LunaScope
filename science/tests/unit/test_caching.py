"""Finished-run reads are cached by result_id; validation metadata is tagged separately (phase plan 2.3),
and the export carries a frozen validation snapshot (FR-13)."""

import hashlib
import json
import time

import pytest
from fastapi.testclient import TestClient

from lunascope.main import create_app
from lunascope.stacks import ServiceConfig

BODY = {"mission": {"start_utc": "2027-01-10T00:00:00Z", "duration_s": 86400},
        "terrain": {"radius_km": 20, "az_step_deg": 1.0}, "sites": [{"site_id": "rule-89.5S-E0"}]}
URL = "/api/v1/analyses"
SITE = "rule-89.5S-E0"


def finish(c, body=BODY):
    rid = c.post(URL, content=json.dumps(body)).json()["run_id"]
    t0 = time.time()
    while c.get(f"{URL}/{rid}").json()["status"] not in ("complete", "complete_with_warnings", "failed"):
        assert time.time() - t0 < 90
        time.sleep(0.3)
    return rid


@pytest.fixture(scope="module")
def svc(tmp_path_factory):
    with TestClient(create_app(ServiceConfig(data_dir=tmp_path_factory.mktemp("cache"), stack_kind="synthetic"))) as c:
        yield c, finish(c)


@pytest.mark.parametrize("path", ["results", "provenance", f"horizon/{SITE}",
                                  f"countdown?site={SITE}&target=sun_center&t=0"])
def test_finished_reads_are_immutable_and_tagged_by_result_id(svc, path):
    c, rid = svc
    r = c.get(f"{URL}/{rid}/{path}")
    result_id = c.get(f"{URL}/{rid}").json()["result_id"]
    assert r.status_code == 200 and r.headers["etag"] == f'"{result_id}"'
    assert "immutable" in r.headers["cache-control"]
    again = c.get(f"{URL}/{rid}/{path}", headers={"If-None-Match": r.headers["etag"]})
    assert again.status_code == 304 and again.content == b""
    assert c.get(f"{URL}/{rid}/{path}", headers={"If-None-Match": '"other"'}).status_code == 200


def test_status_errors_and_unfinished_runs_are_never_marked_cacheable(svc):
    c, rid = svc
    assert "etag" not in c.get(f"{URL}/{rid}").headers  # status can change while running
    missing = c.get(f"{URL}/{rid}/horizon/no-such-site")
    assert missing.status_code == 404 and "etag" not in missing.headers
    unknown = c.get(f"{URL}/{'0' * 64}/results")
    assert unknown.status_code == 404 and "etag" not in unknown.headers


def test_validation_has_its_own_tag_and_is_always_revalidated(svc):
    c, rid = svc
    v = c.get(f"{URL}/{rid}/validation")
    result_id = c.get(f"{URL}/{rid}").json()["result_id"]
    assert v.headers["etag"].startswith('"v-') and result_id not in v.headers["etag"]
    assert v.headers["cache-control"] == "private, no-cache"
    assert c.get(f"{URL}/{rid}/validation", headers={"If-None-Match": v.headers["etag"]}).status_code == 304


def test_export_is_deterministic_and_carries_a_frozen_validation_snapshot(svc):
    c, rid = svc
    a, b = c.get(f"{URL}/{rid}/export"), c.get(f"{URL}/{rid}/export")
    assert a.content == b.content and a.headers["x-content-sha256"] == hashlib.sha256(a.content).hexdigest()
    assert a.headers["etag"] == f'"{a.headers["x-content-sha256"]}"' and "attachment" in a.headers["content-disposition"]
    e = a.json()["export"]
    assert e["designation"] == "investigative" and e["schema"] == "lunascope.export/1"
    snap = e["validation_snapshot"]
    assert snap["cards"] == c.get(f"{URL}/{rid}/validation").json()["cards"] and snap["scopes_closed"] == []
    assert len(snap["cards_sha256"]) == 64 and "Frozen" in snap["note"]
    store = c.app.state.store
    assert e["analysis_artifact_sha256"] == store.get(rid)["analysis_artifact"]
    assert hashlib.sha256(store.get_artifact(e["analysis_artifact_sha256"])).hexdigest() == e["analysis_artifact_sha256"]


def test_parsed_analyses_are_kept_per_artifact_and_bounded(svc, monkeypatch):
    c, rid = svc
    store = c.app.state.store
    sha = store.get(rid)["analysis_artifact"]
    first = store.get_analysis(rid)
    assert store.get_analysis(rid) is first and sha in store.cached_artifacts()
    monkeypatch.setattr("lunascope.store.ANALYSIS_CACHE_SIZE", 1)
    other = json.loads(json.dumps(BODY))
    other["requirements"] = {"sun_min_availability": 0.3}
    store.get_analysis(finish(c, other))
    assert store.cached_artifacts() != [sha] and len(store.cached_artifacts()) == 1


def test_a_cache_hit_still_needs_the_service_token(tmp_path):
    cfg = ServiceConfig(data_dir=tmp_path, stack_kind="synthetic", api_token="s3cret")
    with TestClient(create_app(cfg)) as c:
        auth = {"Authorization": "Bearer s3cret"}
        rid = c.post(URL, content=json.dumps(BODY), headers=auth).json()["run_id"]
        t0 = time.time()
        while c.get(f"{URL}/{rid}", headers=auth).json()["status"] not in ("complete", "complete_with_warnings"):
            assert time.time() - t0 < 90
            time.sleep(0.3)
        tag = c.get(f"{URL}/{rid}/results", headers=auth).headers["etag"]
        assert c.get(f"{URL}/{rid}/results", headers={"If-None-Match": tag}).status_code == 401
