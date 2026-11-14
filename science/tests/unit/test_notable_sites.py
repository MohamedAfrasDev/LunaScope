"""The named-places catalog: coordinates are the IAU's, the groups fit one request, and the new references are comparable."""

import json
from pathlib import Path

from lunascope.api_models import resolve_sites
from lunascope.reference import definition_request, load_definition

DATA = Path(__file__).resolve().parents[3] / "data" / "sites"


def _named():
    cat = json.loads((DATA / "catalog.json").read_text(encoding="utf-8"))
    return cat, [s for s in cat["sites"] if s["kind"] == "named_feature_iau"]


def check_against_extract(named: list[dict], extract: dict) -> list[str]:
    """Problems found comparing catalog entries with the committed copy of the IAU rows (empty = consistent)."""
    by = {"iau-" + e["name"].lower().replace(" ", "-"): e for e in extract["features"]}
    problems = []
    for s in named:
        e = by.get(s["site_id"])
        if e is None:
            problems.append(f"{s['site_id']}: no IAU row")
        elif (s["lat_deg"], s["lon_east_deg"], s["diameter_km"], s["iau_url"]) != (e["lat_deg"], e["lon_east_deg"], e["diameter_km"], e["iau_url"]):
            problems.append(f"{s['site_id']}: differs from its IAU row")
    if len(named) != len(extract["features"]):
        problems.append("catalog and extract hold different numbers of places")
    return problems


def test_every_named_place_is_exactly_its_iau_row_and_the_check_can_fail():
    _, named = _named()
    extract = json.loads((DATA / "iau_extract.json").read_text(encoding="utf-8"))
    assert len(extract["sha256"]) == 64 and "Public domain" in extract["licence"]
    assert check_against_extract(named, extract) == []
    # a check must be able to fail: move a coordinate, or drop a place, and it is reported
    moved = json.loads(json.dumps(named))
    moved[0]["lat_deg"] += 0.01
    assert check_against_extract(moved, extract)
    assert check_against_extract(named[:-1], extract)


def test_places_are_south_polar_grouped_and_each_group_fits_one_analysis():
    cat, named = _named()
    assert len(named) == 12 and all(s["lat_deg"] <= -80 for s in named)
    groups: dict[str, int] = {}
    for s in named:
        assert s["group"] in cat["groups"] and s["convention"] == "planetocentric"
        groups[s["group"]] = groups.get(s["group"], 0) + 1
    assert all(n <= 6 for n in groups.values())  # a request holds at most six sites
    assert "none of these is a landing recommendation" in cat["note"]


def test_gr002_and_gr003_resolve_and_use_the_same_window_requirements_and_terrain_as_gr001():
    base = definition_request(load_definition("GR-001"))
    _, named = _named()
    ids = {s["site_id"] for s in named}
    resolved = {}
    for rid in ("GR-002", "GR-003"):
        d = load_definition(rid)
        assert d["status"] == "draft" and "NOT RECOMMENDATIONS" in d["sites_status"]
        req = definition_request(d)
        assert (req.mission, req.requirements, req.terrain) == (base.mission, base.requirements, base.terrain)
        sites = {s.site_id for s in resolve_sites(req)}
        assert 1 <= len(sites) <= 6 and sites <= ids
        resolved[rid] = sites
    assert not (resolved["GR-002"] & resolved["GR-003"])
