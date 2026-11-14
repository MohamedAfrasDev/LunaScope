"""Compare the production skyline with the independent pixel-driven skyline, per GR-001 site.

  python scripts/independent_check.py [bundle-dir (default docs/runs/GR-001)] [--write]

Reads each saved site bundle (its stored skyline, observer, DEM identity), recomputes the skyline with
lunascope.independent_horizon from the raw DEM, compares them against the thresholds that were declared in
that module before the first real comparison, and (with --write) records the evidence at
data/validation/independent_skyline/<skyline payload sha256>.json. The validation card reads that file;
it re-derives the verdict itself and never trusts a verdict stored in the file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np

from lunascope import ALGORITHM_VERSION
from lunascope.canonical import canonical_bytes
from lunascope.dem import REPO, GeoTiffSource, PdsImgSource
from lunascope.independent_horizon import (
    FIRST_ATTEMPT_V1,
    INDEPENDENT_ALGORITHM,
    NEAR_FIELD_KM,
    SLOPE_DEG,
    THRESHOLDS,
    compare,
    evaluate,
    independent_skyline,
)

SOURCES = {"geotiff": (GeoTiffSource, "LDEM_80S_20MPP_ADJ.TIF"), "pds_img": (PdsImgSource, "LDEM_80S_20M.IMG")}
OUT = REPO / "data" / "validation" / "independent_skyline"


def check_bundle(path: Path) -> dict:
    b = json.loads(path.read_text(encoding="utf-8"))
    h, o = b["horizon"], b["observer"]
    ident = h["terrain_identity"]
    cls, fname = SOURCES[ident["source"]]
    src = cls(REPO / "data" / "raw" / fname)
    n_az = len(h["horizon_el_deg"])
    t0 = time.time()
    r = independent_skyline(src.window, lat_deg=o["lat_deg"], lon_east_deg=o["lon_deg_east"],
                            ground_m=o["ground_height_m"], mast_m=o["observer_height_above_ground_m"],
                            radius_km=h["settings"]["radius_km"], n_az=n_az, envelope=True)
    secs = time.time() - t0
    ray = np.array(h["horizon_el_deg"], float)
    certified = np.array(h["sector_state"]) == "certified"
    ray = np.where(certified, ray, np.nan)
    m = compare(ray, r["skyline_el_deg"], ind_inclusive_el_deg=r["inclusive_el_deg"],
                ray_argmax_km=np.array(h["argmax_distance_km"], float), ind_argmax_km=r["nearest_argmax_km"],
                envelope_el_deg=r["envelope_el_deg"])
    verdict = evaluate(m)
    return {
        "schema": "lunascope.independent_skyline_check/1",
        "subject": {"site_id": o["site_id"], "payload_sha256": h["payload_sha256"], "cache_key": h["cache_key"],
                    "settings": h["settings"], "algorithm": b["algorithm_id"]},
        "dem": {"resource_id": ident["resource_id"], "sha256": ident["sha256"], "product_id": ident["product_id"]},
        "independent": {"algorithm": INDEPENDENT_ALGORITHM, "pixels_used": r["pixels_used"],
                        "near_field_km": NEAR_FIELD_KM, "slope_deg": SLOPE_DEG, "seconds": round(secs, 1),
                        "code_sha256": hashlib.sha256((REPO / "science" / "lunascope" / "independent_horizon.py")
                                                      .read_bytes()).hexdigest()},
        "thresholds": {k: list(v) for k, v in THRESHOLDS.items()}, "first_attempt_v1": FIRST_ATTEMPT_V1, "metrics": m, "verdict_when_recorded": verdict,
        "service_algorithm": ALGORITHM_VERSION,
        "scope": ("Tests the skyline COMPUTATION (traversal, sampling, geometry, code) against a second "
                  "implementation. It reads the same DEM bytes and assumes the same stated grid, so it is "
                  "not a check of the DEM and not a validation of the science."),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("bundles", nargs="?", default=str(REPO / "docs" / "runs" / "GR-001"))
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    files = sorted(p for p in Path(a.bundles).glob("*.json") if p.name != "manifest.json")
    bad = 0
    for p in files:
        ev = check_bundle(p)
        m, v = ev["metrics"], ev["verdict_when_recorded"]
        print(f"{ev['subject']['site_id']}: {'MET' if v['met'] else 'NOT MET'}  median {m['median_abs_deg']:.4f}  "
              f"p99 {m['p99_abs_deg']:.4f}  max {m['max_abs_deg']:.3f}  within-tol {m['within_tolerance_fraction']:.4f}  "
              f"max-ratio {m['max_tolerance_ratio']:.2f}  ray-above-incl {m['ray_above_inclusive_deg']:.4f}  "
              f"near-field {m['near_field_sectors']}  shift {m['best_shift_sectors']}  "
              f"between-ray relief max {m.get('between_ray_relief_max_deg', float('nan')):.3f}  ({ev['independent']['seconds']} s)",
              flush=True)
        if not v["met"]:
            bad += 1
            print("   failed:", [k for k, ok in v["checks"].items() if not ok])
        if a.write:
            OUT.mkdir(parents=True, exist_ok=True)
            (OUT / f"{ev['subject']['payload_sha256']}.json").write_bytes(canonical_bytes(ev))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
