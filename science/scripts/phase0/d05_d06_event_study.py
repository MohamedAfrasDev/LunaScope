"""Phase 0 studies D-05/D-06/D-08 on the RUN-001 bundles: event-search settings and window effects."""
import glob
import json
import sys
import time

import numpy as np

from lunascope.clearance import TerrainClearanceModel
from lunascope.dem import REPO
from lunascope.events import Settings, build_partition
from lunascope.horizon import (
    CERTIFIED,
    COVERAGE_LIMITED,
    UNSUPPORTED,
    HorizonProfile,
    HorizonSettings,
)
from lunascope.metrics import summarize
from lunascope.providers.geometry.interpolate import DirectionSpline

ROOT = str(REPO / "docs" / "runs" / "bundles")
STATE = {"certified": CERTIFIED, "coverage_limited": COVERAGE_LIMITED, "unsupported": UNSUPPORTED}
bundles = sorted((json.load(open(p, encoding="utf-8")) for p in glob.glob(ROOT + "/*.json")),
                 key=lambda b: b["request"]["site"]["lon_east_deg"])
out = {}


def load(b):
    h = b["horizon"]
    prof = HorizonProfile(
        np.array(h["azimuth_deg"], float), np.array([np.nan if v is None else v for v in h["horizon_el_deg"]]),
        np.zeros(len(h["azimuth_deg"])), np.array([STATE[s] for s in h["sector_state"]], dtype=np.int8),
        HorizonSettings(**{k: v for k, v in h["settings"].items()}), "o", {})
    sp = {}
    for t, g in b["geometry"].items():
        s = g["series"]
        sp[t] = DirectionSpline(np.arange(len(s["az_deg"])) * float(s["step_s"]), s["az_deg"], s["el_deg"])
    return prof, sp


def run(b, prof, sp, **kw):
    T = float(b["request"]["mission"]["duration_s"])
    step = float(b["request"]["mission"]["step_s"])
    res = {}
    for t in ("sun_center", "earth_center"):
        st = Settings(delta=b["geometry"][t]["delta_geom_used_deg"], **kw)
        model = TerrainClearanceModel(sp[t], prof)
        p = build_partition(model, 0.0, T, step, st)
        m = summarize(p.intervals, 0.0, T, b["request"]["requirements"][t])
        res[t] = {"lower": m.availability_lower, "upper": m.availability_upper, "outcome": m.outcome.value,
                  "unc_s": m.uncertified_s, "events": [round(e.t, 3) for e in p.events], "evals": p.evals,
                  "evals_per_base": p.evals / p.base_intervals}
    return res


def diff(a, b):
    d = {}
    for t in a:
        sh = [abs(x - y) for x, y in zip(a[t]["events"], b[t]["events"], strict=False)]
        d[t] = {"d_lower": b[t]["lower"] - a[t]["lower"], "d_upper": b[t]["upper"] - a[t]["upper"],
                "event_count": (len(a[t]["events"]), len(b[t]["events"])),
                "max_event_shift_s": max(sh) if sh else 0.0, "outcome": (a[t]["outcome"], b[t]["outcome"]),
                "unc_s": b[t]["unc_s"]}
    return d


for b in bundles:
    name = b["request"]["site"]["site_id"]
    prof, sp = load(b)
    t0 = time.time()
    base = run(b, prof, sp)
    entry = {"base": {t: {k: v for k, v in r.items() if k != "events"} | {"n_events": len(r["events"])} for t, r in base.items()},
             "variants": {}}
    for label, kw in [
        ("eps=0.005", dict(eps=0.005)), ("eps=0.02", dict(eps=0.02)), ("eps=0.05", dict(eps=0.05)),
        ("tau=0.1", dict(tau=0.1)), ("tau=10", dict(tau=10.0)),
        ("w_min=2.5", dict(w_min=2.5)), ("w_min=20", dict(w_min=20.0)),
        ("cap=400", dict(max_evals=400)), ("cap=25", dict(max_evals=25)), ("cap=10", dict(max_evals=10)),
        ("cap=5", dict(max_evals=5)),
    ]:
        v = run(b, prof, sp, **kw)
        entry["variants"][label] = diff(base, v)
    # leap-second / time-offset sensitivity from the node rates (display of the largest 1 s effect)
    rates = {}
    for t, s in sp.items():
        mid = np.linspace(0, s.t_end, 400)
        rates[t] = float(max(np.hypot(*s.rates(x)) for x in mid))
    entry["max_rate_deg_per_s"] = rates
    out[name] = entry
    print(name, "done", round(time.time() - t0), "s", flush=True)

json.dump(out, open(sys.argv[1], "w"), indent=1)
print("saved")
