"""The illumination comparison: the declared gates judge agreement and can fail; the committed record re-derives."""

import json
from pathlib import Path

import numpy as np

from lunascope.illumination_check import (
    B_MAX_MAE_PP,
    evaluate_set_a,
    evaluate_set_b,
    fractions,
    map_values,
    stereographic_xy,
)

EVIDENCE = Path(__file__).resolve().parents[3] / "docs" / "runs" / "evidence" / "illumination-vs-map.json"


def _row(sun, sun_map, earth, earth_map, spread=0.0):
    def m(v):
        return {"pixel": v, "min3x3": v - spread, "max3x3": v + spread, "mean3x3": v}
    return {"sun": {"ours": sun, "map": m(sun_map)}, "earth": {"ours": earth, "map": m(earth_map)}}


def test_set_a_passes_on_agreement_and_fails_when_the_site_order_or_the_range_is_wrong():
    good = [_row(0.0, 0.0, 0.0, 0.0), _row(0.04, 0.036, 0.27, 0.268), _row(0.09, 0.094, 0.46, 0.46)]
    assert evaluate_set_a(good)["met"]
    swapped = [_row(0.0, 0.0, 0.0, 0.0), _row(0.10, 0.036, 0.27, 0.268, spread=0.1), _row(0.088, 0.094, 0.46, 0.46)]
    r = evaluate_set_a(swapped)
    assert r["checks"]["A1_sun_within_map_range"] and not r["checks"]["A2_sun_same_site_order"] and not r["met"]
    off = [_row(0.0, 0.0, 0.0, 0.0), _row(0.30, 0.036, 0.27, 0.268), _row(0.09, 0.094, 0.46, 0.46)]
    assert not evaluate_set_a(off)["checks"]["A1_sun_within_map_range"]


def test_set_b_needs_correlation_and_a_small_mean_difference():
    rng = np.random.default_rng(1)
    theirs = rng.uniform(0, 0.4, 10)
    same = [_row(t, t, t, t) for t in theirs]
    assert evaluate_set_b(same)["met"]
    shuffled = [_row(a, b, a, b) for a, b in zip(theirs[::-1], theirs, strict=True)]
    assert not evaluate_set_b(shuffled)["met"]  # a check must be able to fail
    biased = [_row(t + 0.2, t, t + 0.2, t) for t in theirs]  # perfectly correlated but 20 points off
    r = evaluate_set_b(biased)
    assert r["checks"]["B1_sun_correlation"] and not r["checks"]["B2_sun_mae"]
    assert B_MAX_MAE_PP == 5.0  # the declared value; changing it needs a reason on record


def test_fractions_order_centre_upper_limb_whole_disc_and_ignore_unknown_skyline():
    az = np.zeros(4)
    el = np.array([0.0, 1.0, 2.0, 3.0])
    f = fractions(az, el, np.full(4, 0.5), lambda a: np.array([1.2, 1.2, 1.2, np.nan]))
    assert f["samples"] == 3  # the unknown-skyline sample is not counted as visible or hidden
    assert f["whole_disc"] <= f["centre"] <= f["upper_limb"]


def test_map_pixel_lookup_uses_the_polar_stereographic_of_the_map():
    x, y = stereographic_xy(-90.0 + 1e-9, 0.0)
    assert abs(x) < 1e-3 and abs(y) < 1e-3
    x, y = stereographic_xy(-89.5, 90.0)
    assert x > 15_000 and abs(y) < 1  # east is +x, 15.16 km from the pole at 0.5 degrees
    assert map_values  # imported for the integration below


def test_the_committed_record_re_derives_from_its_rows():
    d = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    assert evaluate_set_b(d["sites"])["met"] == d["set_b"]["met"] is True
    a = evaluate_set_a(d["sites"][:3])
    assert a["met"] == d["set_a"]["met"] is False  # recorded honestly: the Sun site-order gate failed
    assert not a["checks"]["A2_sun_same_site_order"]
