"""First real end-to-end run: live JPL Horizons geometry + LOLA 20 m terrain + SPICE reference.

RESULT STATE: real_data_unverified. Nothing here is validated.

Selection rules (recorded so nothing is cherry-picked, SDR-001 S-11 / D-08 / D-09):
  * mission start 2027-01-10 00:00 UTC, 7 days, 10-minute base step: round values already used by
    the recorded fixtures, inside both the kernel and Horizons coverage;
  * three sites at planetocentric latitude -89.5 deg on longitudes 0, 120 and 240 deg east: a
    symmetric rule, chosen before looking at any terrain or illumination result;
  * requirements 60% Sun / 50% Earth (the scenario values, not mission rules), terrain on.

Usage:  python scripts/first_real_run.py [--no-sensitivity] [--sites 0,120,240]
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

from lunascope.dem import RAW, REPO, DemTerrain, GeoTiffSource, PdsImgSource
from lunascope.pipeline import (
    RunConfig,
    SiteSpec,
    Stack,
    run_site,
    run_with_sensitivity,
    save_bundle,
)
from lunascope.providers.geometry.horizons import HorizonsClient, HorizonsProvider, ResponseCache
from lunascope.providers.geometry.spice import KernelSet, SpiceProvider

OUT = REPO / "var" / "runs"
CACHE = REPO / "var" / "horizons_cache"


def dem_factory(source_cls, path: Path, resource_id: str):
    def make(site, cfg):
        d = DemTerrain(source_cls(path), center_lat_deg=site.lat_deg,
                       center_lon_east_deg=site.lon_east_deg, radius_km=cfg.radius_km,
                       resource_id=resource_id)
        return d, d.ground_height_m(site.lat_deg, site.lon_east_deg)
    return make


def fmt_hms(s):
    s = round(s)
    return f"{s // 86400}d {s % 86400 // 3600:02d}h {s % 3600 // 60:02d}m"


def summarize_site(r: dict) -> None:
    print(f"\n=== {r['request']['site']['site_id']}  ({r['request']['site']['lat_deg']}, "
          f"{r['request']['site']['lon_east_deg']} E)  state={r['result_state']}  "
          f"site_status={r['site_status']}")
    print(f"    ground {r['observer']['ground_height_m']:.1f} m | skyline {r['horizon']['skyline_min_deg']:.2f}"
          f" to {r['horizon']['skyline_max_deg']:.2f} deg | sectors {r['horizon']['sectors']}"
          f" | timing {r['timing_s']['total_s']:.0f} s | warnings {r['warnings']}")
    for tgt in ("sun_center", "earth_center"):
        for h in ("terrain", "flat"):
            m = r["targets"][tgt][h]["metrics"]
            ev = r["targets"][tgt][h]["events"]
            cl = r["targets"][tgt][h]["clearance_at_nodes"]
            print(f"       clearance at nodes: min {cl['min_deg']:+.3f} median {cl['median_deg']:+.3f} max {cl['max_deg']:+.3f} deg")
            print(f"    {tgt:12s} {h:7s} avail [{m['availability_lower']:.4f}, {m['availability_upper']:.4f}]"
                  f" need {m['threshold']:.2f} -> {m['outcome']:13s} longest hidden "
                  f"{fmt_hms(m['longest_known_hidden_s'])} | events {len(ev)} | excl {m['exclusion_reasons']}")
        g = r["geometry"][tgt]
        ra = g.get("reference_agreement")
        print(f"       geometry: holdout max {g['holdout']['max_deg']:.1e} deg, delta used {g['delta_geom_used_deg']:.1e};"
              + (f" SPICE agreement max {ra['max_total_arcsec']:.4f} arcsec ({'ok' if ra['within_tolerance'] else 'MISMATCH'})" if ra else ""))
    for c in r.get("sensitivity", []):
        print(f"    sensitivity {c['variant']}: high={c['sensitivity_high']}")
        for tgt, v in c["targets"].items():
            print(f"       {tgt:12s} d_lower {v['delta_lower']:+.4f} d_upper {v['delta_upper']:+.4f} "
                  f"outcome {v['outcome_base']}->{v['outcome_variant']} events {v['event_count_base']}->"
                  f"{v['event_count_variant']} max shift {v['max_event_shift_s']:.1f} s")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-sensitivity", action="store_true")
    ap.add_argument("--sites", default="0,120,240")
    args = ap.parse_args()

    cfg = RunConfig(start_utc=datetime(2027, 1, 10, tzinfo=UTC))
    kernels = KernelSet()
    horizons = HorizonsProvider(HorizonsClient(ResponseCache(CACHE)))
    stack = Stack(
        geometry=horizons,
        terrain_factory=dem_factory(GeoTiffSource, RAW / "LDEM_80S_20MPP_ADJ.TIF", "dem-lola-80s-20mpp-adj"),
        reference=SpiceProvider(kernels),
        extra_resources=[{"role": "spice_kernels", "sha256": kernels.manifest_digest}])
    alt = dem_factory(PdsImgSource, RAW / "LDEM_80S_20M.IMG", "dem-pds-ldem-80s-20m")

    for lon in (float(x) for x in args.sites.split(",")):
        site = SiteSpec(f"S89.5-E{int(lon)}", -89.5, lon, source="rule: -89.5 deg, equally spaced longitudes")
        t0 = time.time()
        res = (run_site(site, cfg, stack) if args.no_sensitivity
               else run_with_sensitivity(site, cfg, stack, alt_terrain_factory=alt))
        path = save_bundle(res, OUT)
        summarize_site(res)
        print(f"    saved {path.relative_to(REPO)} ({path.stat().st_size / 1024:.0f} KB) in {time.time() - t0:.0f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
