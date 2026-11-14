# GR-001 shifted five days: a real-data Time Machine run

**State: `real_data_unverified`.** The frozen GR-001 window starts 2027-01-10T00:00:00Z; this shifts the start by five days to 2027-01-15T00:00:00Z and changes nothing else (same sites, requirements, terrain and settings). It is a *variant* of GR-001, not part of the frozen reference, and it has **not** been through the convergence report, so it does not carry Gate 2's five checks.

Packaged by `science/scripts/build_fallback.py` (stack `live`, commit `9a153beaac03`, with uncommitted changes). Of 102 Horizons responses in the package, 78 were reused from the frozen GR-001 run and **24 were newly fetched** for the shifted window. Reproduce the table with `science/scripts/shift_report.py`.

## Baseline against shifted (terrain-aware decides)

| Site | Target | Needs | Baseline | Shifted | Change in availability (lower bound) | Events (baseline to shifted) |
| --- | --- | --- | --- | --- | --- | --- |
| `rule-89.5S-E0` | Sun | at least 60.0% | **FAIL**, 0.0% | **FAIL**, 0.0% | +0.0 pp | 0 to 0 |
| `rule-89.5S-E0` | Earth | at least 50.0% | **PASS**, 74.5% to 74.7% | **PASS**, 100.0% | +25.5 pp | 1 to 0 |
| `rule-89.5S-E120` | Sun | at least 60.0% | **FAIL**, 0.0% | **FAIL**, 0.0% | +0.0 pp | 0 to 0 |
| `rule-89.5S-E120` | Earth | at least 50.0% | **FAIL**, 0.0% | **FAIL**, 0.0% | +0.0 pp | 0 to 0 |
| `rule-89.5S-E240` | Sun | at least 60.0% | **FAIL**, 0.0% | **FAIL**, 51.2% to 51.4% | +51.2 pp | 0 to 2 |
| `rule-89.5S-E240` | Earth | at least 50.0% | **PASS**, 65.0% to 65.2% | **PASS**, 100.0% | +35.0 pp | 1 to 0 |

Events in the shifted run (terrain-aware, elapsed hours from the shifted start):

- `rule-89.5S-E240` Sun: rise at 75.96 h (normal), set at 162.15 h (normal)

## Sensitivity flags carried by the shifted run

| Site | Variant | Flagged? | What changed (Sun / Earth) |
| --- | --- | --- | --- |
| `rule-89.5S-E0` | `azimuth_step_halved` | no | +0.00 pp, FAIL, unchanged, event shift 0 s / +0.00 pp, PASS, unchanged, event shift 0 s |
| `rule-89.5S-E0` | `alternate_dem_release` | no | +0.00 pp, FAIL, unchanged, event shift 0 s / +0.00 pp, PASS, unchanged, event shift 0 s |
| `rule-89.5S-E120` | `azimuth_step_halved` | no | +0.00 pp, FAIL, unchanged, event shift 0 s / +0.00 pp, FAIL, unchanged, event shift 0 s |
| `rule-89.5S-E120` | `alternate_dem_release` | no | +0.00 pp, FAIL, unchanged, event shift 0 s / +0.00 pp, FAIL, unchanged, event shift 0 s |
| `rule-89.5S-E240` | `azimuth_step_halved` | **yes** | +0.00 pp, FAIL to EXCLUDED, event shift 44 s / +0.00 pp, PASS, unchanged, event shift 0 s |
| `rule-89.5S-E240` | `alternate_dem_release` | no | +0.05 pp, FAIL, unchanged, event shift 363 s / +0.00 pp, PASS, unchanged, event shift 0 s |

### Why `rule-89.5S-E240` is flagged

Re-running that site's shifted window at the two azimuth steps from the cached responses ([evidence](evidence/GR-001-plus5d-flag.json), `science/scripts/shift_flag_diagnosis.py`) shows the Sun's availability bounds are **identical**: 51.2% to 51.4% at 0.1 degrees and 51.2% to 51.4% at 0.05 degrees. What differs is certification: at the finer step the event search leaves 1 interval(s) uncertified, 4.7 s long at 75.95 h, around the Sun's rise. That is narrower than the 5 second minimum interval width (SDR-001 D-06). By the service's rule an uncertified interval makes the outcome `EXCLUDED` (UNCERTIFIED_EVENT_SEARCH), which is why the variant is flagged. The rise itself is still located as a normal event (about 75.95 h at both steps). So the *numbers* are stable; the flag records a certification limit on a sliver of a few seconds. Whether to relax that policy is a science-owner decision and has not been changed.

## What this does and does not show

- It shows the Time Machine on **real data**: a five-day slip changes the answer, because the Sun and Earth move against the same skyline.
- It is `real_data_unverified`: the DEM is not scientifically approved and SDR-001 is unsigned.
- It is a single variant of one reference scenario at three rule-chosen points, **not** candidate landing sites and not a mission recommendation.
- It has no convergence report. Treat any figure from it as less settled than the frozen GR-001 numbers, and quote the flag beside it.

