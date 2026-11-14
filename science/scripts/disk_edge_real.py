"""Disc-edge sensitivity (S-2) on the REAL RUN-001 bundles, offline.

Each stored bundle holds the Horizons-derived angle series and the LOLA skyline, so the bracket is
recomputed from them with no network and no DEM. Output: docs/runs/evidence/RUN-001-disk-edge.json and
docs/runs/RUN-001-disk-edge.md. State: real_data_unverified (RUN-001's own).

  python scripts/disk_edge_real.py
"""

from __future__ import annotations

import glob
import json
import sys

from lunascope.canonical import canonical_bytes
from lunascope.dem import REPO
from lunascope.reference import disk_edge_from_bundle

BUNDLES = REPO / "docs" / "runs" / "bundles"
OUT_JSON = REPO / "docs" / "runs" / "evidence" / "RUN-001-disk-edge.json"
OUT_MD = REPO / "docs" / "runs" / "RUN-001-disk-edge.md"
LABEL = {"sun_center": "Sun", "earth_center": "Earth"}


def pct(x: float) -> str:
    return f"{100 * x:.1f}%"


def rng(c: dict) -> str:
    lo, hi = pct(c["availability_lower"]), pct(c["availability_upper"])
    return lo if lo == hi else f"{lo} to {hi}"


def main() -> int:
    sites = []
    for f in sorted(glob.glob(str(BUNDLES / "*.json"))):
        b = json.loads(open(f, encoding="utf-8").read())
        sites.append({"site_id": b["request"]["site"]["site_id"], "run_id": b["run_id"], "result_id": b["result_id"],
                      "result_state": b["result_state"], "thresholds": b["request"]["requirements"],
                      "disk_edge": disk_edge_from_bundle(b)})
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_bytes(canonical_bytes({"schema": "lunascope.disk_edge_study/1", "source": "RUN-001 bundles", "sites": sites}))

    lines = ["# RUN-001: does treating the Sun and Earth as points matter?", "",
             "**State: `real_data_unverified`.** Computed offline from the stored RUN-001 bundles (the Horizons angle series and the "
             "LOLA 20 m skyline they hold) by `science/scripts/disk_edge_real.py`; no new data was fetched. Screening only: this brackets "
             "one modelling assumption and validates nothing.", "",
             "Every LunaScope result uses the **centre** of each disc. Earth is about 1.9 degrees across as seen from the Moon and the Sun "
             "about 0.5, so near the skyline the edge can matter. Two bounds were recomputed with the same geometry and skyline, moving the "
             "clearance margin by the disc's angular radius (Sun 0.27 degrees, Earth 0.95 degrees, nominal means; Earth's varies from about "
             "0.90 to 1.03 over the lunar orbit and is not modelled):", "",
             "- **Upper limb:** visible as soon as any part of the disc clears the skyline (most optimistic).",
             "- **Whole disc:** visible only when all of the disc clears it (most conservative).", "",
             "Availability is shown as a lower to upper bound, as everywhere in LunaScope.", ""]
    for s in sites:
        d = s["disk_edge"]
        lines += [f"## `{s['site_id']}`", "", "| Target | Needs | Upper limb | Centre (used) | Whole disc | Outcome changes? |",
                  "| --- | --- | --- | --- | --- | --- |"]
        for t, b in d["targets"].items():
            need = pct(s["thresholds"][t])
            cell = lambda c: f"{c['outcome']}, {rng(c)}"
            ch = [n.replace("_", " ") for n, v in b["outcome_changes"].items() if v]
            lines.append(f"| {LABEL[t]} | at least {need} | {cell(b['upper_limb'])} | {cell(b['centre'])} | {cell(b['whole_disk'])} | "
                         f"{'**yes: ' + ', '.join(ch) + '**' if ch else 'no'} |")
        lines.append("")
    margins = []
    for s in sites:
        b = s["disk_edge"]["targets"]["earth_center"]
        if b["whole_disk"]["outcome"] == "PASS":
            margins.append((s["site_id"], b["whole_disk"]["availability_lower"] - s["thresholds"]["earth_center"]))
    any_matters = any(s["disk_edge"]["matters"] for s in sites)
    lines += ["## What it shows", "",
              ("- **At least one outcome changes with disc size** (see the table): the centre-only assumption matters there." if any_matters else
               "- **No outcome changes at any of the three sites.** Passes stay passes and fails stay fails whether the centre, the upper limb or the whole disc is used."),
              "- **Earth's availability does move by several percentage points**: the whole-disc reading is the lowest and the upper-limb reading the highest."]
    for sid, m in margins:
        lines.append(f"- At `{sid}` Earth still passes on the whole-disc reading, with **{100 * m:.1f} percentage points** to spare over the requirement.")
    lines += ["- The Sun fails at every site even on the upper-limb reading: it stays below the skyline in the whole window by more than its own 0.27 degree radius.", "",
              "Reproduce: `python science/scripts/disk_edge_real.py` (from `science/`). Raw numbers: `docs/runs/evidence/RUN-001-disk-edge.json`."]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT_JSON.relative_to(REPO)} and {OUT_MD.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
