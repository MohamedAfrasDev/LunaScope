"""Diagnostic (post hoc, does not change any gate): compare our fractions with the published map pixel by pixel
around one site, to see whether a disagreement at the site is a resolution effect.

  python scripts/illumination_patch_diagnostic.py <lat> <lon_east>
Computes our upper-limb fraction at the centres of the 3 x 3 map pixels around the site and prints them beside the map.
"""
from __future__ import annotations

import math
import sys

import numpy as np
import rasterio
import spiceypy as sp
from illumination_check import EARTH_MAP, MAPS, SUN_MAP, series, skyline

from lunascope.dem import REPO
from lunascope.illumination_check import (
    EARTH_RADIUS_KM,
    HOURS_18_6_YEARS,
    SPHERE_M,
    SUN_RADIUS_KM,
    fractions,
    stereographic_xy,
)
from lunascope.pipeline import RunConfig, SiteSpec
from lunascope.providers.geometry.spice import KernelSet
from lunascope.stacks import ServiceConfig, build_stack


def xy_to_latlon(x: float, y: float) -> tuple[float, float]:
    rho = math.hypot(x, y)
    return -90.0 + math.degrees(2 * math.atan(rho / (2 * SPHERE_M))), math.degrees(math.atan2(x, y)) % 360.0


def main() -> int:
    lat, lon = float(sys.argv[1]), float(sys.argv[2])
    KernelSet().load()
    ets = sp.str2et("2026-01-01 00:00:00 UTC") + np.arange(HOURS_18_6_YEARS) * 3600.0
    stack, _ = build_stack(ServiceConfig(data_dir=REPO / "var", stack_kind="live"), "lola-80s-20m-adj")
    from datetime import UTC, datetime
    cfg = RunConfig(start_utc=datetime(2026, 1, 1, tzinfo=UTC))
    with rasterio.open(MAPS / SUN_MAP) as s_ds, rasterio.open(MAPS / EARTH_MAP) as e_ds:
        r0, c0 = s_ds.index(*stereographic_xy(lat, lon))
        print("row,col  lat  lon | sun ours/map | earth ours/map")
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                x, y = s_ds.xy(r0 + dr, c0 + dc)
                la, lo = xy_to_latlon(x, y)
                site = SiteSpec(f"patch-{la:.4f}-{lo:.4f}", la, lo, "rule")
                obs, prof, _ = skyline(site, 0.0, stack, cfg)
                out = []
                for body, rad_km, ds in (("SUN", SUN_RADIUS_KM, s_ds), ("EARTH", EARTH_RADIUS_KM, e_ds)):
                    az, el, rad = series(obs, ets, body, rad_km)
                    ours = fractions(az, el, rad, prof.lookup)["upper_limb"]
                    theirs = float(ds.read(1, window=((r0 + dr, r0 + dr + 1), (c0 + dc, c0 + dc + 1)))[0, 0]) * ds.scales[0]
                    out.append((ours, theirs))
                print(f"{dr:+d},{dc:+d}  {la:.4f} {lo:.3f} | {out[0][0]:.3f}/{out[0][1]:.3f} | {out[1][0]:.3f}/{out[1][1]:.3f}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
