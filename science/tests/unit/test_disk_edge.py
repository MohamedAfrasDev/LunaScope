"""Disk-edge sensitivity (S-2, OQ-06): the centre-only assumption, bracketed by the upper limb and the
whole disc. Expected values are hand-derived, not taken from the code under test."""

import json
import time
from datetime import UTC, datetime

import numpy as np
import pytest
from fastapi.testclient import TestClient

from lunascope.clearance import TerrainClearanceModel
from lunascope.disk_edge import EARTH_RADIUS_DEG, SUN_RADIUS_DEG, disk_edge_sensitivity
from lunascope.events import Settings, build_partition
from lunascope.main import create_app
from lunascope.metrics import summarize
from lunascope.pipeline import RunConfig, SiteSpec, run_site
from lunascope.providers.geometry.interpolate import DirectionSpline
from lunascope.stacks import ServiceConfig, build_stack

DAY = 86400.0
STEP = 600.0
SET = Settings(eps=0.01, tau=1.0, w_min=5.0, max_evals=200, delta=1e-6)


def spline(el_start, el_end, duration=DAY):
    t = np.arange(0.0, duration + STEP, STEP)
    el = el_start + (el_end - el_start) * t / duration
    return DirectionSpline(t, np.full_like(t, 100.0), el)


def centre_of(sp, theta, duration=DAY):
    part = build_partition(TerrainClearanceModel(sp, None, margin_deg=0.0), 0.0, duration, STEP, SET)
    return summarize(part.intervals, 0.0, duration, theta).to_dict()


def run(el_start, el_end, *, target="earth_center", theta=0.5, base_margin=0.0):
    sp = spline(el_start, el_end)
    out = disk_edge_sensitivity({target: sp}, None, base_margin_deg=base_margin, settings={target: SET},
                                duration_s=DAY, step_s=STEP, thresholds={target: theta},
                                centre={target: centre_of(sp, theta)})
    return out, out["targets"][target]


def test_rise_times_of_the_three_readings_match_the_hand_derivation():
    """el(t) = -3 + 6 t / 86400. Centre rises at el = 0; the upper limb at el = -r; the whole disc at el = +r."""
    _, b = run(-3.0, 3.0)
    r = EARTH_RADIUS_DEG
    expect = {"upper_limb": (3.0 - r) / 6.0 * DAY, "centre": 0.5 * DAY, "whole_disk": (3.0 + r) / 6.0 * DAY}
    got_up, got_whole = b["upper_limb"]["event_times_s"], b["whole_disk"]["event_times_s"]
    assert len(got_up) == len(got_whole) == 1
    assert got_up[0] == pytest.approx(expect["upper_limb"], abs=5.0)
    assert got_whole[0] == pytest.approx(expect["whole_disk"], abs=5.0)
    # and the ordering that makes them bounds: upper limb < centre < whole disc
    assert got_up[0] < expect["centre"] < got_whole[0]
    assert b["upper_limb"]["availability_lower"] > b["centre"]["availability_lower"] > b["whole_disk"]["availability_lower"]


def test_margins_are_the_base_margin_moved_by_the_angular_radius():
    _, b = run(1.0, 1.0, base_margin=0.1)
    assert b["upper_limb"]["margin_deg"] == pytest.approx(0.1 - EARTH_RADIUS_DEG)
    assert b["whole_disk"]["margin_deg"] == pytest.approx(0.1 + EARTH_RADIUS_DEG)
    assert b["angular_radius_deg"] == EARTH_RADIUS_DEG


def test_a_target_just_above_the_skyline_passes_by_centre_but_not_as_a_whole_disc():
    out, b = run(0.5, 0.5)  # centre 0.5 deg up; Earth's radius is 0.95
    assert b["centre"]["outcome"] == "PASS" and b["upper_limb"]["outcome"] == "PASS"
    assert b["whole_disk"]["outcome"] == "FAIL" and b["whole_disk"]["availability_upper"] == 0.0
    assert b["outcome_changes"] == {"upper_limb": False, "whole_disk": True}
    assert b["matters"] is True and out["matters"] is True


def test_a_target_just_below_the_skyline_fails_by_centre_but_part_of_the_disc_shows():
    _, b = run(-0.5, -0.5)
    assert b["centre"]["outcome"] == "FAIL"
    assert b["upper_limb"]["outcome"] == "PASS" and b["upper_limb"]["availability_lower"] == 1.0
    assert b["outcome_changes"] == {"upper_limb": True, "whole_disk": False} and b["matters"] is True


def test_well_clear_or_well_hidden_targets_are_unchanged_and_not_flagged():
    for el in (6.0, -6.0):
        out, b = run(el, el)
        assert b["matters"] is False and out["matters"] is False
        assert not any(b["outcome_changes"].values())


def test_the_sun_uses_its_own_smaller_radius():
    sp = spline(0.1, 0.1)
    out = disk_edge_sensitivity({"sun_center": sp}, None, base_margin_deg=0.0, settings={"sun_center": SET},
                                duration_s=DAY, step_s=STEP, thresholds={"sun_center": 0.6},
                                centre={"sun_center": centre_of(sp, 0.6)})
    b = out["targets"]["sun_center"]
    assert b["angular_radius_deg"] == SUN_RADIUS_DEG
    assert b["upper_limb"]["margin_deg"] == pytest.approx(-SUN_RADIUS_DEG)
    assert b["whole_disk"]["outcome"] == "FAIL"  # 0.1 deg up is less than the Sun's 0.27 deg radius


def test_the_note_says_what_is_and_is_not_modelled():
    out, _ = run(1.0, 1.0)
    assert out["schema"] == "lunascope.disk_edge/1"
    for phrase in ("centre", "upper limb", "whole disc", "0.90 to 1.03", "not modelled"):
        assert phrase in out["note"]


# ----------------------------------------------------------------------------- in the pipeline and the API
def test_every_run_carries_the_bracket_and_it_does_not_change_the_result_identity(tmp_path):
    cfg = RunConfig(start_utc=datetime(2027, 1, 10, tzinfo=UTC), duration_s=2 * 86400, radius_km=20.0,
                    az_step_deg=1.0, holdout_s=3600)
    stack, _ = build_stack(ServiceConfig(data_dir=tmp_path, stack_kind="synthetic"), "lola-80s-20m-adj")
    site = SiteSpec("rule-89.5S-E0", -89.5, 0.0, "test")
    a = run_site(site, cfg, stack)
    assert a["disk_edge"]["schema"] == "lunascope.disk_edge/1" and set(a["disk_edge"]["targets"]) == {"sun_center", "earth_center"}
    for tgt, b in a["disk_edge"]["targets"].items():
        assert b["centre"]["outcome"] == a["targets"][tgt]["terrain"]["metrics"]["outcome"]
        assert b["upper_limb"]["availability_lower"] >= b["whole_disk"]["availability_lower"]
    assert a["timing_s"]["disk_edge_s"] < 30
    b2 = run_site(site, cfg, stack)
    assert a["result_id"] == b2["result_id"] and a["run_id"] == b2["run_id"]  # the bracket is not part of the identity


def test_the_provenance_endpoint_exposes_it_for_the_evidence_page(tmp_path):
    body = {"mission": {"start_utc": "2027-01-10T00:00:00Z", "duration_s": 86400},
            "terrain": {"radius_km": 20, "az_step_deg": 1.0}, "sites": [{"site_id": "rule-89.5S-E0"}]}
    with TestClient(create_app(ServiceConfig(data_dir=tmp_path, stack_kind="synthetic"))) as c:
        rid = c.post("/api/v1/analyses", content=json.dumps(body)).json()["run_id"]
        t0 = time.time()
        while c.get(f"/api/v1/analyses/{rid}").json()["status"] not in ("complete", "complete_with_warnings"):
            assert time.time() - t0 < 120
            time.sleep(0.3)
        site = c.get(f"/api/v1/analyses/{rid}/provenance").json()["sites"][0]
        assert site["disk_edge"]["targets"]["earth_center"]["angular_radius_deg"] == EARTH_RADIUS_DEG
        assert "disk_edge" in c.get(f"/api/v1/analyses/{rid}/export").json()["sites"][0]


# ----------------------------------------------------------------------------- the real RUN-001 bundles
def test_the_real_run_001_bundles_get_the_bracket_and_the_committed_evidence_is_current():
    import glob
    from pathlib import Path

    from lunascope.canonical import canonical_bytes
    from lunascope.reference import disk_edge_from_bundle

    root = Path(__file__).resolve().parents[3] / "docs" / "runs"
    committed = json.loads((root / "evidence" / "RUN-001-disk-edge.json").read_text(encoding="utf-8"))
    by_site = {s["site_id"]: s for s in committed["sites"]}
    files = sorted(glob.glob(str(root / "bundles" / "*.json")))
    assert len(files) == 3 and len(by_site) == 3
    for f in files:
        b = json.loads(Path(f).read_text(encoding="utf-8"))
        d = disk_edge_from_bundle(b)
        for tgt, x in d["targets"].items():
            stored = b["targets"][tgt]["terrain"]["metrics"]
            assert x["centre"]["availability_lower"] == stored["availability_lower"]  # the centre is the real result
            assert x["upper_limb"]["availability_lower"] >= x["centre"]["availability_lower"] >= x["whole_disk"]["availability_lower"]
        # what is committed is what the code produces now (regenerate with scripts/disk_edge_real.py)
        assert json.loads(canonical_bytes(d)) == by_site[b["request"]["site"]["site_id"]]["disk_edge"]
        assert by_site[b["request"]["site"]["site_id"]]["result_state"] == "real_data_unverified"
