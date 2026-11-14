"""Reference-run readiness (test case 13), the convergence report and the freeze rule."""


import copy
import json
from datetime import UTC, datetime

import pytest

from lunascope.pipeline import RunConfig, SiteSpec
from lunascope.reference import (
    REFERENCE_DIR,
    FreezeViolation,
    apply_convergence,
    check_freeze,
    convergence_report,
    definition_request,
    definition_run_id,
    load_definition,
    readiness,
)
from lunascope.stacks import ServiceConfig, build_stack

SITE = SiteSpec("rule-89.5S-E0", -89.5, 0.0, "test")
CFG = RunConfig(start_utc=datetime(2027, 1, 10, tzinfo=UTC), duration_s=2 * 86400, radius_km=20.0,
                az_step_deg=1.0, holdout_s=3600)


@pytest.fixture(scope="module")
def run(tmp_path_factory):
    from lunascope.pipeline import run_site
    hdir = tmp_path_factory.mktemp("horizons")
    stack, _ = build_stack(ServiceConfig(data_dir=hdir, stack_kind="synthetic"), "lola-80s-20m-adj")
    stack = stack.replace(horizon_dir=hdir)
    return run_site(SITE, CFG, stack), stack, hdir


def statuses(rep):
    return {c["check"]: c["status"] for c in rep["checks"]}


def ridge_bins(bundle):
    """Skyline bins the synthetic Sun track crosses (azimuth 70 -> 110 deg over two days)."""
    return [i for i, a in enumerate(bundle["horizon"]["azimuth_deg"]) if 85 <= a <= 95]


def test_an_untouched_result_is_ready_including_the_precomputed_skyline(run):
    bundle, _, hdir = run
    rep = readiness(bundle, horizon_dir=hdir)
    assert rep["ready"], rep["failing"]
    s = statuses(rep)
    assert s["horizon_digest"] == s["horizon_store"] == s["geometry_series"] == "pass"
    assert {k for k in s if k.startswith("rederived_")} == {
        f"rederived_{t}_{h}" for t in ("sun_center", "earth_center") for h in ("terrain", "flat")}
    assert "not a validation" in rep["note"]


def test_case_13_corrupted_horizon_with_correct_geometry_fails_readiness(run):
    bundle, _, hdir = run
    bad = copy.deepcopy(bundle)
    for i in ridge_bins(bad):
        bad["horizon"]["horizon_el_deg"][i] -= 10.0  # the ridge disappears; geometry is untouched
    rep = readiness(bad, horizon_dir=hdir)
    s = statuses(rep)
    assert rep["ready"] is False
    assert s["horizon_digest"] == "fail" and s["horizon_store"] == "fail"
    assert s["rederived_sun_center_terrain"] == "fail"
    assert s["geometry_series"] == "pass" and s["rederived_sun_center_flat"] == "pass"


def test_re_derivation_catches_the_corruption_even_without_a_digest_or_precomputed_file(run):
    bundle, _, _ = run
    bad = copy.deepcopy(bundle)
    del bad["horizon"]["payload_sha256"]
    for i in ridge_bins(bad):
        bad["horizon"]["horizon_el_deg"][i] -= 10.0
    s = statuses(readiness(bad))
    assert s["horizon_digest"] == "not_recorded" and s["rederived_sun_center_terrain"] == "fail"


def test_a_bin_off_the_track_is_still_caught_by_the_digest_and_the_store(run):
    bundle, _, hdir = run
    bad = copy.deepcopy(bundle)
    i = next(i for i, a in enumerate(bad["horizon"]["azimuth_deg"]) if a == 300.0)
    bad["horizon"]["horizon_el_deg"][i] += 0.5
    s = statuses(readiness(bad, horizon_dir=hdir))
    assert s["rederived_sun_center_terrain"] == "pass"  # the result itself does not change ...
    assert s["horizon_digest"] == "fail" and s["horizon_store"] == "fail"  # ... but the skyline did


def test_summary_and_geometry_damage_are_named(run):
    bundle, _, _ = run
    bad = copy.deepcopy(bundle)
    bad["horizon"]["sector_state"][0] = "unsupported"
    assert statuses(readiness(bad, rederive=False))["horizon_summary"] == "fail"
    short = copy.deepcopy(bundle)
    short["geometry"]["earth_center"]["series"]["el_deg"].pop()
    s = statuses(readiness(short))
    assert s["geometry_series"] == "fail" and not any(k.startswith("rederived_") for k in s)


def test_a_missing_precomputed_skyline_is_not_ready(run, tmp_path):
    bundle, _, _ = run
    rep = readiness(bundle, horizon_dir=tmp_path)
    assert rep["ready"] is False and statuses(rep)["horizon_store"] == "fail"


def test_readiness_accepts_a_whole_analysis(run):
    bundle, _, _ = run
    rep = readiness({"sites": [bundle, bundle]}, rederive=False)
    assert rep["ready"] and len(rep["checks"]) == 2 * 3


# ----------------------------------------------------------------------------- convergence
def test_convergence_report_compares_one_change_at_a_time_and_skips_the_base_value(run):
    bundle, stack, _ = run
    cases = (("azimuth_1deg", {"az_step_deg": 1.0}), ("azimuth_0.5deg", {"az_step_deg": 0.5}),
             ("step_300s", {"step_s": 300}))
    rep = convergence_report(SITE, CFG, stack, base=bundle, cases=cases)
    assert [r["case"] for r in rep["cases"]] == ["azimuth_0.5deg", "step_300s"]
    assert rep["skipped"] == [{"case": "azimuth_1deg", "reason": "equals the base setting"}]
    assert rep["not_applicable"][0]["case"] == "dem_near_field_on_off"
    assert rep["base_run_id"] == bundle["run_id"]
    for r in rep["cases"]:
        assert r["variant_run_id"] != bundle["run_id"] and set(r["targets"]) == {"sun_center", "earth_center"}


def test_an_unstable_case_is_marked_sensitivity_high(run):
    bundle, stack, _ = run
    rep = convergence_report(SITE, CFG, stack, base=bundle, cases=(("radius_1km", {"radius_km": 1.0}),))
    assert rep["sensitivity_high"] == ["radius_1km"] and rep["converged"] is False  # the 5 km ridge is cut off
    out = apply_convergence(copy.deepcopy(bundle), rep)
    assert "SENSITIVITY_HIGH" in out["warnings"] and out["convergence"] is rep


# ----------------------------------------------------------------------------- freeze rule
def test_gr001_is_frozen_with_a_pinned_live_run_id_and_says_its_sites_are_not_candidates():
    d = load_definition("GR-001")
    assert d["status"] == "frozen" and len(d["frozen"]["run_id"]) == 64 and d["frozen"]["stack"] == "live"
    assert "NOT candidate landing sites" in d["sites_status"] and "GR-002" in d["frozen"]["decision"]
    req = definition_request(d)
    assert len(req.sites) == 3 and req.options.sensitivity is True
    assert set(d["selection_reasons"]) >= {"mission.start_utc", "requirements", "terrain", "sites"}
    with pytest.raises(ValueError):
        load_definition("../catalog")


def test_the_committed_gr001_pin_still_matches_its_inputs_on_the_live_stack(tmp_path):
    """The freeze guard: if the request, settings, DEM or kernel identity or algorithm version changes, this
    fails and the answer is to create GR-002. Needs no data files: identity comes from the manifests."""
    cfg = ServiceConfig(data_dir=tmp_path, stack_kind="live")
    d = load_definition("GR-001")
    assert check_freeze(d, cfg) == {"reference_id": "GR-001", "frozen": True, "run_id": d["frozen"]["run_id"]}


def test_a_frozen_reference_fails_loudly_when_a_scientific_input_changes(tmp_path):
    cfg = ServiceConfig(data_dir=tmp_path, stack_kind="synthetic")
    d = json.loads((REFERENCE_DIR / "GR-001.json").read_text(encoding="utf-8"))
    d["frozen"] = None  # compute the unfrozen identity on this (synthetic) stack, then freeze at that
    draft = check_freeze(d, cfg)
    assert draft["frozen"] is False and len(draft["run_id"]) == 64
    d["frozen"] = {"run_id": draft["run_id"], "frozen_utc": "2026-11-14T00:00:00Z"}
    assert check_freeze(d, cfg) == {"reference_id": "GR-001", "frozen": True, "run_id": draft["run_id"]}
    d["request"]["terrain"]["radius_km"] = 200.0  # a horizon parameter changes
    with pytest.raises(FreezeViolation, match="create GR-002"):
        check_freeze(d, cfg)


def test_the_reference_endpoint_serves_the_exact_request_home_submits(tmp_path):
    from fastapi.testclient import TestClient

    from lunascope.main import create_app
    with TestClient(create_app(ServiceConfig(data_dir=tmp_path, stack_kind="synthetic"))) as c:
        r = c.get("/api/v1/references/GR-001")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "frozen" and body["frozen"]["run_id"] == load_definition("GR-001")["frozen"]["run_id"]
        assert "NOT candidate landing sites" in body["sites_status"]
        assert body["request"] == load_definition("GR-001")["request"]
        adm = c.post("/api/v1/analyses", content=json.dumps(body["request"]))
        assert adm.status_code == 202
        assert adm.json()["run_id"] == definition_run_id(load_definition("GR-001"), c.app.state.cfg)  # this stack, not the pinned live id
        for bad in ("GR-1", "../x", "GR-999"):
            assert c.get(f"/api/v1/references/{bad}").status_code == 404


# ----------------------------------------------------------------------------- Gate 2: five named checks
def _passing_bundle(run, monkeypatch):
    """A synthetic bundle made to satisfy every gate: a SPICE reference record added, and a small real
    convergence report attached (the cases are shrunk so the test stays quick)."""
    from lunascope import reference as ref
    bundle, stack, _ = run
    cases = (("azimuth_0.5deg", {"az_step_deg": 0.5}), ("step_300s", {"step_s": 300}))
    monkeypatch.setattr(ref, "CONVERGENCE_CASES", cases)
    b = copy.deepcopy(bundle)
    for g in b["geometry"].values():
        g["reference_agreement"] = {"within_tolerance": True, "max_total_arcsec": 0.0017, "tolerance_arcsec": 0.01, "n": 289}
    return apply_convergence(b, convergence_report(SITE, CFG, stack, base=bundle, cases=cases))


def _by(rep):
    return {g["gate"]: g for g in rep["gates"]}


def test_gate_2_passes_only_when_all_five_checks_pass(run, monkeypatch):
    from lunascope.reference import gate_report
    _, _, hdir = run
    rep = gate_report([_passing_bundle(run, monkeypatch)], horizon_dir=hdir)
    assert rep["passes"] is True and rep["failing"] == []
    assert [g["gate"] for g in rep["gates"]] == ["geometry", "horizon", "aggregation", "event_search", "convergence"]
    assert all(g["status"] == "pass" for g in rep["gates"])
    assert "not a validation" in rep["note"]


def test_a_run_that_was_not_checked_is_not_evaluated_and_never_passes_by_default(run):
    from lunascope.reference import gate_report
    bundle, _, hdir = run  # no SPICE record and no convergence report
    g = _by(gate_report([bundle], horizon_dir=hdir))
    assert g["geometry"]["status"] == "not_evaluated" and g["convergence"]["status"] == "not_evaluated"
    assert g["horizon"]["status"] == g["aggregation"]["status"] == g["event_search"]["status"] == "pass"
    assert gate_report([bundle], horizon_dir=hdir)["passes"] is False


def test_each_gate_can_fail(run, monkeypatch):
    from lunascope.reference import gate_report
    _, _, hdir = run
    good = _passing_bundle(run, monkeypatch)

    geo = copy.deepcopy(good)
    geo["geometry"]["sun_center"]["reference_agreement"].update(within_tolerance=False, max_total_arcsec=0.5)
    assert _by(gate_report([geo], horizon_dir=hdir))["geometry"]["status"] == "fail"

    hol = copy.deepcopy(good)
    hol["geometry"]["earth_center"]["holdout"]["max_deg"] = 1.0  # interpolation error above its allowance
    assert _by(gate_report([hol], horizon_dir=hdir))["geometry"]["status"] == "fail"

    hz = copy.deepcopy(good)
    for i in ridge_bins(hz):
        hz["horizon"]["horizon_el_deg"][i] -= 10.0  # case 13: a corrupted skyline
    rep = _by(gate_report([hz], horizon_dir=hdir))
    assert rep["horizon"]["status"] == "fail" and rep["aggregation"]["status"] == "fail"

    sec = copy.deepcopy(good)
    sec["horizon"]["sectors"] = {"certified": 300, "coverage_limited": 60, "unsupported": 0}
    assert _by(gate_report([sec], horizon_dir=hdir))["horizon"]["status"] == "fail"

    agg = copy.deepcopy(good)
    ivs = agg["targets"]["sun_center"]["terrain"]["intervals"]
    ivs[0]["end_s"] -= 100.0  # a hole in the timeline
    assert "gap or overlap" in " ".join(_by(gate_report([agg], horizon_dir=hdir))["aggregation"]["failing"])

    met = copy.deepcopy(good)
    met["targets"]["earth_center"]["terrain"]["metrics"]["availability_upper"] += 0.05
    assert _by(gate_report([met], horizon_dir=hdir))["aggregation"]["status"] == "fail"

    ev = copy.deepcopy(good)
    ev["targets"]["sun_center"]["terrain"]["intervals"][0]["class"] = "X"  # the search could not certify it
    assert _by(gate_report([ev], horizon_dir=hdir))["event_search"]["status"] == "fail"

    br = copy.deepcopy(good)
    events = br["targets"]["sun_center"]["terrain"]["events"]
    assert events, "the synthetic ridge must produce events for this check to mean anything"
    events[0]["solver_bracket_s"] = 30.0  # wider than the 1 s root tolerance
    assert "wider than" in " ".join(_by(gate_report([br], horizon_dir=hdir))["event_search"]["failing"])

    conv = copy.deepcopy(good)
    conv["convergence"]["cases"][0]["sensitivity_high"] = True
    assert "is SENSITIVITY_HIGH" in " ".join(_by(gate_report([conv], horizon_dir=hdir))["convergence"]["failing"])

    gone = copy.deepcopy(good)
    gone["convergence"]["cases"] = gone["convergence"]["cases"][:1]
    gone["convergence"]["skipped"] = []
    assert "is missing" in " ".join(_by(gate_report([gone], horizon_dir=hdir))["convergence"]["failing"])


def test_the_gate_command_exits_nonzero_unless_every_check_passes(run, tmp_path, monkeypatch, capsys):
    import importlib.util
    import sys
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("reference_run", Path(__file__).resolve().parents[2] / "scripts" / "reference_run.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["reference_run"] = mod
    spec.loader.exec_module(mod)
    bundle, _, _ = run
    (tmp_path / "a.json").write_text(json.dumps(bundle))
    assert mod.cmd_gate(str(tmp_path)) == 1  # not evaluated: no SPICE record, no convergence report
    out = capsys.readouterr().out
    assert "NOT_EVALUATED" in out and "GATE 2 CHECKS DO NOT PASS" in out
