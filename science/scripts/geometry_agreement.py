"""D-10: Horizons vs SPICE agreement across many dates, sites and targets.

Needs a configured contact (LUNASCOPE_CONTACT): JPL's fair-use policy requires contact information
in the User-Agent, and the client refuses to send a request without it. Responses are cached
verbatim and hash-checked, so a second run makes no requests.

Usage:
    LUNASCOPE_CONTACT="<team email or URL>" python scripts/geometry_agreement.py [--dates 2026-12-01,...]

Windows are 6 hours at one hour (7 rows per request); requests are made one at a time.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime, timedelta

import numpy as np

from lunascope.dem import REPO
from lunascope.errors import CONFIGURATION_MISSING, LunaScopeError
from lunascope.observer import build_observer
from lunascope.providers.geometry.horizons import HorizonsClient, HorizonsProvider, ResponseCache
from lunascope.providers.geometry.spice import SpiceProvider
from lunascope.validation import geometry_residuals

DEFAULT_DATES = ["2026-12-01", "2027-01-10", "2027-03-20", "2027-06-21", "2027-09-23", "2028-01-15"]
# rule-chosen, as in RUN-001, plus one mid-latitude and one high-ground site for convention coverage
SITES = [("rule-89.5S-E0", -89.5, 0.0, 0.0), ("rule-89.5S-E120", -89.5, 120.0, 0.0),
         ("rule-89.5S-E240", -89.5, 240.0, 0.0), ("mid-45S-E120", -45.0, 120.0, 0.0),
         ("high-89.9S-E222.7", -89.9, 222.7, 1500.0)]
TOLERANCE_ARCSEC = 0.01


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dates", default=",".join(DEFAULT_DATES))
    ap.add_argument("--out", default=str(REPO / "docs" / "sdr" / "evidence" / "d10_geometry_agreement.json"))
    args = ap.parse_args()
    horizons = HorizonsProvider(HorizonsClient(ResponseCache(REPO / "var" / "horizons_cache")))
    spice = SpiceProvider()
    rows, worst = [], {"sun_center": 0.0, "earth_center": 0.0}
    for d in args.dates.split(","):
        start = datetime.fromisoformat(d).replace(tzinfo=UTC)
        grid = [start + timedelta(hours=h) for h in range(7)]
        for sid, lat, lon, ground in SITES:
            obs = build_observer(site_id=sid, lat_deg=lat, lon_deg=lon, convention="planetocentric",
                                 lon_direction="east_positive", reference_radius_km=1737.4,
                                 ground_height_m=ground, ground_height_source="rule",
                                 observer_height_above_ground_m=2.0)
            for target in ("sun_center", "earth_center"):
                try:
                    h = horizons.series(obs, target, grid)
                except LunaScopeError as e:
                    if e.code == CONFIGURATION_MISSING:
                        print(e.message, file=sys.stderr)
                        return 2
                    raise
                r = geometry_residuals(h, spice.series(obs, target, grid))
                worst[target] = max(worst[target], r.max_total_arcsec())
                rows.append({"date": d, "site": sid, "target": target, **r.summary()})
                print(f"{d} {sid:20s} {target:12s} max {r.max_total_arcsec():.4f} arcsec", flush=True)
    summary = {"cases": len(rows), "worst_arcsec": worst, "tolerance_arcsec": TOLERANCE_ARCSEC,
               "all_within": bool(all(r["max_total_arcsec"] <= TOLERANCE_ARCSEC for r in rows)),
               "median_arcsec": float(np.median([r["max_total_arcsec"] for r in rows]))}
    json.dump({"summary": summary, "rows": rows}, open(args.out, "w", encoding="utf-8"), indent=1)
    print(json.dumps(summary))
    return 0 if summary["all_within"] else 1


if __name__ == "__main__":
    sys.exit(main())
