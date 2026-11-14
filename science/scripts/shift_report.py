"""Write the record of the real five-day shift (GR-001 +5 d) from the offline fallback package.

  python scripts/shift_report.py [package-dir (default ../fallback)] [--out docs/runs/GR-001-plus5d.md]

Every figure comes from the packaged analysis artifacts; the flag diagnosis comes from
docs/runs/evidence/GR-001-plus5d-flag.json (scripts/shift_flag_diagnosis.py).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from lunascope.dem import REPO

LABEL = {"sun_center": "Sun", "earth_center": "Earth"}
DIAG = REPO / "docs" / "runs" / "evidence" / "GR-001-plus5d-flag.json"


def pct(x: float) -> str:
    return f"{100 * x:.1f}%"


def rng(m: dict) -> str:
    lo, hi = pct(m["availability_lower"]), pct(m["availability_upper"])
    return lo if lo == hi else f"{lo} to {hi}"


def hrs(s: float) -> str:
    return f"{s / 3600:.2f} h"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("package", nargs="?", default=str(REPO / "fallback"))
    ap.add_argument("--out", default=str(REPO / "docs" / "runs" / "GR-001-plus5d.md"))
    a = ap.parse_args()
    pkg = Path(a.package)
    man = json.loads((pkg / "FALLBACK-MANIFEST.json").read_text(encoding="utf-8"))

    def art(sha: str) -> dict:
        return json.loads((pkg / "data" / "store" / "artifacts" / sha[:2] / f"{sha}.json").read_text(encoding="utf-8"))

    base_run, shift_run = man["runs"][0], man["runs"][1]
    base, shift = art(base_run["analysis_artifact_sha256"]), art(shift_run["analysis_artifact_sha256"])
    sb = sorted(base["sites"], key=lambda s: s["request"]["site"]["lon_east_deg"])
    ss = sorted(shift["sites"], key=lambda s: s["request"]["site"]["lon_east_deg"])
    hz = man.get("horizons_responses", {})

    L = ["# GR-001 shifted five days: a real-data Time Machine run", "",
         f"**State: `{shift['result_state']}`.** The frozen GR-001 window starts {base['request']['mission']['start_utc']}; this shifts the start by five "
         f"days to {shift['request']['mission']['start_utc']} and changes nothing else (same sites, requirements, terrain and settings). It is a *variant* of "
         "GR-001, not part of the frozen reference, and it has **not** been through the convergence report, so it does not carry Gate 2's five checks.", "",
         f"Packaged by `science/scripts/build_fallback.py` (stack `{man['stack']}`, commit `{man['commit'][:12]}`{', with uncommitted changes' if man['dirty'] else ''}). "
         f"Of {hz.get('in_package', '?')} Horizons responses in the package, {hz.get('seeded_from_cache', '?')} were reused from the frozen GR-001 run and "
         f"**{hz.get('newly_fetched', '?')} were newly fetched** for the shifted window. Reproduce the table with `science/scripts/shift_report.py`.", "",
         "## Baseline against shifted (terrain-aware decides)", "",
         "| Site | Target | Needs | Baseline | Shifted | Change in availability (lower bound) | Events (baseline to shifted) |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for x, y in zip(sb, ss, strict=True):
        for t in ("sun_center", "earth_center"):
            a_, b_ = x["targets"][t]["terrain"], y["targets"][t]["terrain"]
            d = 100 * (b_["metrics"]["availability_lower"] - a_["metrics"]["availability_lower"])
            L.append(f"| `{x['request']['site']['site_id']}` | {LABEL[t]} | at least {pct(a_['metrics']['threshold'])} | **{a_['metrics']['outcome']}**, {rng(a_['metrics'])} | "
                     f"**{b_['metrics']['outcome']}**, {rng(b_['metrics'])} | {d:+.1f} pp | {len(a_['events'])} to {len(b_['events'])} |")
    L += ["", "Events in the shifted run (terrain-aware, elapsed hours from the shifted start):", ""]
    any_ev = False
    for y in ss:
        for t in ("sun_center", "earth_center"):
            ev = y["targets"][t]["terrain"]["events"]
            if ev:
                any_ev = True
                L.append(f"- `{y['request']['site']['site_id']}` {LABEL[t]}: " + ", ".join(f"{e['type']} at {hrs(e['t_s'])} ({e['quality'].replace('_', ' ')})" for e in ev))
    if not any_ev:
        L.append("- none")
    L += ["", "## Sensitivity flags carried by the shifted run", "",
          "| Site | Variant | Flagged? | What changed (Sun / Earth) |", "| --- | --- | --- | --- |"]
    flagged = []
    for y in ss:
        for c in y.get("sensitivity", []):
            def cell(t, c=c):
                d = c["targets"][t]
                oc = f"{d['outcome_base']} to {d['outcome_variant']}" if d["outcome_changed"] else f"{d['outcome_base']}, unchanged"
                return f"{100 * d['delta_lower']:+.2f} pp, {oc}, event shift {d['max_event_shift_s']:.0f} s"
            L.append(f"| `{y['request']['site']['site_id']}` | `{c['variant']}` | {'**yes**' if c['sensitivity_high'] else 'no'} | {cell('sun_center')} / {cell('earth_center')} |")
            if c["sensitivity_high"]:
                flagged.append((y["request"]["site"]["site_id"], c["variant"]))
    if flagged and DIAG.exists():
        d = json.loads(DIAG.read_text(encoding="utf-8"))
        c1, c2 = d["cases"]
        unc = c2["uncertified"]
        L += ["", f"### Why `{flagged[0][0]}` is flagged", "",
              f"Re-running that site's shifted window at the two azimuth steps from the cached responses ([evidence](evidence/GR-001-plus5d-flag.json), "
              f"`science/scripts/shift_flag_diagnosis.py`) shows the Sun's availability bounds are **identical**: {rng(c1)} at {c1['az_step_deg']} degrees and {rng(c2)} at {c2['az_step_deg']} degrees. "
              f"What differs is certification: at the finer step the event search leaves {len(unc)} interval(s) uncertified"
              + (f", {', '.join(f'{u['duration_s']:.1f} s long at {hrs(u['start_s'])}' for u in unc)}" if unc else "")
              + f", around the Sun's rise. That is narrower than the {5} second minimum interval width (SDR-001 D-06). By the service's rule an uncertified interval makes the outcome "
              f"`{c2['outcome']}` ({', '.join(c2['exclusion_reasons'])}), which is why the variant is flagged. The rise itself is still located as a normal event "
              f"(about {hrs(c2['events'][0]['t_s'])} at both steps). So the *numbers* are stable; the flag records a certification limit on a sliver of a few seconds. "
              "Whether to relax that policy is a science-owner decision and has not been changed."]
    L += ["", "## What this does and does not show", "",
          "- It shows the Time Machine on **real data**: a five-day slip changes the answer, because the Sun and Earth move against the same skyline.",
          "- It is `real_data_unverified`: the DEM is not scientifically approved and SDR-001 is unsigned.",
          "- It is a single variant of one reference scenario at three rule-chosen points, **not** candidate landing sites and not a mission recommendation.",
          "- It has no convergence report. Treat any figure from it as less settled than the frozen GR-001 numbers, and quote the flag beside it.", ""]
    Path(a.out).write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"wrote {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
