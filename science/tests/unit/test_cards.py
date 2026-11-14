import glob
import json
from pathlib import Path

import pytest

from lunascope.cards import run_cards

BUNDLES = Path(__file__).resolve().parents[3] / "docs" / "runs" / "bundles"


@pytest.fixture(scope="module")
def run001():
    sites = [json.loads(Path(p).read_text(encoding="utf-8")) for p in sorted(glob.glob(str(BUNDLES / "*.json")))]
    return {"run_id": "r" * 64, "result_state": "real_data_unverified", "sites": sites, "validated_scopes": []}


def by(cards, cid):
    return [c for c in cards if c["id"] == cid]


def test_run_001_cards_are_evidence_not_validation(run001):
    out = run_cards(run001)
    assert out["scopes_closed"] == [] and "does not make the result verified" in out["note"]
    assert all(c["status"] == "met" for c in by(out["cards"], "geometry_agreement"))
    assert len(by(out["cards"], "geometry_agreement")) == 6  # 3 sites x 2 targets
    # the one thing nothing can claim yet
    assert all(c["status"] == "not_evaluated" for c in by(out["cards"], "independent_terrain_check"))
    assert out["summary"]["not_evaluated"] >= 3


def test_a_failed_tolerance_or_flipped_outcome_is_not_met(run001):
    bad = json.loads(json.dumps(run001))
    s = bad["sites"][0]
    s["geometry"]["sun_center"]["reference_agreement"]["within_tolerance"] = False
    s["sensitivity"][0]["targets"]["sun_center"]["outcome_changed"] = True
    s["horizon"]["sectors"]["coverage_limited"] = 5
    cards = run_cards(bad)["cards"]
    first = [c for c in cards if c["site_id"] == s["request"]["site"]["site_id"]]
    assert [c["status"] for c in first if c["id"] == "geometry_agreement" and c["target"] == "sun_center"] == ["not_met"]
    assert by(first, "horizon_convergence")[0]["status"] == "not_met"
    assert by(first, "horizon_certification")[0]["status"] == "not_met"


def test_missing_reference_or_variant_is_not_evaluated_never_met(run001):
    thin = json.loads(json.dumps(run001))
    s = thin["sites"][0]
    s["geometry"]["sun_center"].pop("reference_agreement")
    s["sensitivity"] = []
    cards = [c for c in run_cards(thin)["cards"] if c["site_id"] == s["request"]["site"]["site_id"]]
    assert [c["status"] for c in cards if c["id"] == "geometry_agreement" and c["target"] == "sun_center"] == ["not_evaluated"]
    assert by(cards, "horizon_convergence")[0]["status"] == "not_evaluated"


def test_three_groups_roll_up_without_ever_promoting_an_unrun_check():
    from lunascope.cards import group_cards
    card = lambda cid, st: {"id": cid, "status": st}
    g = {x["id"]: x for x in group_cards([
        card("geometry_agreement", "met"), card("interpolation_holdout", "met"),
        card("horizon_certification", "met"), card("independent_terrain_check", "not_evaluated"),
        card("horizon_convergence", "not_met")])}
    assert list(g) == ["geometry", "terrain_horizon", "numerical_convergence"]
    assert g["geometry"]["status"] == "met"
    assert g["terrain_horizon"]["status"] == "not_evaluated"  # one check never ran
    assert g["numerical_convergence"]["status"] == "not_met"
    assert g["terrain_horizon"]["counts"] == {"met": 1, "not_met": 0, "not_evaluated": 1}
    assert group_cards([])[0]["status"] == "not_evaluated"  # nothing ran: not met by default


def test_run_001_groups_are_never_all_met(run001):
    groups = run_cards(run001)["groups"]
    assert {x["id"]: x["status"] for x in groups}["terrain_horizon"] != "met"  # no independent skyline yet


# ------------------------------------------------------------- independent skyline evidence
from lunascope.cards import _independent_card, load_independent_evidence

GOOD = {"sectors_compared": 3500, "sectors_total": 3600, "near_field_sectors": 100, "near_field_fraction": 100 / 3600,
        "ray_above_inclusive_deg": 0.0002, "within_tolerance_fraction": 0.999, "max_tolerance_ratio": 1.2,
        "best_shift_sectors": 0}


def _site(digest="a" * 64, dem="d" * 64):
    return {"horizon": {"payload_sha256": digest, "terrain_identity": {"sha256": dem}}}


def _write(tmp_path, metrics, digest="a" * 64, dem="d" * 64, recorded_met=True):
    ev = {"subject": {"payload_sha256": digest}, "dem": {"sha256": dem}, "metrics": metrics,
          "independent": {"near_field_km": 0.1}, "verdict_when_recorded": {"met": recorded_met}}
    (tmp_path / f"{digest}.json").write_text(json.dumps(ev), encoding="utf-8")


def test_independent_card_is_not_evaluated_without_evidence_for_that_exact_skyline(tmp_path):
    assert _independent_card(_site(), "s", tmp_path)["status"] == "not_evaluated"
    assert load_independent_evidence("../../etc/passwd", tmp_path) is None  # a digest, never a path
    assert load_independent_evidence(None, tmp_path) is None


def test_independent_card_is_met_only_when_the_declared_gates_hold_and_the_file_is_for_this_skyline(tmp_path):
    _write(tmp_path, GOOD)
    assert _independent_card(_site(), "s", tmp_path)["status"] == "met"
    # a check must be able to fail: the recorded verdict is NOT trusted, the metrics are re-judged
    _write(tmp_path, {**GOOD, "within_tolerance_fraction": 0.5}, recorded_met=True)
    assert _independent_card(_site(), "s", tmp_path)["status"] == "not_met"
    _write(tmp_path, {**GOOD, "ray_above_inclusive_deg": 0.3})
    assert _independent_card(_site(), "s", tmp_path)["status"] == "not_met"
    _write(tmp_path, GOOD)
    # evidence for a different DEM file is not evidence for this run
    assert _independent_card(_site(dem="e" * 64), "s", tmp_path)["status"] == "not_evaluated"
    # a malformed file is never read as a pass
    (tmp_path / f"{'a' * 64}.json").write_text("{}", encoding="utf-8")
    assert _independent_card(_site(), "s", tmp_path)["status"] == "not_evaluated"
