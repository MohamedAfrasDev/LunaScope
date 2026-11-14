"""Offline fallback (test case 16, phase plan 3.2): replay mode needs no network and no data files,
and the rehearsal's network guard really does block."""

import importlib.util
import json
import socket
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from lunascope.main import create_app
from lunascope.reference import load_definition
from lunascope.stacks import ServiceConfig

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "build_fallback.py"
spec = importlib.util.spec_from_file_location("build_fallback", SCRIPT)
fb = importlib.util.module_from_spec(spec)
sys.modules["build_fallback"] = fb
spec.loader.exec_module(fb)


def test_the_guard_blocks_anything_that_leaves_the_machine_and_records_it():
    with fb._NoNetwork() as net:
        with pytest.raises(OSError, match="switched off"):
            socket.create_connection(("example.com", 80), timeout=1)
        with pytest.raises(OSError, match="switched off"):
            socket.getaddrinfo("ssd.jpl.nasa.gov", 443)
        with pytest.raises(OSError, match="switched off"):
            socket.socket().connect(("93.184.216.34", 80))
        assert len(net.calls) == 3
        socket.getaddrinfo("localhost", 80)  # loopback stays open
        assert len(net.calls) == 3
    socket.getaddrinfo("localhost", 80)  # and the guard is removed afterwards


def test_a_live_stack_in_replay_mode_needs_no_dem_no_kernels_and_no_network(tmp_path):
    cfg = ServiceConfig(data_dir=tmp_path, stack_kind="live", mode="replay",
                        raw_dir=tmp_path / "no-dem-here", kernel_dir=tmp_path / "no-kernels-here")
    with fb._NoNetwork() as net, TestClient(create_app(cfg)) as c:
        h = c.get("/api/v1/health").json()
        assert h["mode"] == "replay" and h["stack"] == "live" and h["result_state"] == "real_data_unverified"
        assert h["resources_ok"] is False  # said honestly: the data files are not here
        assert c.get("/api/v1/references/GR-001").status_code == 200
        r = c.post("/api/v1/analyses", content=json.dumps(load_definition("GR-001")["request"]))
        assert r.status_code == 409 and r.json()["error"]["code"] == "REPLAY_ONLY"  # not packaged: refused, not computed
    assert net.calls == []


def test_check_rejects_a_package_whose_artifact_was_altered(tmp_path):
    pkg = tmp_path / "pkg"
    (pkg / "data").mkdir(parents=True)
    (pkg / "FALLBACK-MANIFEST.json").write_text(json.dumps({"stack": "synthetic", "runs": [
        {"name": "GR-001", "run_id": "a" * 64, "kind": "reference", "analysis_artifact_sha256": "b" * 64}]}))
    assert fb.check(pkg, None) == 1  # the run is not in the store: not ready


def test_a_package_can_hold_a_dates_search_and_check_serves_it_offline(tmp_path):
    out = tmp_path / "pkg"
    assert fb.build("synthetic", out, 5, 600.0, None, 2) == 0
    man = json.loads((out / "FALLBACK-MANIFEST.json").read_text(encoding="utf-8"))
    assert man["search"]["to_days"] == 2
    kinds = [r["kind"] for r in man["runs"]]
    assert kinds.count("search_date") >= 1 and "date_shift" in kinds  # +5 d is shared, never duplicated
    assert len({r["run_id"] for r in man["runs"]}) == len(man["runs"])
    assert fb.check(out, None) == 0
    # a check must be able to fail: a manifest pointing at a search the package never held is not ready
    man["search"]["search_id"] = "0" * 32
    (out / "FALLBACK-MANIFEST.json").write_text(json.dumps(man), encoding="utf-8")
    assert fb.check(out, None) == 1
