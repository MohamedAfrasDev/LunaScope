import json

import pytest

from lunascope.api_models import (
    MAX_BODY_BYTES,
    canonical_request,
    parse_request,
    resolve_sites,
    to_run_config,
)
from lunascope.errors import INVALID_INPUT, LunaScopeError


def base(**over):
    d = {"mission": {"start_utc": "2027-01-10T00:00:00Z", "duration_s": 172800},
         "terrain": {"radius_km": 20, "az_step_deg": 1.0},
         "sites": [{"site_id": "rule-89.5S-E0"}]}
    for k, v in over.items():
        d[k] = v
    return d


def parse(d):
    return parse_request(json.dumps(d).encode())


def rejects(d, field_part=None):
    with pytest.raises(LunaScopeError) as e:
        parse(d)
    assert e.value.code == INVALID_INPUT
    if field_part:
        assert field_part in (e.value.field or "")
    return e.value


def test_minimal_valid_request_gets_documented_defaults():
    r = parse(base())
    assert r.mission.step_s == 600 and r.requirements.sun_min_availability == 0.6
    assert r.requirements.earth_min_availability == 0.5 and r.terrain.dem_profile == "lola-80s-20m-adj"
    assert r.targets == ["sun_center", "earth_center"] and r.options.sensitivity is False


def test_integers_are_accepted_for_floats_in_json_but_strings_are_not():
    assert parse(base(terrain={"radius_km": 20, "az_step_deg": 1}))
    rejects(base(terrain={"radius_km": "20"}), "terrain.radius_km")
    rejects(base(mission={"start_utc": "2027-01-10T00:00:00Z", "duration_s": "172800"}), "duration_s")


def test_unknown_and_misspelled_fields_are_rejected_not_ignored():
    rejects(base(extra_field=1), "extra_field")
    rejects(base(terrain={"radius_km": 20, "az_step_degs": 1.0}), "az_step_degs")
    rejects(base(mission={"start_utc": "2027-01-10T00:00:00Z", "duration_s": 172800, "dur": 1}))


@pytest.mark.parametrize("start", ["2027-01-10T00:00:00", "2027-01-10T00:00:00+02:00",
                                   "2027-01-10T00:00:30Z", "2019-12-31T00:00:00Z",
                                   "2100-01-01T00:00:00Z", "not a date"])
def test_start_must_be_a_bounded_whole_minute_utc_time(start):
    rejects(base(mission={"start_utc": start, "duration_s": 172800}), "start_utc")


@pytest.mark.parametrize("m", [{"duration_s": 3599}, {"duration_s": 31 * 86400},
                               {"duration_s": 172800, "step_s": 59}, {"duration_s": 172800, "step_s": 3601},
                               {"duration_s": 172800, "step_s": 700}])
def test_duration_and_step_bounds(m):
    rejects(base(mission={"start_utc": "2027-01-10T00:00:00Z", **m}))


def test_terrain_bounds_and_the_azimuth_step_must_divide_360():
    for t in ({"radius_km": 0.5}, {"radius_km": 301}, {"az_step_deg": 0.01}, {"az_step_deg": 2.5},
              {"az_step_deg": 0.7}, {"observer_height_m": 51}, {"clearance_margin_deg": 2},
              {"dem_profile": "../etc/passwd"}, {"dem_profile": "C:\\dem.tif"}):
        rejects(base(terrain=t), "terrain")


def test_requirements_are_fractions():
    rejects(base(requirements={"sun_min_availability": 1.5}), "requirements")
    rejects(base(requirements={"earth_min_availability": -0.1}), "requirements")


def test_site_rules():
    rejects(base(sites=[]), "sites")
    rejects(base(sites=[{"site_id": "a"}] * 7), "sites")
    rejects(base(sites=[{}]), "sites")
    rejects(base(sites=[{"site_id": "rule-89.5S-E0", "custom": {
        "lat_deg": -89, "lon_deg": 1, "source": "x", "precision_m": 1}}]), "sites")
    rejects(base(sites=[{"site_id": "../x"}]), "site_id")
    rejects(base(sites=[{"custom": {"lat_deg": -70, "lon_deg": 1, "source": "x", "precision_m": 1}}]),
            "lat_deg")  # outside the DEM tile
    rejects(base(sites=[{"custom": {"lat_deg": -89, "lon_deg": 1, "source": "http://x", "precision_m": 1}}]),
            "source")
    rejects(base(sites=[{"custom": {"lat_deg": -89, "lon_deg": 1, "source": "x", "precision_m": 1,
                                    "convention": "planetographic"}}]), "convention")


def test_unknown_preset_and_duplicates_are_rejected_at_resolution():
    with pytest.raises(LunaScopeError) as e:
        resolve_sites(parse(base(sites=[{"site_id": "nope"}])))
    assert e.value.field == "sites.0.site_id"
    with pytest.raises(LunaScopeError):
        resolve_sites(parse(base(sites=[{"site_id": "rule-89.5S-E0"}, {"site_id": "rule-89.5S-E0"}])))


def test_custom_sites_are_normalised_and_west_positive_is_converted():
    r = parse(base(sites=[{"custom": {"lat_deg": -88.0, "lon_deg": 30.0, "lon_direction": "west_positive",
                                      "source": "user, 12 Nov", "precision_m": 50}}]))
    s = resolve_sites(r)[0]
    assert s.lon_east_deg == pytest.approx(330.0) and s.lat_deg == -88.0
    assert s.site_id.startswith("custom-") and "/" not in s.site_id and s.precision_m == 50


def test_sample_budget_is_enforced():
    big = base(mission={"start_utc": "2027-01-10T00:00:00Z", "duration_s": 30 * 86400, "step_s": 60},
               sites=[{"site_id": "rule-89.5S-E0"}])
    rejects(big)  # 43,201 samples x 2 targets x 1 site
    ok = base(mission={"start_utc": "2027-01-10T00:00:00Z", "duration_s": 30 * 86400, "step_s": 600},
              sites=[{"site_id": "rule-89.5S-E0"}, {"site_id": "rule-89.5S-E120"}, {"site_id": "rule-89.5S-E240"}])
    assert parse(ok)


def test_oversized_bodies_are_refused_before_parsing():
    with pytest.raises(LunaScopeError) as e:
        parse_request(b" " * (MAX_BODY_BYTES + 1))
    assert e.value.code == INVALID_INPUT


def test_garbage_and_wrong_shapes_are_input_errors():
    for raw in (b"", b"{", b"[]", b"null", b'{"mission": 5}'):
        with pytest.raises(LunaScopeError) as e:
            parse_request(raw)
        assert e.value.code == INVALID_INPUT


def test_canonical_request_is_stable_and_resolves_sites():
    r = parse(base())
    c1, c2 = canonical_request(r, resolve_sites(r)), canonical_request(parse(base()), resolve_sites(r))
    assert c1 == c2 and c1["sites"][0]["lat_deg"] == -89.5 and c1["sites"][0]["lon_east_deg"] == 0.0
    cfg = to_run_config(r)
    assert cfg.duration_s == 172800 and cfg.radius_km == 20.0 and cfg.az_step_deg == 1.0
