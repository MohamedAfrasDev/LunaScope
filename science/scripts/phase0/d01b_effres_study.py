"""D-01b: effective resolution and height error at the pixels that set each site's skyline (RUN-001 bundles).

Reads ONLY the 16x overview (320 m) of the PGDA EFFRES and ERR layers by HTTP range request (no full download)."""
import glob
import json
import sys

import numpy as np
import rasterio

from lunascope.dem import HALF, REPO, N, stereographic_xy
from lunascope.observer import build_observer

ROOT = str(REPO / "docs" / "runs" / "bundles")
BASE = "/vsicurl/https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/"
FACTOR = 16
env = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".TIF", GDAL_HTTP_MAX_RETRY="3",
           GDAL_HTTP_TIMEOUT="120")
layers = {}
with rasterio.Env(**env):
    for name, f in (("effres", "LDEM_80S_20MPP_ADJ_EFFRES.TIF"), ("err", "LDEM_80S_20MPP_ADJ_ERR.TIF")):
        ds = rasterio.open(BASE + f)
        print(name, ds.width, ds.height, ds.dtypes, ds.nodata, ds.overviews(1), flush=True)
        layers[name] = ds.read(1, out_shape=(N // FACTOR, N // FACTOR)).astype(np.float64)
        print(name, "overview read", layers[name].shape, "min/median/max",
              float(np.nanmin(layers[name])), float(np.nanmedian(layers[name])), float(np.nanmax(layers[name])), flush=True)

PIX = 20.0 * FACTOR


def sample(layer, x, y):
    col = np.clip(((x + HALF) / PIX).astype(int), 0, layer.shape[1] - 1)
    row = np.clip(((HALF - y) / PIX).astype(int), 0, layer.shape[0] - 1)
    return layer[row, col]


out = {}
for p in sorted(glob.glob(ROOT + "/*.json")):
    b = json.load(open(p, encoding="utf-8"))
    site = b["request"]["site"]["site_id"]
    o = b["observer"]
    obs = build_observer(site_id=site, lat_deg=o["lat_deg"], lon_deg=o["lon_deg_east"], convention="planetocentric",
                         lon_direction="east_positive", reference_radius_km=1737.4,
                         ground_height_m=o["ground_height_m"], ground_height_source="x",
                         observer_height_above_ground_m=o["observer_height_above_ground_m"])
    e, n, u = obs.enu
    h = b["horizon"]
    az = np.radians(np.array(h["azimuth_deg"]))
    d = np.array([np.nan if v is None else v for v in h["argmax_distance_km"]])
    ang = d / 1737.4
    t = np.sin(az)[:, None] * e + np.cos(az)[:, None] * n
    q = np.cos(ang)[:, None] * u + np.sin(ang)[:, None] * t
    x, y = stereographic_xy(q)
    eff, err = sample(layers["effres"], x, y), sample(layers["err"], x, y)
    xs, ys = stereographic_xy(u[None, :])
    site_eff, site_err = float(sample(layers["effres"], xs, ys)[0]), float(sample(layers["err"], xs, ys)[0])
    # elevation-angle uncertainty from the height error alone: sigma_h / distance
    sig_el = np.degrees(err / (d * 1000.0))
    el = np.array([np.nan if v is None else v for v in h["horizon_el_deg"]])
    ok = np.isfinite(d) & (d > 0)
    q_ = lambda a, p: float(np.percentile(a[ok], p))
    out[site] = {
        "site_effres_m": site_eff, "site_err_m": site_err, "skyline_sectors": int(ok.sum()),
        "effres_at_skyline_m": {"median": q_(eff, 50), "p90": q_(eff, 90), "p99": q_(eff, 99), "max": float(eff[ok].max())},
        "frac_effres_gt": {str(th): float((eff[ok] > th).mean()) for th in (20, 40, 100, 200)},
        "err_at_skyline_m": {"median": q_(err, 50), "p90": q_(err, 90), "p99": q_(err, 99)},
        "distance_km": {"median": q_(d, 50), "p10": q_(d, 10), "p90": q_(d, 90)},
        "sigma_el_from_height_error_deg": {"median": q_(sig_el, 50), "p90": q_(sig_el, 90), "p99": q_(sig_el, 99), "max": float(sig_el[ok].max())},
        "frac_sigma_el_gt_0.01deg": float((sig_el[ok] > 0.01).mean()),
    }
    print(site, json.dumps(out[site]), flush=True)
json.dump({"overview_factor": FACTOR, "pixel_m": PIX, "sites": out}, open(sys.argv[1], "w"), indent=1)
print("saved")
