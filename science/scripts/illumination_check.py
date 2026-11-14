"""Compare our long-term sunlit and Earth-visible fractions with NASA's published LOLA illumination maps.

  python scripts/illumination_check.py [--hours N] [--sites A|B]

Needs the two maps in data/raw/illumination/ (AVGVISIB_85S_060M_201608.TIF and ..._EARTH.TIF), the pinned LOLA
DEM and the SPICE kernels. Gates are declared in lunascope/illumination_check.py before this was run.
Writes docs/runs/evidence/illumination-vs-map.json and prints a table.
"""

from __future__ import annotations

import argparse
import gc
import hashlib
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import rasterio
import spiceypy as sp

from lunascope import ALGORITHM_VERSION
from lunascope.canonical import canonical_bytes
from lunascope.dem import REPO
from lunascope.horizon import HorizonProfile, HorizonSettings, compute_horizon
from lunascope.illumination_check import (
    EARTH_RADIUS_KM,
    HOURS_18_6_YEARS,
    SITES_B,
    SUN_RADIUS_KM,
    evaluate_set_a,
    evaluate_set_b,
    fractions,
    map_values,
)
from lunascope.observer import az_el, build_observer
from lunascope.pipeline import RunConfig, SiteSpec
from lunascope.providers.geometry.spice import FRAME, KernelSet
from lunascope.stacks import ServiceConfig, build_stack

MAPS = REPO / "data" / "raw" / "illumination"
SUN_MAP, EARTH_MAP = "AVGVISIB_85S_060M_201608.TIF", "AVGVISIB_85S_060M_201608_EARTH.TIF"
OUT = REPO / "docs" / "runs" / "evidence" / "illumination-vs-map.json"
CACHE = REPO / "var" / "illum_cache"
START = datetime(2026, 1, 1, tzinfo=UTC)


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        while b := f.read(8 << 20):
            h.update(b)
    return h.hexdigest()


def skyline(site: SiteSpec, mast_m: float, stack, cfg: RunConfig):
    """Ground-level skyline from the production engine, cached on disk per site and mast height.

    The 894 MB DEM window is only loaded when the skyline is not cached, and released straight after."""
    cache = CACHE / f"{site.site_id}_mast{mast_m:g}.npz"
    hs = HorizonSettings(radius_km=cfg.radius_km, az_step_deg=cfg.az_step_deg)
    if not cache.exists():
        terrain, ground = stack.terrain_factory(site, cfg)
        obs = _observer(site, ground, terrain.identity, mast_m)
        prof = compute_horizon(obs, terrain, hs)
        CACHE.mkdir(parents=True, exist_ok=True)
        np.savez(cache, az=prof.azimuth_deg, el=prof.horizon_el_deg, arg=prof.argmax_distance_km,
                 state=prof.sector_state, ground=ground, identity=json.dumps(terrain.identity, sort_keys=True))
        del terrain, prof
        gc.collect()
    z = np.load(cache)
    identity = json.loads(str(z["identity"]))
    ground = float(z["ground"])
    obs = _observer(site, ground, identity, mast_m)
    return obs, HorizonProfile(z["az"], z["el"], z["arg"], z["state"], hs, obs.digest(), identity), ground


def _observer(site: SiteSpec, ground: float, identity: dict, mast_m: float):
    return build_observer(site_id=site.site_id, lat_deg=site.lat_deg, lon_deg=site.lon_east_deg,
                          convention="planetocentric", lon_direction="east_positive", reference_radius_km=1737.4,
                          ground_height_m=ground, ground_height_source=json.dumps(identity, sort_keys=True),
                          observer_height_above_ground_m=mast_m)


def series(obs, ets: np.ndarray, body: str, radius_km: float):
    """Hourly azimuth, elevation and angular radius of Sun or Earth centre (SPICE spkcpo, LT+S, MOON_ME)."""
    pos = list(obs.position_km)
    v = np.empty((len(ets), 3))
    for i, et in enumerate(ets):
        state, _ = sp.spkcpo(body, float(et), FRAME, "OBSERVER", "LT+S", pos, "MOON", FRAME)
        v[i] = state[:3]
    az, el = az_el(v, obs)
    rad = np.degrees(np.arcsin(radius_km / np.linalg.norm(v, axis=-1)))
    return az, el, rad


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=int, default=HOURS_18_6_YEARS)
    ap.add_argument("--sites", choices=("A", "B"), default="B")
    a = ap.parse_args()
    sites = SITES_B[:3] if a.sites == "A" else SITES_B
    ks = KernelSet()
    ks.load()
    et0 = sp.str2et("2026-01-01 00:00:00 UTC")
    ets = et0 + np.arange(a.hours) * 3600.0
    stack, _ = build_stack(ServiceConfig(data_dir=REPO / "var", stack_kind="live"), "lola-80s-20m-adj")
    cfg = RunConfig(start_utc=START)
    rows = []
    with rasterio.open(MAPS / SUN_MAP) as sun_ds, rasterio.open(MAPS / EARTH_MAP) as earth_ds:
        for lat, lon in sites:
            t0 = time.time()
            site = SiteSpec(f"illum-{lat:g}-E{lon:g}", lat, lon, "rule")
            row = {"site_id": site.site_id, "lat_deg": lat, "lon_east_deg": lon}
            for mast in ((0.0, 2.0) if (lat, lon) in SITES_B[:3] else (0.0,)):  # 2 m only for the GR-001 sites
                obs, prof, ground = skyline(site, mast, stack, cfg)
                row["ground_height_m"] = ground
                for key, body, radius, ds in (("sun", "SUN", SUN_RADIUS_KM, sun_ds), ("earth", "EARTH", EARTH_RADIUS_KM, earth_ds)):
                    if mast == 0.0:
                        az, el, rad = series(obs, ets, body, radius)
                        row.setdefault("_series", {})[key] = (az, el, rad)
                    az, el, rad = row["_series"][key]
                    f = fractions(az, el, rad, prof.lookup)
                    if mast == 0.0:
                        row[key] = {"map": map_values(ds, lat, lon), "ours_detail": f, "ours": f["upper_limb"]}
                    else:
                        row[key]["ours_with_2m_mast"] = f["upper_limb"]
            del row["_series"]
            rows.append(row)
            print(f"{site.site_id}: sun ours {row['sun']['ours']:.3f} map {row['sun']['map']['pixel']:.3f} | "
                  f"earth ours {row['earth']['ours']:.3f} map {row['earth']['map']['pixel']:.3f}  ({time.time() - t0:.0f} s)",
                  flush=True)
    res = {"schema": "lunascope.illumination_vs_map/1", "service_algorithm": ALGORITHM_VERSION,
           "reference": {"product": "NASA GSFC PGDA Lunar Polar Illumination: AVGVISIB_85S_060M_201608 (Sun) and _EARTH",
                         "citation": "Mazarico et al. 2011, Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030",
                         "files": {SUN_MAP: sha256_file(MAPS / SUN_MAP), EARTH_MAP: sha256_file(MAPS / EARTH_MAP)}},
           "method": {"hours": a.hours, "start_utc": "2026-01-01T00:00:00Z", "step_s": 3600, "geometry": "SPICE spkcpo LT+S MOON_ME",
                      "visibility": "upper limb above skyline (any part of the disc)", "observer_height_m": 0.0,
                      "skyline": "production engine, pinned 20 m LOLA DEM, 150 km, 0.1 deg",
                      "gates_module_sha256": hashlib.sha256((REPO / "science" / "lunascope" / "illumination_check.py").read_bytes()).hexdigest()},
           "sites": rows}
    if a.sites == "A" or len(rows) >= 3:
        res["set_a"] = evaluate_set_a(rows[:3])
    if a.sites == "B":
        res["set_b"] = evaluate_set_b(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(canonical_bytes(res))
    for k in ("set_a", "set_b"):
        if k in res:
            print(k, "MET" if res[k]["met"] else "NOT MET", json.dumps(res[k].get("stats", res[k]["checks"]), default=float)[:400])
    return 0


if __name__ == "__main__":
    sys.exit(main())
