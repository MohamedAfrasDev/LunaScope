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
