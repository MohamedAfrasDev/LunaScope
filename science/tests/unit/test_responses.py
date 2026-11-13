import glob
import json
from pathlib import Path

from lunascope.explain import explain_target
from lunascope.responses import HorizonResponse, TargetResults

BUNDLES = Path(__file__).resolve().parents[3] / "docs" / "runs" / "bundles"


def _bundles():
    return [json.loads(Path(p).read_text(encoding="utf-8")) for p in sorted(glob.glob(str(BUNDLES / "*.json")))]


def test_real_run_001_target_results_fit_the_response_models():
    """The service builds these dicts from stored real-run bundles; the models must accept them."""
    n = 0
    for b in _bundles():
        for hs in b["targets"].values():
            tm = {}
            for h, v in hs.items():
                tm[h] = {"metrics": v["metrics"], "clearance_at_nodes": v["clearance_at_nodes"],
                         "countdown_at_start": v["countdown_at_start"], "intervals": v["intervals"],
                         "events": v["events"]}
            tm["explanations"] = explain_target(hs["terrain"], hs.get("flat"))
            TargetResults.model_validate(tm)
            n += 1
    assert n == 6


def test_real_run_001_horizon_payload_fits_the_horizon_model():
    for b in _bundles():
        HorizonResponse.model_validate({"site_id": "x", "result_state": b["result_state"], **b["horizon"]})
