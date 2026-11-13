"""Skyline difference between the two pinned DEM releases (ADJ vs PDS) at many sites (phase plan 1.6).

Sites: the three RUN-001 rule points plus a spread of other south-polar points (rule-chosen, NOT
candidate recommendations). Same observer height, radius and azimuth step for both releases.
Usage: python scripts/dem_release_comparison.py [--step 0.1] [--radius 150]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

from lunascope.dem import RAW, REPO, DemTerrain, GeoTiffSource, PdsImgSource
from lunascope.horizon import HorizonSettings, compute_horizon
from lunascope.observer import build_observer

SITES = [(-89.5, 0.0), (-89.5, 120.0), (-89.5, 240.0), (-89.0, 45.0), (-89.0, 200.0),
         (-88.0, 90.0), (-88.0, 300.0), (-87.0, 10.0), (-87.0, 170.0), (-86.0, 250.0)]
OUT = REPO / "docs" / "sdr" / "evidence" / "dem_release_comparison.json"


def skyline(src, rid: str, lat: float, lon: float, radius: float, step: float):
    t = DemTerrain(src, center_lat_deg=lat, center_lon_east_deg=lon, radius_km=radius, resource_id=rid)
    g = t.ground_height_m(lat, lon)
    o = build_observer(site_id="x", lat_deg=lat, lon_deg=lon, convention="planetocentric",
                       lon_direction="east_positive", reference_radius_km=1737.4, ground_height_m=g,
                       ground_height_source="dem", observer_height_above_ground_m=2.0)
    return compute_horizon(o, t, HorizonSettings(radius_km=radius, az_step_deg=step)), g


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--step", type=float, default=0.1)
    ap.add_argument("--radius", type=float, default=150.0)
    a = ap.parse_args()
    adj = GeoTiffSource(RAW / "LDEM_80S_20MPP_ADJ.TIF")
    pds = PdsImgSource(RAW / "LDEM_80S_20M.IMG")
    rows = []
    for lat, lon in SITES:
        t0 = time.time()
        pa, ga = skyline(adj, "dem-lola-80s-20mpp-adj", lat, lon, a.radius, a.step)
        pp, gp = skyline(pds, "dem-pds-ldem-80s-20m", lat, lon, a.radius, a.step)
        d = np.abs(pa.horizon_el_deg - pp.horizon_el_deg)
        ok = np.isfinite(d)
        rows.append({"lat": lat, "lon_east": lon, "ground_adj_m": ga, "ground_pds_m": gp,
                     "certified_sectors": int((pa.sector_state == 0).sum()), "sectors": len(d),
                     "max_diff_deg": float(d[ok].max()), "rms_diff_deg": float(np.sqrt((d[ok] ** 2).mean())),
                     "frac_gt_0.01": float((d[ok] > 0.01).mean()), "frac_gt_0.1": float((d[ok] > 0.1).mean()),
                     "skyline_max_deg": float(np.nanmax(pa.horizon_el_deg)), "seconds": round(time.time() - t0, 1)})
        print(json.dumps(rows[-1]), flush=True)
    worst = max(r["max_diff_deg"] for r in rows)
    out = {"step_deg": a.step, "radius_km": a.radius, "sites": rows, "worst_max_diff_deg": worst,
           "median_rms_diff_deg": float(np.median([r["rms_diff_deg"] for r in rows]))}
    Path(OUT).write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in out.items() if k != "sites"}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
