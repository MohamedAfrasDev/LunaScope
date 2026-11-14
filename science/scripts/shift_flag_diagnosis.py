"""Why is the real five-day shift flagged SENSITIVITY_HIGH at one site? Re-run that site at both azimuth steps.

The packaged shifted run (GR-001 +5 d) carries SENSITIVITY_HIGH at rule-89.5S-E240: its halved-azimuth variant
turns FAIL into EXCLUDED. This re-runs that site's shifted window at 0.1 and 0.05 degrees, from the cached
Horizons responses (no network), and records what differs: the seconds spent in each interval class, the
uncertified interval, the events and the exclusion reason.

  python scripts/shift_flag_diagnosis.py            # writes docs/runs/evidence/GR-001-plus5d-flag.json
"""

from __future__ import annotations

import dataclasses
import sys
from datetime import UTC, datetime

from lunascope.canonical import canonical_bytes
from lunascope.dem import REPO
from lunascope.pipeline import RunConfig, SiteSpec, run_site
from lunascope.stacks import ServiceConfig, build_stack

OUT = REPO / "docs" / "runs" / "evidence" / "GR-001-plus5d-flag.json"
SITE = SiteSpec("rule-89.5S-E240", -89.5, 240.0, "rule")
START = datetime(2027, 1, 15, tzinfo=UTC)  # GR-001's start plus five days


def main() -> int:
    stack, _ = build_stack(ServiceConfig(data_dir=REPO / "var", stack_kind="live"), "lola-80s-20m-adj")
    base = RunConfig(start_utc=START)
    out = {"schema": "lunascope.shift_flag_diagnosis/1", "site_id": SITE.site_id, "start_utc": "2027-01-15T00:00:00Z",
           "target": "sun_center", "cases": []}
    for az in (0.1, 0.05):
        b = run_site(SITE, dataclasses.replace(base, az_step_deg=az), stack, with_reference=False)
        sun = b["targets"]["sun_center"]["terrain"]
        seconds: dict[str, float] = {}
        for i in sun["intervals"]:
            seconds[i["class"]] = seconds.get(i["class"], 0.0) + (i["end_s"] - i["start_s"])
        m = sun["metrics"]
        out["cases"].append({
            "az_step_deg": az, "outcome": m["outcome"], "availability_lower": m["availability_lower"],
            "availability_upper": m["availability_upper"], "exclusion_reasons": m["exclusion_reasons"],
            "seconds_by_class": seconds, "evaluations": sun["evaluations"],
            "uncertified": [{"start_s": i["start_s"], "end_s": i["end_s"], "duration_s": i["end_s"] - i["start_s"]}
                            for i in sun["intervals"] if i["class"] in ("X", "G")],
            "events": [{"type": e["type"], "t_s": e["t_s"], "quality": e["quality"]} for e in sun["events"]]})
        print(f"az {az}: {m['outcome']}, uncertified {out['cases'][-1]['uncertified']}", flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(canonical_bytes(out))
    print(f"wrote {OUT.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
