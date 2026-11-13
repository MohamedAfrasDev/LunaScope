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
def test_gr001_definition_is_a_valid_request_and_says_its_sites_are_placeholders():
    d = load_definition("GR-001")
    assert d["status"] == "draft" and d["frozen"] is None and "PLACEHOLDER" in d["sites_status"]
    req = definition_request(d)
    assert len(req.sites) == 3 and req.options.sensitivity is True
    assert set(d["selection_reasons"]) >= {"mission.start_utc", "requirements", "terrain"}
    with pytest.raises(ValueError):
        load_definition("../catalog")


def test_a_frozen_reference_fails_loudly_when_a_scientific_input_changes(tmp_path):
    cfg = ServiceConfig(data_dir=tmp_path, stack_kind="synthetic")
    d = json.loads((REFERENCE_DIR / "GR-001.json").read_text(encoding="utf-8"))
    draft = check_freeze(d, cfg)
    assert draft["frozen"] is False and len(draft["run_id"]) == 64
    d["frozen"] = {"run_id": draft["run_id"], "frozen_utc": "2026-11-14T00:00:00Z"}
    assert check_freeze(d, cfg) == {"reference_id": "GR-001", "frozen": True, "run_id": draft["run_id"]}
    d["request"]["terrain"]["radius_km"] = 200.0  # a horizon parameter changes
    with pytest.raises(FreezeViolation, match="create GR-002"):
        check_freeze(d, cfg)
