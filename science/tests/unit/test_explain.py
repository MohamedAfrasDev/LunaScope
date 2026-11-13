import glob
import json
from pathlib import Path

from lunascope.explain import explain_target

BUNDLES = Path(__file__).resolve().parents[3] / "docs" / "runs" / "bundles"


def _m(**kw):
    base = {"outcome": "PASS", "availability_lower": 0.5, "availability_upper": 0.5, "visible_s": 10, "hidden_s": 10,
            "uncertified_s": 0, "unknown_s": 0, "gap_s": 0, "longest_known_hidden_s": 0, "exclusion_reasons": []}
    return {"metrics": {**base, **kw}, "clearance_at_nodes": {"max_deg": -3.0, "samples": 5}}


def codes(f):
    return [x["code"] for x in f]


def test_hidden_whole_window_states_the_margin_below_the_skyline():
    f = explain_target(_m(outcome="FAIL", availability_lower=0, availability_upper=0, visible_s=0, hidden_s=100))
    assert codes(f)[:2] == ["HIDDEN_WHOLE_WINDOW", "CLOSEST_APPROACH_BELOW"] and "3.0 deg below" in f[1]["text"]


def test_unresolved_time_is_a_range_and_never_called_not_visible():
    f = explain_target(_m(outcome="INDETERMINATE", availability_lower=0.2, availability_upper=0.6, uncertified_s=7200))
    assert codes(f)[0] == "UNRESOLVED_TIME" and "20.0% and 60.0%" in f[0]["text"] and "not visible" not in f[0]["text"]


def test_terrain_outcome_flip_is_reported():
    f = explain_target(_m(outcome="FAIL", availability_lower=0, availability_upper=0, visible_s=0),
                       flat=_m(outcome="PASS", availability_lower=1, availability_upper=1))
    assert "TERRAIN_CHANGES_OUTCOME" in codes(f)


def test_excluded_gives_only_the_reason():
    f = explain_target(_m(outcome="EXCLUDED", exclusion_reasons=["DEM_COVERAGE_INCOMPLETE"]))
    assert codes(f) == ["EXCLUDED"] and "DEM_COVERAGE_INCOMPLETE" in f[0]["text"]


def test_run_001_sun_is_explained_from_the_stored_numbers():
    b = json.loads(Path(min(glob.glob(str(BUNDLES / "*.json")))).read_text(encoding="utf-8"))
    t = b["targets"]["sun_center"]
    f = explain_target(t["terrain"], t["flat"])
    assert "HIDDEN_WHOLE_WINDOW" in codes(f) and "TERRAIN_CHANGES_OUTCOME" in codes(f)
