"""Phase 0 studies D-02/D-05/D-09: skyline convergence in azimuth step and sensitivity to site position."""
import json
import math
import sys
import time

import numpy as np

from lunascope.dem import RAW, DemTerrain, GeoTiffSource
from lunascope.horizon import HorizonSettings, compute_horizon
from lunascope.observer import build_observer

SITES = [("E0", -89.5, 0.0), ("E120", -89.5, 120.0), ("E240", -89.5, 240.0)]
STEPS = [0.2, 0.1, 0.05, 0.025]
SHIFTS_M = [0.53, 5.0, 20.0, 100.0]
out = {}


def stats(a, b, n):
    az = np.arange(n) * 360.0 / n
    d = np.abs(a.lookup(az) - b.lookup(az))
    d = d[np.isfinite(d)]
    return {"max": float(d.max()), "p99": float(np.percentile(d, 99)), "p90": float(np.percentile(d, 90)),
            "frac_gt_0.01": float((d > 0.01).mean()), "frac_gt_0.1": float((d > 0.1).mean())}


def obs_at(lat, lon, ground):
    return build_observer(site_id="s", lat_deg=lat, lon_deg=lon, convention="planetocentric",
                          lon_direction="east_positive", reference_radius_km=1737.4, ground_height_m=ground,
                          ground_height_source="adj", observer_height_above_ground_m=2.0)


for name, lat, lon in SITES:
    t0 = time.time()
    dem = DemTerrain(GeoTiffSource(RAW / "LDEM_80S_20MPP_ADJ.TIF"), center_lat_deg=lat, center_lon_east_deg=lon,
                     radius_km=152.0, resource_id="dem-lola-80s-20mpp-adj")
    g = dem.ground_height_m(lat, lon)
    base_obs = obs_at(lat, lon, g)
    res = {"ground_m": g, "convergence": {}, "shift": {}}
    profs = {}
    for st in STEPS:
        profs[st] = compute_horizon(base_obs, dem, HorizonSettings(radius_km=150.0, az_step_deg=st))
        print(name, "step", st, "done", round(time.time() - t0), "s", flush=True)
    for coarse, fine in zip(STEPS, STEPS[1:], strict=False):
        res["convergence"][f"{coarse}->{fine}"] = stats(profs[coarse], profs[fine], 28800)
    # position sensitivity at the 0.1 degree step, shifting east and north along the surface
    e, n, u = base_obs.enu
    pos = base_obs.position_km
    for d in SHIFTS_M:
        for label, vec in (("east", e), ("north", n)):
            p = pos + vec * d / 1000.0
            p = p / np.linalg.norm(p)
            la = math.degrees(math.asin(p[2]))
            lo = math.degrees(math.atan2(p[1], p[0])) % 360.0
            g2 = dem.ground_height_m(la, lo)
            prof = compute_horizon(obs_at(la, lo, g2), dem, HorizonSettings(radius_km=150.0, az_step_deg=0.1))
            res["shift"][f"{label}_{d}m"] = {**stats(profs[0.1], prof, 7200), "ground_delta_m": g2 - g}
        print(name, "shift", d, "m done", round(time.time() - t0), "s", flush=True)
    out[name] = res

json.dump(out, open(sys.argv[1], "w"), indent=1)
print("saved", sys.argv[1])
