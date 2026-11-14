# RUN-001: does treating the Sun and Earth as points matter?

**State: `real_data_unverified`.** Computed offline from the stored RUN-001 bundles (the Horizons angle series and the LOLA 20 m skyline they hold) by `science/scripts/disk_edge_real.py`; no new data was fetched. Screening only: this brackets one modelling assumption and validates nothing.

Every LunaScope result uses the **centre** of each disc. Earth is about 1.9 degrees across as seen from the Moon and the Sun about 0.5, so near the skyline the edge can matter. Two bounds were recomputed with the same geometry and skyline, moving the clearance margin by the disc's angular radius (Sun 0.27 degrees, Earth 0.95 degrees, nominal means; Earth's varies from about 0.90 to 1.03 over the lunar orbit and is not modelled):

- **Upper limb:** visible as soon as any part of the disc clears the skyline (most optimistic).
- **Whole disc:** visible only when all of the disc clears it (most conservative).

Availability is shown as a lower to upper bound, as everywhere in LunaScope.

## `S89.5-E0`

| Target | Needs | Upper limb | Centre (used) | Whole disc | Outcome changes? |
| --- | --- | --- | --- | --- | --- |
| Sun | at least 60.0% | FAIL, 0.0% | FAIL, 0.0% | FAIL, 0.0% | no |
| Earth | at least 50.0% | PASS, 83.5% to 83.7% | PASS, 74.5% to 74.7% | PASS, 65.5% to 65.7% | no |

## `S89.5-E120`

| Target | Needs | Upper limb | Centre (used) | Whole disc | Outcome changes? |
| --- | --- | --- | --- | --- | --- |
| Sun | at least 60.0% | FAIL, 0.0% | FAIL, 0.0% | FAIL, 0.0% | no |
| Earth | at least 50.0% | FAIL, 0.0% | FAIL, 0.0% | FAIL, 0.0% | no |

## `S89.5-E240`

| Target | Needs | Upper limb | Centre (used) | Whole disc | Outcome changes? |
| --- | --- | --- | --- | --- | --- |
| Sun | at least 60.0% | FAIL, 0.0% | FAIL, 0.0% | FAIL, 0.0% | no |
| Earth | at least 50.0% | PASS, 75.7% to 75.9% | PASS, 65.0% to 65.2% | PASS, 53.8% to 54.1% | no |

## What it shows

- **No outcome changes at any of the three sites.** Passes stay passes and fails stay fails whether the centre, the upper limb or the whole disc is used.
- **Earth's availability does move by several percentage points**: the whole-disc reading is the lowest and the upper-limb reading the highest.
- At `S89.5-E0` Earth still passes on the whole-disc reading, with **15.5 percentage points** to spare over the requirement.
- At `S89.5-E240` Earth still passes on the whole-disc reading, with **3.8 percentage points** to spare over the requirement.
- The Sun fails at every site even on the upper-limb reading: it stays below the skyline in the whole window by more than its own 0.27 degree radius.

Reproduce: `python science/scripts/disk_edge_real.py` (from `science/`). Raw numbers: `docs/runs/evidence/RUN-001-disk-edge.json`.
