"""Pipeline mechanics on a SYNTHETIC stack (analytic geometry, synthetic ridge). Real-data runs
are exercised by scripts/first_real_run.py and recorded in docs/runs/."""

import dataclasses
from datetime import UTC, datetime
from itertools import pairwise
from pathlib import Path
from typing import ClassVar

import numpy as np
import pytest

from lunascope.canonical import canonical_bytes, hash_of
from lunascope.pipeline import (
    RunConfig,
    SiteSpec,
    Stack,
    compare_runs,
    run_site,
    run_with_sensitivity,
    save_bundle,
)
from lunascope.providers.geometry.base import GeometrySeries
from lunascope.terrain import FlatSphere, Ridge

START = datetime(2027, 1, 10, tzinfo=UTC)
DAY = 86400.0
SITE = SiteSpec("syn-1", -89.5, 0.0)


class AnalyticGeometry:
    """Sun-like target: azimuth sweeps 70 -> 110 deg over 2 days at 2 deg elevation."""

    identity: ClassVar[dict] = {"name": "fixture-synthetic"}

    def __init__(self, el_deg=2.0):
        self.el = el_deg

    def series(self, obs, target, times):
        t = np.array([(x - START).total_seconds() for x in times])
        az = 70.0 + 40.0 * t / (2 * DAY)
        el = np.full_like(t, self.el if target == "sun_center" else 5.0)
        return GeometrySeries(
            target=target, t_utc=tuple(times), az_deg=az, el_deg=el, provider="fixture-synthetic",
            signature_version="0", raw_sha256=hash_of({"t": target, "n": len(times), "el": self.el}),
            retrieved_utc="2027-01-01T00:00:00Z", request={"synthetic": True},
            correction_mode="none", time_scale="UTC")


def terrain_factory(site, cfg):
    from lunascope.observer import build_observer
    o = build_observer(site_id=site.site_id, lat_deg=site.lat_deg, lon_deg=site.lon_east_deg,
                       convention="planetocentric", lon_direction="east_positive",
                       reference_radius_km=1737.4, ground_height_m=0.0, ground_height_source="syn",
                       observer_height_above_ground_m=cfg.observer_height_m)
    # ridge at azimuth 90 +/- 5 deg, 5 km away, 300 m high: skyline ~3.4 deg there
    return Ridge(o, az_deg=90.0, half_width_deg=5.0, dist_km=5.0, length_km=1.0, height_m=300.0), 0.0


def cfg(**kw):
    base = {"start_utc": START, "duration_s": 2 * 86400, "step_s": 600, "radius_km": 20.0,
            "az_step_deg": 1.0, "holdout_s": 3600}
    base.update(kw)
    return RunConfig(**base)


def stack(synthetic=True, el=2.0):
    return Stack(geometry=AnalyticGeometry(el), terrain_factory=terrain_factory, synthetic=synthetic)


@pytest.fixture(scope="module")
def result():
    return run_site(SITE, cfg(), stack())


def test_synthetic_inputs_are_labelled_everywhere_and_never_verified(result):
    assert result["result_state"] == "synthetic_demonstration"
    assert "DEMONSTRATION_DATA" in result["warnings"] and "UNVERIFIED" not in result["warnings"]
    assert result["verified"] is False and result["validated_scopes"] == []


def test_real_inputs_without_validation_are_real_data_unverified():
    r = run_site(SITE, cfg(duration_s=6 * 3600), stack(synthetic=False))
    assert r["result_state"] == "real_data_unverified" and "UNVERIFIED" in r["warnings"]
    assert r["verified"] is False and r["validated_scopes"] == []


def test_terrain_changes_the_answer_flat_horizon_is_kept_for_comparison(result):
    sun = result["targets"]["sun_center"]
    t, f = sun["terrain"]["metrics"], sun["flat"]["metrics"]
    assert f["hidden_s"] == 0 and f["availability_lower"] > 0.99  # geometric-only: always up
    assert 0.2 < t["hidden_s"] / (2 * DAY) < 0.35  # azimuths 85-95 of a 70-110 sweep: ~25%
    assert t["longest_known_hidden_s"] > 0.4 * DAY
    kinds = [e["type"] for e in sun["terrain"]["events"]]
    assert kinds == ["set", "rise"] and not sun["flat"]["events"]


def test_durations_partition_the_mission_window(result):
    for tgt in ("sun_center", "earth_center"):
        for h in ("terrain", "flat"):
            m = result["targets"][tgt][h]["metrics"]
            assert m["visible_s"] + m["hidden_s"] + m["unknown_s"] == pytest.approx(2 * DAY, abs=1e-3)
            ivs = result["targets"][tgt][h]["intervals"]
            assert ivs[0]["start_s"] == 0 and ivs[-1]["end_s"] == 2 * DAY
            assert all(a["end_s"] == b["start_s"] for a, b in pairwise(ivs))


def test_metrics_recompute_from_the_exported_intervals(result):  # AC-06
    sun = result["targets"]["sun_center"]["terrain"]
    vis = sum(i["end_s"] - i["start_s"] for i in sun["intervals"] if i["class"] == "V")
    unk = sum(i["end_s"] - i["start_s"] for i in sun["intervals"] if i["class"] in "UXG")
    m = sun["metrics"]
    assert m["availability_lower"] == pytest.approx(vis / (2 * DAY), abs=1e-9)
    assert m["availability_upper"] == pytest.approx((vis + unk) / (2 * DAY), abs=1e-9)


def test_events_sit_inside_their_decision_bands_and_timing_bounds_are_reported(result):
    sun = result["targets"]["sun_center"]["terrain"]
    for e in sun["events"]:
        assert any(i["class"] == "U" and i["start_s"] <= e["t_s"] <= i["end_s"] for i in sun["intervals"])
        assert e["geometry_timing_bound_s"] is not None and e["quality"] == "normal"
        assert e["t_utc"].endswith("Z") and e["solver_bracket_s"] == 1.0


def test_countdown_comes_from_the_same_event_list(result):
    c = result["targets"]["sun_center"]["terrain"]["countdown_at_start"]
    first = result["targets"]["sun_center"]["terrain"]["events"][0]
    assert c["kind"] == "set" and c["at"] == pytest.approx(first["t_s"])


def test_site_status_follows_per_target_outcomes(result):
    assert result["site_status"] in {"PASS", "FAIL_SUN", "FAIL_EARTH", "FAIL_BOTH", "INDETERMINATE",
                                     "UNKNOWN_COVERAGE"}
    sun_out = result["targets"]["sun_center"]["terrain"]["metrics"]["outcome"]
    assert sun_out in {"PASS", "FAIL", "INDETERMINATE", "EXCLUDED"}


def test_ids_are_deterministic_and_change_with_inputs(result):
    again = run_site(SITE, cfg(), stack())
    assert (again["run_id"], again["result_id"]) == (result["run_id"], result["result_id"])
    assert run_site(SITE, cfg(sun_min=0.5), stack())["run_id"] != result["run_id"]
    assert run_site(SITE, cfg(eps_deg=0.02), stack())["run_id"] != result["run_id"]
    assert run_site(SITE, cfg(), stack(el=3.0))["result_id"] != result["result_id"]


def test_bundle_is_canonical_json_and_saved_with_its_hash(result, tmp_path):
    raw = canonical_bytes(result)
    assert raw and b"NaN" not in raw
    p = save_bundle(result, tmp_path)
    assert Path(p).read_bytes() == raw and result["run_id"][:16] in p.name


def test_provenance_fields_are_present(result):
    assert result["algorithm_id"].startswith("lunascope-science/")
    assert result["horizon"]["sectors"]["certified"] == 360 and result["horizon"]["cache_key"]
    g = result["geometry"]["sun_center"]
    assert g["holdout"]["n"] == 61 and g["delta_geom_used_deg"] >= 1e-6 and g["raw_sha256"]
    assert result["observer"]["site_id"] == "syn-1" and result["resources"][0]["role"] == "dem"


def test_sensitivity_flags_a_changed_decision_and_stays_quiet_when_stable():
    base = run_site(SITE, cfg(), stack())
    same = compare_runs(base, run_site(SITE, cfg(), stack()), "identical")
    assert same["sensitivity_high"] is False
    # a DEM variant without the ridge hides nothing: availability moves by far more than 1 point
    flat_factory = lambda site, c: (FlatSphere(terrain_factory(site, c)[0].obs), 0.0)
    r = run_with_sensitivity(SITE, cfg(), stack(), alt_terrain_factory=flat_factory)
    alt = next(c for c in r["sensitivity"] if c["variant"] == "alternate_dem_release")
    assert alt["sensitivity_high"] is True and "SENSITIVITY_HIGH" in r["warnings"]
    assert alt["targets"]["sun_center"]["outcome_changed"] or abs(
        alt["targets"]["sun_center"]["delta_lower"]) > 0.01


def test_invalid_duration_rejected():
    with pytest.raises(ValueError):
        run_site(SITE, dataclasses.replace(cfg(), duration_s=1000), stack())


def test_stored_horizon_gives_the_same_science_and_is_reported_as_cached(tmp_path):
    s = stack().replace(horizon_dir=tmp_path)
    first = run_site(SITE, cfg(), s)
    second = run_site(SITE, cfg(), s)
    assert first["timing_s"]["horizon_cached"] == 0.0 and second["timing_s"]["horizon_cached"] == 1.0
    assert list(tmp_path.glob("*.horizon.npz"))
    for k in ("horizon", "targets", "result_id"):
        assert second[k] == first[k]
