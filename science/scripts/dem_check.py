"""DEM preprocessing check (phase plan 1.6): checksum, metadata, coordinate round-trip, cross-product.

Nothing is rewritten: the DEMs are read in place (GeoTIFF window / memmap), so "preprocessing" here
means proving the files are the ones we pinned and that our grid convention reproduces them.

Checks (exit 0 only if all pass):
  1. SHA-256 of each file against its manifest pin
  2. grid size, geotransform (pixel-is-area corner transform) and PDS label constants
  3. round trip: pixel centre -> (x, y) -> unit vector -> stereographic_xy -> same pixel, < 1e-6 m
  4. DemTerrain at a pixel centre returns that pixel's stored value (convention, not interpolation)
  5. ADJ and PDS agree in a window around the pole (RMS below 5 m; 13 Nov full-extent RMS was 1.76 m)
Usage: python scripts/dem_check.py [--no-hash]
"""

from __future__ import annotations

import argparse
import re
import sys

import numpy as np
import rasterio

from lunascope.dem import (
    HALF,
    PIX,
    RAW,
    DemTerrain,
    GeoTiffSource,
    N,
    PdsImgSource,
    manifest,
    sha256_file,
    stereographic_xy,
)

ADJ, PDS = "LDEM_80S_20MPP_ADJ.TIF", "LDEM_80S_20M.IMG"
results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)


def unit_from_xy(x: np.ndarray, y: np.ndarray, r: float = 1_737_400.0) -> np.ndarray:
    """Inverse south-polar stereographic. x = rho*qy/h, y = rho*qx/h as in stereographic_xy."""
    rho = np.hypot(x, y)
    qz = (rho**2 - 4 * r * r) / (rho**2 + 4 * r * r)  # south pole: rho -> 0 gives qz = -1
    h = np.sqrt(np.clip(1 - qz**2, 0, None))
    safe = np.where(rho > 0, rho, 1.0)
    return np.stack([h * y / safe, h * x / safe, qz], axis=-1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-hash", action="store_true")
    a = ap.parse_args()
    for rid, fn in (("dem-lola-80s-20mpp-adj", ADJ), ("dem-pds-ldem-80s-20m", PDS)):
        if not a.no_hash:
            check(f"sha256 {fn}", sha256_file(RAW / fn) == manifest(rid)["sha256"])
    with rasterio.open(RAW / ADJ) as ds:
        t = ds.transform
        check("ADJ grid 30400x30400", (ds.width, ds.height) == (N, N))
        check("ADJ pixel-is-area corner transform", (t.a, t.e, t.c, t.f) == (PIX, -PIX, -HALF, HALF))
        wkt = ds.crs.to_wkt() if ds.crs else ""
        check("ADJ sphere radius 1737400 m, polar stereographic", "1737400" in wkt and "tereographic" in wkt)
        check("ADJ declares area registration", ds.tags().get("AREA_OR_POINT") == "Area")
    lbl = (RAW / "LDEM_80S_20M.LBL").read_text(errors="replace")
    num = lambda k: float(re.search(rf"{k}\s*=\s*([-\d.]+)", lbl).group(1))
    check("PDS label: 30400 lines/samples", num("LINES") == N and num("LINE_SAMPLES") == N)
    check("PDS label: scaling 0.5 m, offset 1737400 m", num("SCALING_FACTOR") == 0.5 and num("OFFSET") == 1737400.0)

    rng = np.random.default_rng(0)
    rows, cols = rng.integers(0, N, 20000), rng.integers(0, N, 20000)
    x, y = -HALF + PIX * (cols + 0.5), HALF - PIX * (rows + 0.5)
    q = unit_from_xy(x, y)
    x2, y2 = stereographic_xy(q)
    err = float(np.hypot(x2 - x, y2 - y).max())
    check("pixel-centre round trip", err < 1e-6, f"max error {err:.2e} m over 20000 pixels")

    adj, pds = GeoTiffSource(RAW / ADJ), PdsImgSource(RAW / PDS)
    lat0, lon0 = -89.5, 0.0
    terr = DemTerrain(adj, center_lat_deg=lat0, center_lon_east_deg=lon0, radius_km=2.0, resource_id="dem-lola-80s-20mpp-adj")
    r0, r1, c0, c1 = terr.win.r0, terr.win.r1, terr.win.c0, terr.win.c1
    ri, ci = rng.integers(r0 + 2, r1 - 2, 300), rng.integers(c0 + 2, c1 - 2, 300)
    qq = unit_from_xy(-HALF + PIX * (ci + 0.5), HALF - PIX * (ri + 0.5))
    got = terr.elevation_m(qq)
    want = terr.data[ri - r0, ci - c0]
    check("terrain at a pixel centre equals the stored pixel", float(np.nanmax(np.abs(got - want))) < 1e-3,
          f"max diff {float(np.nanmax(np.abs(got - want))):.2e} m")
    w = 400
    ra = adj.window(N // 2 - w, N // 2 + w, N // 2 - w, N // 2 + w)
    rp = pds.window(N // 2 - w, N // 2 + w, N // 2 - w, N // 2 + w)
    rms = float(np.sqrt(np.nanmean((ra - rp) ** 2)))
    check("ADJ vs PDS around the pole", rms < 5.0, f"RMS {rms:.2f} m over {2 * w}x{2 * w} pixels")
    bad = [n for n, ok, _ in results if not ok]
    print("ALL PASS" if not bad else f"FAILED: {bad}")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
