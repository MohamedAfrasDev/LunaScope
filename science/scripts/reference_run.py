"""Run or check a golden reference run (GR-001 ...) on the LIVE stack.

  python scripts/reference_run.py identity GR-001        run_id the definition gets now; freeze check
  python scripts/reference_run.py run GR-001 [--no-convergence]
  python scripts/reference_run.py check <bundle-dir>     readiness of saved site bundles (case 13)
  python scripts/reference_run.py gate <bundle-dir>      Gate 2's five checks over saved site bundles

`run` uses live JPL Horizons (cached verbatim), the pinned LOLA DEMs and SPICE. A DRAFT definition
writes to var/reference/<id>/ only; a frozen one writes to docs/runs/<id>/ and refuses to run if
its inputs no longer give the pinned run_id (freeze rule). Each site gets the sensitivity variants
and the convergence report (step, azimuth, radius); unstable cases are marked SENSITIVITY_HIGH.
A manifest records the commit, algorithm version and every checksum.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

from lunascope import ALGORITHM_VERSION
from lunascope.api_models import resolve_sites, to_run_config
from lunascope.canonical import sha256_hex
from lunascope.dem import REPO
from lunascope.pipeline import run_with_sensitivity, save_bundle
from lunascope.reference import (
    CONVERGENCE_CASES,
    apply_convergence,
    check_freeze,
    convergence_report,
    definition_request,
    gate_report,
    load_definition,
    readiness,
)
from lunascope.stacks import ServiceConfig, build_stack


def _git(*args: str) -> str:
    r = subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, check=False)
    return r.stdout.strip()


def live_cfg() -> ServiceConfig:
    return ServiceConfig(data_dir=REPO / "var", stack_kind="live")


def cmd_identity(ref_id: str) -> int:
    d = load_definition(ref_id)
    print(json.dumps(check_freeze(d, live_cfg()), indent=1))
    return 0


def cmd_run(ref_id: str, convergence: bool) -> int:
    d = load_definition(ref_id)
    cfg = live_cfg()
    freeze = check_freeze(d, cfg)  # raises FreezeViolation for a changed frozen definition
    out = (REPO / "docs" / "runs" / ref_id) if freeze["frozen"] else (REPO / "var" / "reference" / ref_id)
    if _git("status", "--porcelain", "--", "science", "data"):
        print("WARNING: science/ or data/ has uncommitted changes; the recorded commit will not reproduce this")
    req = definition_request(d)
    run_cfg, sites = to_run_config(req), resolve_sites(req)
    stack, alt = build_stack(cfg, req.terrain.dem_profile)
    stack = stack.replace(horizon_dir=REPO / "var" / "horizons")
    manifest = {"reference_id": ref_id, "definition_status": d["status"], "frozen": freeze["frozen"],
                "run_id": freeze["run_id"], "commit": _git("rev-parse", "HEAD"),
                "dirty": bool(_git("status", "--porcelain")), "algorithm_version": ALGORITHM_VERSION,
                "definition_sha256": sha256_hex((REPO / "data" / "reference" / f"{ref_id}.json").read_bytes()),
                "resources": stack.extra_resources, "sites": []}
    saved = []
    for site in sites:
        t0 = time.time()
        b = run_with_sensitivity(site, run_cfg, stack, alt_terrain_factory=alt)
        if convergence:
            apply_convergence(b, convergence_report(site, run_cfg, stack, base=b, cases=CONVERGENCE_CASES))
        rep = readiness(b, horizon_dir=stack.horizon_dir)
        saved.append(b)
        path = save_bundle(b, out)
        manifest["sites"].append({
            "site_id": site.site_id, "site_run_id": b["run_id"], "site_result_id": b["result_id"],
            "bundle": path.name, "bundle_sha256": sha256_hex(path.read_bytes()),
            "horizon_payload_sha256": b["horizon"]["payload_sha256"],
            "geometry_raw_sha256": {t: g["raw_sha256"] for t, g in b["geometry"].items()},
            "warnings": b["warnings"], "ready": rep["ready"], "seconds": round(time.time() - t0, 1),
            "sensitivity_high": b.get("convergence", {}).get("sensitivity_high", [])})
        print(f"{site.site_id}: {b['site_status']} ready={rep['ready']} warnings={b['warnings']} -> {path.name}")
    manifest["gates"] = gate_report(saved, horizon_dir=stack.horizon_dir)
    print("gates:", {g["gate"]: g["status"] for g in manifest["gates"]["gates"]},
          "PASSES" if manifest["gates"]["passes"] else "does not pass")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(REPO)}")
    return 0


def cmd_gate(directory: str) -> int:
    """Gate 2 over saved site bundles: five named checks, exit 0 only if every one passes."""
    bundles = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(Path(directory).glob("*.json"))
               if p.name != "manifest.json"]
    rep = gate_report(bundles, horizon_dir=REPO / "var" / "horizons")
    for g in rep["gates"]:
        print(f"{g['status'].upper():14s} {g['gate']:13s} {g['detail']}")
        for f in g["failing"][:20]:
            print(f"               - {f}")
    print(f"\n{len(bundles)} site bundle(s): {'GATE 2 CHECKS PASS' if rep['passes'] else 'GATE 2 CHECKS DO NOT PASS'}")
    return 0 if rep["passes"] else 1


def cmd_check(directory: str) -> int:
    ok = True
    for p in sorted(Path(directory).glob("*.json")):
        if p.name == "manifest.json":
            continue
        rep = readiness(json.loads(p.read_text(encoding="utf-8")))
        ok &= rep["ready"]
        print(f"{p.name}: {'READY' if rep['ready'] else 'NOT READY'}")
        for c in rep["failing"]:
            print(f"   {c['status']:12s} {c['check']}: {c['detail']}")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("identity").add_argument("ref_id")
    r = sub.add_parser("run")
    r.add_argument("ref_id")
    r.add_argument("--no-convergence", action="store_true")
    sub.add_parser("check").add_argument("directory")
    sub.add_parser("gate").add_argument("directory")
    a = ap.parse_args()
    if a.cmd == "identity":
        return cmd_identity(a.ref_id)
    if a.cmd == "run":
        return cmd_run(a.ref_id, not a.no_convergence)
    if a.cmd == "gate":
        return cmd_gate(a.directory)
    return cmd_check(a.directory)


if __name__ == "__main__":
    sys.exit(main())
