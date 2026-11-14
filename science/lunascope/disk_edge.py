"""Disk-edge sensitivity (spec S-2, OQ-06): does it matter that the Sun and Earth are discs, not points?

The main result uses the CENTRE of each disc (a declared assumption). Earth's disc is about 1.9 degrees
across as seen from the Moon (the Sun about 0.53), so near the skyline the centre can be hidden while
part of the disc shows, or the centre can be visible while part of the disc is still behind the terrain.

Two bounding cases are recomputed with the same geometry, skyline and event search; only the clearance
margin moves by the disc's angular radius r:

  upper_limb   margin - r : the target counts as visible as soon as ANY part of its disc clears the skyline
                            (the most optimistic reading)
  whole_disk   margin + r : the target counts as visible only when its WHOLE disc clears the skyline
                            (the most conservative reading)

The centre result lies between them. If both bounds reach the same outcome as the centre, the
centre-only assumption does not change the answer at this site; if not, it matters and is flagged.
Nothing here models partial illumination or partial signal: it only brackets the centre assumption.

The radii are nominal means. Earth's angular radius varies with the Moon's distance (roughly 0.90 to
1.03 degrees over the orbit, from Earth's 6,378 km radius and a 356,000 to 407,000 km range); that
variation is not modelled and is stated beside every result.
"""

from __future__ import annotations

from .clearance import TerrainClearanceModel
from .events import Settings, build_partition
from .metrics import summarize

SUN_RADIUS_DEG = 0.2666  # mean angular radius of the Sun seen from the Moon
EARTH_RADIUS_DEG = 0.95  # mean angular radius of Earth seen from the Moon
ANGULAR_RADIUS_DEG = {"sun_center": SUN_RADIUS_DEG, "earth_center": EARTH_RADIUS_DEG}
CASES = (("upper_limb", -1.0), ("whole_disk", +1.0))
NOTE = ("The main result uses the centre of each disc. These two cases move the clearance margin by the disc's "
        "angular radius to bracket that assumption: upper limb counts a target as visible when any part of its "
        "disc clears the skyline, whole disc only when all of it does. Nominal radii: Sun 0.27 deg, Earth 0.95 "
        "deg (Earth's varies from about 0.90 to 1.03 deg over the lunar orbit; not modelled).")


def _case(model: TerrainClearanceModel, settings: Settings, duration_s: float, step_s: float,
          threshold: float, margin_deg: float) -> dict:
    part = build_partition(model, 0.0, float(duration_s), float(step_s), settings)
    m = summarize(part.intervals, 0.0, float(duration_s), threshold).to_dict()
    return {"margin_deg": margin_deg, "outcome": m["outcome"], "availability_lower": m["availability_lower"],
            "availability_upper": m["availability_upper"], "longest_known_hidden_s": m["longest_known_hidden_s"],
            "events": len(part.events), "event_times_s": [e.t for e in part.events]}


def disk_edge_sensitivity(splines: dict, profile, *, base_margin_deg: float, settings: dict, duration_s: float,
                          step_s: float, thresholds: dict, centre: dict) -> dict:
    """`splines`, `settings`, `thresholds` and `centre` are keyed by target. `centre` holds each target's
    terrain-aware metrics from the main run, so the three readings sit side by side."""
    targets: dict = {}
    for tgt, sp in splines.items():
        r = ANGULAR_RADIUS_DEG[tgt]
        block = {"angular_radius_deg": r,
                 "centre": {k: centre[tgt][k] for k in ("outcome", "availability_lower", "availability_upper",
                                                         "longest_known_hidden_s")}}
        for name, sign in CASES:
            margin = base_margin_deg + sign * r
            block[name] = _case(TerrainClearanceModel(sp, profile, margin_deg=margin), settings[tgt],
                                duration_s, step_s, thresholds[tgt], margin)
        block["outcome_changes"] = {n: block[n]["outcome"] != block["centre"]["outcome"] for n, _ in CASES}
        block["matters"] = any(block["outcome_changes"].values())
        targets[tgt] = block
    return {"schema": "lunascope.disk_edge/1", "note": NOTE, "targets": targets,
            "matters": any(b["matters"] for b in targets.values())}
