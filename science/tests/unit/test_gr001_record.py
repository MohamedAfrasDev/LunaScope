"""The committed, frozen GR-001 record (docs/runs/GR-001): what the freeze promises, as a permanent test.

If any of these fails the answer is not to edit GR-001: a change to its inputs, settings, DEM or kernel
identity, or the algorithm version makes a new reference. Create GR-002 (see check_freeze).
"""

import glob
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest

from lunascope import ALGORITHM_VERSION
from lunascope.reference import gate_report, readiness

ROOT = Path(__file__).resolve().parents[3]
RECORD = ROOT / "docs" / "runs" / "GR-001"
DEFINITION = ROOT / "data" / "reference" / "GR-001.json"


@pytest.fixture(scope="module")
def frozen():
    manifest = json.loads((RECORD / "manifest.json").read_text(encoding="utf-8"))
    bundles = {Path(f).name: json.loads(Path(f).read_text(encoding="utf-8")) for f in sorted(glob.glob(str(RECORD / "*_*.json")))}
    return manifest, bundles


def test_the_manifest_belongs_to_the_committed_definition_and_its_pin(frozen):
    manifest, _ = frozen
    definition = json.loads(DEFINITION.read_text(encoding="utf-8"))
    sha = hashlib.sha256(DEFINITION.read_bytes().replace(b"\r\n", b"\n")).hexdigest()
    assert manifest["definition_sha256"] == sha  # the definition is unchanged since the frozen run
    assert definition["status"] == "frozen" and manifest["frozen"] is True
    assert manifest["run_id"] == definition["frozen"]["run_id"]
    assert manifest["algorithm_version"] == ALGORITHM_VERSION
    assert manifest["dirty"] is False and len(manifest["commit"]) == 40  # made from a clean commit
    assert manifest["reference_id"] == "GR-001" and len(manifest["sites"]) == 3


def test_every_committed_bundle_is_the_one_the_manifest_hashed(frozen):
    manifest, bundles = frozen
    for s in manifest["sites"]:
        raw = (RECORD / s["bundle"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == s["bundle_sha256"], s["bundle"]
        b = bundles[s["bundle"]]
        assert b["run_id"] == s["site_run_id"] and b["result_id"] == s["site_result_id"]
        assert b["horizon"]["payload_sha256"] == s["horizon_payload_sha256"]
        assert {t: g["raw_sha256"] for t, g in b["geometry"].items()} == s["geometry_raw_sha256"]


def test_the_frozen_record_passes_gate_2_s_five_checks(frozen):
    _, bundles = frozen
    rep = gate_report(list(bundles.values()))
    assert rep["passes"] is True, [(g["gate"], g["status"], g["failing"][:3]) for g in rep["gates"] if g["status"] != "pass"]
    assert [g["status"] for g in rep["gates"]] == ["pass"] * 5
    for b in bundles.values():
        assert readiness(b)["ready"] is True


def test_the_frozen_record_never_claims_to_be_validated(frozen):
    manifest, bundles = frozen
    for b in bundles.values():
        assert b["result_state"] == "real_data_unverified" and b["verified"] is False and b["validated_scopes"] == []
        assert b["request"]["site"]["site_id"].startswith("rule-")  # the declared reference scenario, not candidate sites
    assert manifest["gates"]["passes"] is True


def test_the_run_record_is_what_the_report_script_writes_from_these_bundles(frozen, tmp_path, monkeypatch):
    """docs/runs/GR-001-run.md is generated, never typed: regenerate it and compare."""
    spec = importlib.util.spec_from_file_location("reference_report", ROOT / "science" / "scripts" / "reference_report.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["reference_report"] = mod
    spec.loader.exec_module(mod)
    out = tmp_path / "GR-001-run.md"
    monkeypatch.setattr(sys, "argv", ["reference_report.py", str(RECORD), "--out", str(out)])
    assert mod.main() == 0
    committed = (ROOT / "docs" / "runs" / "GR-001-run.md").read_bytes().replace(b"\r\n", b"\n")
    assert out.read_bytes().replace(b"\r\n", b"\n") == committed
