"""Comparison logic on hand-built analyses (no service, no worker)."""

import copy
import json

import pytest

from lunascope.compare import (
    INCOMPATIBLE_RUNS,
    compare_runs,
    compare_sites,
    diff_intervals,
    window_metrics,
)
from lunascope.errors import INVALID_INPUT, LunaScopeError

DAY = 86400.0


def iv(cls, a, b):
    return {"start_s": a, "end_s": b, "class": cls, "start_utc": "", "end_utc": ""}


def block(intervals, outcome="PASS", lower=0.5, upper=0.5, longest=0.0, events=0, theta=0.6, flat=None):
    return {
        "metrics": {"outcome": outcome, "availability_lower": lower, "availability_upper": upper,
                    "margin_lower": lower - theta, "margin_upper": upper - theta,
                    "longest_known_hidden_s": longest, "worst_case_not_visible_s": longest,
                    "exclusion_reasons": []},
        "intervals": intervals, "events": [{"t_s": float(i)} for i in range(events)]}


def site(sid, sun, earth, flat_sun=None, flat_earth=None, status="PASS"):
    return {"request": {"site": {"site_id": sid, "lat_deg": -89.5, "lon_east_deg": 0.0}},
            "observer": {"ground_height_m": 0.0}, "site_status": status, "caveats": ["limit"],
            "targets": {"sun_center": {"terrain": sun, "flat": flat_sun or sun},
                        "earth_center": {"terrain": earth, "flat": flat_earth or earth}}}


def analysis(sites, start="2027-01-10T00:00:00Z", rid="a" * 64, **req):
    return {"run_id": rid, "result_state": "synthetic_demonstration", "algorithm_id": "alg", "warnings": ["W"],
            "verified": False, "validated_scopes": [], "sites": sites,
            "resources": [{"role": "dem", "sha256": "ff"}],
            "request": {"mission": {"start_utc": start, "duration_s": 2 * DAY, "step_s": 600},
                        "requirements": {"sun_min_availability": 0.6, "earth_min_availability": 0.5},
                        "terrain": {"dem_profile": "x", "radius_km": 20.0, "az_step_deg": 1.0,
                                    "observer_height_m": 2.0, "clearance_margin_deg": 0.0, **req}},
            "effective_settings": {"geometry_provider": {"name": "g"}, "interpolation": "i",
                                   "horizon_algorithm": "h", "stack_kind": "synthetic"}}


FLAT = [iv("V", 0, 2 * DAY)]


def three_sites():
    # A and B: same availability, very different longest outage; C: terrain flips Sun PASS -> FAIL
    h = 3600
    a = site("A", block([iv("V", 0, 1 * DAY), iv("H", 1 * DAY, 2 * DAY)], "FAIL", 0.5, 0.5, DAY),
             block(FLAT, "PASS", 1.0, 1.0), flat_sun=block(FLAT, "PASS", 1.0, 1.0))
    b = site("B", block([iv("H", 0, 10 * h), iv("V", 10 * h, 22 * h), iv("H", 22 * h, 32 * h),
                         iv("V", 32 * h, 44 * h), iv("H", 44 * h, 48 * h)], "FAIL", 0.5, 0.5, 10 * h),
             block(FLAT, "PASS", 1.0, 1.0), flat_sun=block(FLAT, "PASS", 1.0, 1.0))
    c = site("C", block([iv("H", 0, 2 * DAY)], "FAIL", 0.0, 0.0, 2 * DAY),
             block(FLAT, "PASS", 1.0, 1.0),
             flat_sun=block(FLAT, "PASS", 1.0, 1.0), status="FAIL_SUN")
    return analysis([a, b, c])


def test_sites_in_a_run_hold_inputs_constant_and_report_per_site_values():
    r = compare_sites(three_sites(), None)
    assert r["mode"] == "sites_in_run" and r["compatible"] is True
    held = {h["field"]: h["value"] for h in r["held_constant"]}
    assert held["mission.duration_s"] == 2 * DAY and held["requirements.sun_min_availability"] == 0.6
    assert held["resource.dem"] == "ff" and r["changed"][0]["field"] == "site"
    sun = r["targets"]["sun_center"]
    assert [x["site_id"] for x in sun["sites"]] == ["A", "B", "C"]
    assert sun["spread"]["availability_lower_range"] == pytest.approx(0.5)


def test_there_is_no_winner_rank_or_score_anywhere():
    text = json.dumps(compare_sites(three_sites(), None)) + json.dumps(
        compare_runs(three_sites(), three_sites() | {"run_id": "b" * 64}, None, "elapsed"))
    for word in ("winner", "rank", "score", "best_site", "overall"):
        assert word not in text.lower()


def test_equal_availability_with_different_outages_is_a_typed_fact():  # spec test case 11
    facts = compare_sites(three_sites(), ["A", "B"])["facts"]
    f = next(x for x in facts if x["fact"] == "equal_availability_different_outage" and x["target"] == "sun_center")
    assert f["sites"] == ["A", "B"] and f["longest_known_hidden_s"] == [DAY, 10 * 3600]
    assert f["availability_lower"] == [0.5, 0.5]


def test_terrain_changing_the_outcome_and_unanimity_are_reported_honestly():
    facts = compare_sites(three_sites(), None)["facts"]
    flips = [x for x in facts if x["fact"] == "terrain_changes_outcome" and x["target"] == "sun_center"]
    assert {x["site_id"] for x in flips} == {"A", "B", "C"} and flips[0]["flat_outcome"] == "PASS"
    assert next(x for x in facts if x["fact"] == "outcomes_same" and x["target"] == "sun_center")
    assert next(x for x in facts if x["fact"] == "outcomes_same" and x["target"] == "earth_center")


def test_similar_availability_with_a_small_outage_difference_is_not_called_different():
    a = analysis([
        site("A", block([iv("V", 0, DAY)], "FAIL", 0.5, 0.5, 3600.0), block(FLAT)),
        site("B", block([iv("V", 0, DAY)], "FAIL", 0.505, 0.505, 3700.0), block(FLAT)),
    ])
    assert not [f for f in compare_sites(a, None)["facts"] if f["fact"] == "equal_availability_different_outage"]


def test_unresolved_time_matters_when_bounds_are_wide():
    a = analysis([site("A", block(FLAT, "INDETERMINATE", 0.55, 0.65), block(FLAT)),
                  site("B", block(FLAT, "PASS", 0.7, 0.7), block(FLAT))])
    f = next(x for x in compare_sites(a, None)["facts"] if x["fact"] == "unresolved_time_matters")
    assert f["sites"] == ["A"]


def test_input_validation_for_site_selection():
    a = three_sites()
    for bad in (["A"], ["A", "A"], ["A", "Z"]):
        with pytest.raises(LunaScopeError) as e:
            compare_sites(a, bad)
        assert e.value.code == INVALID_INPUT


# ---- two runs ------------------------------------------------------------------------------
def shifted_pair(shift_days=1):
    a = three_sites()
    b = copy.deepcopy(a)
    b["run_id"] = "b" * 64
    b["request"]["mission"]["start_utc"] = f"2027-01-{10 + shift_days:02d}T00:00:00Z"
    return a, b


def test_window_metrics_recompute_from_intervals():
    ivs = [iv("V", 0, 100), iv("U", 100, 120), iv("H", 120, 300)]
    w = window_metrics(ivs, 50, 150)
    assert (w["visible_s"], w["unknown_s"], w["hidden_s"], w["window_s"]) == (50, 20, 30, 100)
    assert w["availability_lower"] == 0.5 and w["availability_upper"] == pytest.approx(0.7)


def test_diff_intervals_lists_where_the_state_differs_and_merges_neighbours():
    a = [iv("V", 0, 100), iv("H", 100, 200)]
    b = [iv("V", 0, 150), iv("H", 150, 200)]
    assert diff_intervals(a, b, 0.0, 0, 200) == [{"start_s": 100, "end_s": 150, "a": "H", "b": "V"}]
    # b is the same pattern 50 s later in calendar time
    assert diff_intervals(a, a, 50.0, 50, 200) != []
    assert diff_intervals(a, a, 0.0, 0, 200) == []


def test_a_date_shift_keeps_everything_else_and_names_the_changed_field():
    a, b = shifted_pair()
    r = compare_runs(a, b, None, "elapsed")
    assert [c["field"] for c in r["changed"]] == ["mission.start_utc"]
    assert r["changed"][0] == {"field": "mission.start_utc", "from": "2027-01-10T00:00:00Z", "to": "2027-01-11T00:00:00Z"}
    assert r["alignment"] == "elapsed" and r["shift_s"] == DAY and r["overlap"] is None
    held = {h["field"] for h in r["held_constant"]}
    assert {"mission.duration_s", "terrain.radius_km", "algorithm_id"} <= held
    s = r["sites"][0]["targets"]["sun_center"]
    assert s["delta"]["availability_lower"] == 0 and s["changed_intervals"] == []  # identical in elapsed terms


def test_calendar_alignment_compares_only_the_overlap_and_shows_the_difference():
    a, b = shifted_pair()
    r = compare_runs(a, b, ["A"], "calendar")
    assert r["alignment"] == "calendar" and r["overlap"]["duration_s"] == DAY
    assert r["overlap"]["start_utc"] == "2027-01-11T00:00:00Z"
    t = r["sites"][0]["targets"]["sun_center"]
    # A's second day is hidden; B's first day (the same calendar day) is visible
    assert t["a"]["availability_lower"] == 0.0 and t["b"]["availability_lower"] == 1.0
    assert t["delta"]["availability_lower"] == 1.0
    assert t["a"]["window_s"] == DAY and t["outcome_change"] == "FAIL to PASS"
    assert t["changed_intervals"] and t["changed_intervals"][0]["a"] == "H" and t["changed_intervals"][0]["b"] == "V"


def test_runs_that_are_not_variants_of_each_other_are_refused_with_reasons():
    a, b = shifted_pair()
    b["request"]["requirements"]["sun_min_availability"] = 0.7
    with pytest.raises(LunaScopeError) as e:
        compare_runs(a, b, None, "elapsed")
    assert e.value.code == INCOMPATIBLE_RUNS and "requirements.sun_min_availability" in e.value.message
    a, b = shifted_pair()
    b["sites"] = b["sites"][:1]
    with pytest.raises(LunaScopeError):
        compare_runs(a, b, ["A", "B"], "elapsed")
    a, b = shifted_pair(shift_days=5)
    with pytest.raises(LunaScopeError) as e:
        compare_runs(a, b, None, "calendar")
    assert "overlap" in e.value.message
    with pytest.raises(LunaScopeError):
        compare_runs(a, b, None, "sideways")
