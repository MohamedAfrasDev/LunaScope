# RUN-001: convergence on real data

**State: `real_data_unverified`.** One setting is changed at a time against the stored RUN-001 result (azimuth step 0.1 degrees, radius 150 km, 10 minute step), each re-run through the live stack with the real LOLA 20 m DEM and the **cached** Horizons responses (no network). Produced by `science/scripts/convergence_study.py`. Screening only; this checks numerical resolution, not the DEM or the method.

Flagged **SENSITIVITY_HIGH** by the service's rule: an outcome changes, the number of events changes, or availability moves by more than one percentage point.

## `S89.5-E0`

| Case | Result | Sun: availability change / outcome / event shift | Earth: availability change / outcome / event shift |
| --- | --- | --- | --- |
| `step_60s` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |
| `azimuth_0.5deg` | within tolerance | +0.00 pp / FAIL, unchanged / 0 s | +0.02 pp / PASS, unchanged / 119 s |
| `azimuth_0.25deg` | within tolerance | +0.00 pp / FAIL, unchanged / 0 s | +0.01 pp / PASS, unchanged / 75 s |
| `radius_100km` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |
| `radius_200km` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |

## `S89.5-E120`

| Case | Result | Sun: availability change / outcome / event shift | Earth: availability change / outcome / event shift |
| --- | --- | --- | --- |
| `step_60s` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |
| `azimuth_0.5deg` | within tolerance | +0.00 pp / FAIL, unchanged / 0 s | +0.00 pp / FAIL, unchanged / 0 s |
| `azimuth_0.25deg` | within tolerance | +0.00 pp / FAIL, unchanged / 0 s | +0.00 pp / FAIL, unchanged / 0 s |
| `radius_100km` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |
| `radius_200km` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |

## `S89.5-E240`

| Case | Result | Sun: availability change / outcome / event shift | Earth: availability change / outcome / event shift |
| --- | --- | --- | --- |
| `step_60s` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |
| `azimuth_0.5deg` | within tolerance | +0.00 pp / FAIL, unchanged / 0 s | -0.00 pp / PASS, unchanged / 4 s |
| `azimuth_0.25deg` | within tolerance | +0.00 pp / FAIL, unchanged / 0 s | -0.00 pp / PASS, unchanged / 3 s |
| `radius_100km` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |
| `radius_200km` | **blocked** | needs a Horizons request that is not cached | needs a Horizons request that is not cached |

## What it shows

- 6 case runs completed across the three sites; **0 flagged SENSITIVITY_HIGH**.
- Every completed case stayed within tolerance: no outcome changed, no event appeared or disappeared, and availability moved by no more than one percentage point.
- **Not run (blocked): `radius_100km`, `radius_200km`, `step_60s`.** These need Horizons requests that are not in the cache: the 1 minute step needs a 7 day 1 minute series, and the radius cases change the DEM window, which is part of the cache key. The client refuses to send requests without a project contact (SDR-001 D-11), so they run after that is set. Convergence is therefore **not complete**.

Raw numbers: `docs/runs/evidence/RUN-001-convergence.json`.
