"""Convergence study on the REAL RUN-001 sites (spec 14.3), offline as far as the Horizons cache allows.

Base = the stored RUN-001 bundle (0.1 deg azimuth step, 150 km radius, 10 minute step). Each case changes ONE
setting and re-runs the site through the live stack (real LOLA DEM, cached Horizons responses, no network).
A case that needs a Horizons request that is not cached is recorded as BLOCKED with the reason, never skipped
silently and never faked. The 1 minute step case needs a 7 day 1 minute series; the radius cases change the
DEM window, which is part of the Horizons cache key, so they need new requests too.

  python scripts/convergence_study.py            # writes docs/runs/evidence/RUN-001-convergence.json and docs/runs/RUN-001-convergence.md

State: real_data_unverified. Needs data/raw (the DEMs, SPICE kernels) and var/horizons_cache from RUN-001.
"""

from __future__ import annotations

import glob
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

from lunascope.canonical import canonical_bytes
from lunascope.dem import REPO
from lunascope.errors import LunaScopeError
from lunascope.pipeline import RunConfig, SiteSpec
from lunascope.reference import CONVERGENCE_CASES, convergence_report
from lunascope.stacks import ServiceConfig, build_stack

BUNDLES = REPO / "docs" / "runs" / "bundles"
OUT_JSON = REPO / "docs" / "runs" / "evidence" / "RUN-001-convergence.json"
OUT_MD = REPO / "docs" / "runs" / "RUN-001-convergence.md"
LABEL = {"sun_center": "Sun", "earth_center": "Earth"}


def main() -> int:
    cfg = RunConfig(start_utc=datetime(2027, 1, 10, tzinfo=UTC))  # exactly RUN-001's configuration
    stack, _ = build_stack(ServiceConfig(data_dir=REPO / "var", stack_kind="live"), "lola-80s-20m-adj")
    sites = []
    for f in sorted(glob.glob(str(BUNDLES / "*.json"))):
        base = json.loads(Path(f).read_text(encoding="utf-8"))
        eff = base["effective_settings"]
        assert (eff["az_step_deg"], eff["radius_km"], eff["step_s"]) == (cfg.az_step_deg, cfg.radius_km, cfg.step_s), \
            "the stored bundle was not made with the default configuration this study assumes"
        st = base["request"]["site"]
        site = SiteSpec(st["site_id"], st["lat_deg"], st["lon_east_deg"], st.get("source", ""), st.get("precision_m", 100.0))
        cases, t_site = [], time.time()
        for name, change in CONVERGENCE_CASES:
            t0 = time.time()
            try:
                rep = convergence_report(site, cfg, stack, base=base, cases=((name, change),))
                row = rep["cases"][0] if rep["cases"] else None
                cases.append({"case": name, "changed": change, "status": "run", "seconds": round(time.time() - t0, 1), **(row or {})})
            except LunaScopeError as e:
                cases.append({"case": name, "changed": change, "status": "blocked", "code": e.code, "reason": e.message[:240],
                              "seconds": round(time.time() - t0, 1)})
            print(f"{site.site_id:12s} {name:16s} {cases[-1]['status']:8s} {cases[-1]['seconds']:6.1f} s", flush=True)
        sites.append({"site_id": site.site_id, "base_run_id": base["run_id"], "base_result_id": base["result_id"],
                      "cases": cases, "seconds": round(time.time() - t_site, 1)})
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_bytes(canonical_bytes({"schema": "lunascope.convergence_study/1", "source": "RUN-001 bundles",
                                          "base_settings": {"az_step_deg": cfg.az_step_deg, "radius_km": cfg.radius_km, "step_s": cfg.step_s},
                                          "sites": sites}))
    write_markdown(sites)
    print(f"wrote {OUT_JSON.relative_to(REPO)} and {OUT_MD.relative_to(REPO)}")
    return 0


def write_markdown(sites: list[dict]) -> None:
    run = [c for s in sites for c in s["cases"] if c["status"] == "run"]
    blocked = sorted({c["case"] for s in sites for c in s["cases"] if c["status"] == "blocked"})
    lines = ["# RUN-001: convergence on real data", "",
             "**State: `real_data_unverified`.** One setting is changed at a time against the stored RUN-001 result (azimuth step 0.1 degrees, "
             "radius 150 km, 10 minute step), each re-run through the live stack with the real LOLA 20 m DEM and the **cached** Horizons responses "
             "(no network). Produced by `science/scripts/convergence_study.py`. Screening only; this checks numerical resolution, not the DEM or the method.", "",
             "Flagged **SENSITIVITY_HIGH** by the service's rule: an outcome changes, the number of events changes, or availability moves by more than "
             "one percentage point.", ""]
    for s in sites:
        lines += [f"## `{s['site_id']}`", "", "| Case | Result | Sun: availability change / outcome / event shift | Earth: availability change / outcome / event shift |",
                  "| --- | --- | --- | --- |"]
        for c in s["cases"]:
            if c["status"] != "run":
                lines.append(f"| `{c['case']}` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |")
                continue
            def cell(t):
                d = c["targets"][t]
                dl = 100 * d["delta_lower"]
                oc = f"{d['outcome_base']} to {d['outcome_variant']}" if d["outcome_changed"] else f"{d['outcome_base']}, unchanged"
                return f"{dl:+.2f} pp / {oc} / {d['max_event_shift_s']:.0f} s"
            lines.append(f"| `{c['case']}` | {'**SENSITIVITY_HIGH**' if c['sensitivity_high'] else 'within tolerance'} | {cell('sun_center')} | {cell('earth_center')} |")
        lines.append("")
    high = [c for c in run if c["sensitivity_high"]]
    lines += ["## What it shows", "",
              f"- {len(run)} case runs completed across the three sites; **{len(high)} flagged SENSITIVITY_HIGH**." if run else "- No case could be run offline.",
              ("- Every completed case stayed within tolerance: no outcome changed, no event appeared or disappeared, and availability moved by no more than one percentage point."
               if run and not high else "- See the flagged rows above."),
              ]
    if blocked:
        lines += [f"- **Not run (blocked): {', '.join(f'`{b}`' for b in blocked)}.** These need Horizons requests that are not in the cache: the 1 minute step needs a "
                  "7 day 1 minute series, and the radius cases change the DEM window, which is part of the cache key. The client refuses to send requests "
                  "without a project contact (SDR-001 D-11), so they run after that is set. Convergence is therefore **not complete**."]
    lines += ["", "Raw numbers: `docs/runs/evidence/RUN-001-convergence.json`."]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
