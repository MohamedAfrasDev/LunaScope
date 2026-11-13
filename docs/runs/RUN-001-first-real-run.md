# RUN-001 — first real end-to-end run

**Date:** 13 Nov 2026 · **State: `real_data_unverified`** — no validation gate has closed. This is a screening result for three arbitrary sites over one week. It is not a mission result, a site recommendation, or a claim about power or communications.

## What ran

Live JPL Horizons geometry (Sun and Earth centres, apparent, airless) → cubic Hermite interpolation → LOLA 20 m terrain horizon → certified rise/set events → availability bounds → per-requirement outcomes, with an independent NAIF SPICE comparison and sensitivity variants. Code: [pipeline.py](../../science/lunascope/pipeline.py), script: [first_real_run.py](../../science/scripts/first_real_run.py).

| Setting | Value |
| --- | --- |
| Mission | 2027-01-10 00:00 UTC, 7 days, 10-minute base step (1,009 samples), sampled at both ends |
| Requirements (scenario values only) | Sun ≥ 60%, Earth ≥ 50%, terrain on; flat horizon kept for comparison |
| Terrain | `LDEM_80S_20MPP_ADJ.TIF` (SHA-256 `09b7ca80…`), 150 km radius, 0.1° azimuth step, observer mast 2 m |
| Decision band ε / root tolerance τ / min interval | 0.01° / 1 s / 5 s |
| Geometry | JPL Horizons (signature 1.2), requests cached verbatim; SPICE `LT+S`, DE440 kernels pinned |
| Interpolation allowance δ | 10 × the measured 1-minute holdout error, floor 1e-6° (used 1.0e-6°) |
| Sensitivity | azimuth step halved (0.05°); alternate DEM release (PDS `LDEM_80S_20M`) |

**Selection rules, fixed before looking at any result:** mission start is a round date already used by the recorded fixtures and inside all coverage; the sites are latitude −89.5° at longitudes 0°, 120° and 240° east (a symmetric rule, not chosen for illumination or terrain). They are **not** candidate landing sites and have no coordinate provenance beyond the rule.

## Sites and headline result

| Site | Lat / lon E (°) | Ground (m) | Skyline min to max (°) | run_id | result_id | Site status (terrain-aware) |
| --- | --- | --- | --- | --- | --- | --- |
| `S89.5-E0` | -89.5 / 0 | -722.0 | -0.26 to 9.59 | `43832051e3346d73` | `57982fd1b03edc93` | FAIL_SUN |
| `S89.5-E120` | -89.5 / 120 | -1714.0 | 11.02 to 31.27 | `50a43d7b8a417ffd` | `501dd8c5655c3cc6` | FAIL_BOTH |
| `S89.5-E240` | -89.5 / 240 | 938.3 | -1.68 to 12.56 | `571bfc1cb5cd746a` | `e8ff84bf48502849` | FAIL_SUN |

Per target (availability is a lower to upper bound: visible time, and visible plus unresolved time; "clearance max" is the best target elevation above the skyline seen at any 10-minute node, negative means below it all week):

| Site | Target | Flat-horizon availability | Flat outcome | Terrain-aware availability | Terrain outcome | Longest known hidden | Clearance max (°) | Events |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `S89.5-E0` | Sun | 100.00% | **PASS** | 0.00% to 0.00% | **FAIL** | 7 d 00 h 00 min | -5.78 | 0 |
| `S89.5-E0` | Earth | 92.24% | **PASS** | 74.50% to 74.69% | **PASS** | 1 d 18 h 31 min | +5.45 | 1 |
| `S89.5-E120` | Sun | 100.00% | **PASS** | 0.00% to 0.00% | **FAIL** | 7 d 00 h 00 min | -22.69 | 0 |
| `S89.5-E120` | Earth | 84.34% | **PASS** | 0.00% to 0.00% | **FAIL** | 7 d 00 h 00 min | -8.20 | 0 |
| `S89.5-E240` | Sun | 100.00% | **PASS** | 0.00% to 0.00% | **FAIL** | 7 d 00 h 00 min | -2.51 | 0 |
| `S89.5-E240` | Earth | 85.03% | **PASS** | 65.01% to 65.24% | **PASS** | 2 d 10 h 23 min | +4.10 | 1 |

## What it shows

- **The terrain changes the decision, as the product question asks.** At all three sites a flat-horizon analysis says the Sun is visible 100% of the week (PASS) while the terrain-aware analysis says 0% (FAIL). The Earth requirement also changes at the 120° site (flat PASS, terrain FAIL).
- **The margins are large compared with the measured uncertainties.** The best the Sun gets is 2.5° (240° site), 5.8° (0° site) and 22.7° (120° site) *below* the skyline. The largest DEM-release skyline difference found at any azimuth in the earlier study was 0.45°, and the azimuth-step change in that study was under 0.05°, so none of these Sun results can plausibly flip within the studied sensitivities.
- **Earth is a closer call than the Sun.** At the 0° and 240° sites Earth passes with a lower bound of 74.5% and 65.0% against the 50% scenario threshold. The gap between lower and upper bound is only about 0.2 points, because the only unresolved time is the decision band around each crossing.
- **Sensitivity variants stayed stable** (table below): no outcome changed and availability moved by at most 0.24 percentage points. The largest event-time change was 1,425 s (24 min), for the Earth event at the 240° site when the DEM release was swapped — a real, if small, DEM-source effect on a countdown.

| Site | Variant | Target | Δ lower bound (points) | Outcome | Events | Max event shift (s) |
| --- | --- | --- | --- | --- | --- | --- |
| `S89.5-E0` | azimuth_step_halved | Sun | +0.000 | FAIL to FAIL | 0 to 0 | 0.0 |
| `S89.5-E0` | azimuth_step_halved | Earth | +0.001 | PASS to PASS | 1 to 1 | 11.9 |
| `S89.5-E0` | alternate_dem_release | Sun | +0.000 | FAIL to FAIL | 0 to 0 | 0.0 |
| `S89.5-E0` | alternate_dem_release | Earth | +0.006 | PASS to PASS | 1 to 1 | 32.4 |
| `S89.5-E120` | azimuth_step_halved | Sun | +0.000 | FAIL to FAIL | 0 to 0 | 0.0 |
| `S89.5-E120` | azimuth_step_halved | Earth | +0.000 | FAIL to FAIL | 0 to 0 | 0.0 |
| `S89.5-E120` | alternate_dem_release | Sun | +0.000 | FAIL to FAIL | 0 to 0 | 0.0 |
| `S89.5-E120` | alternate_dem_release | Earth | +0.000 | FAIL to FAIL | 0 to 0 | 0.0 |
| `S89.5-E240` | azimuth_step_halved | Sun | +0.000 | FAIL to FAIL | 0 to 0 | 0.0 |
| `S89.5-E240` | azimuth_step_halved | Earth | +0.001 | PASS to PASS | 1 to 1 | 5.6 |
| `S89.5-E240` | alternate_dem_release | Sun | +0.000 | FAIL to FAIL | 0 to 0 | 0.0 |
| `S89.5-E240` | alternate_dem_release | Earth | -0.228 | PASS to PASS | 1 to 1 | 1424.9 |

## Checks that ran

- **Independent geometry check:** SPICE vs Horizons over all 1,009 samples per target: max on-sky difference 0.0000″ (Sun) and 0.0017″ (Earth) against the 0.01″ tolerance — within tolerance at every site.
- **Interpolation holdout:** the 10-minute interpolant reproduces recorded 1-minute Horizons data over the first 6 hours to 1.2e-08° (Sun) and 1.8e-09° (Earth).
- **Terrain coverage:** all 3,600 azimuth sectors certified at every site; no sector was limited by missing data.
- **Run time on this machine:** 15–17 s per site including sensitivity runs and warm caches (one cold Horizons fetch adds a few seconds).

## What it does not show

- **One week samples one slice of the sky.** The Sun moves about 12° of azimuth per day here, so over seven days it sweeps roughly 85° of azimuth. "Hidden all week" says nothing about other weeks or seasons.
- **The sites sit in rough terrain by construction of the rule**, not by selection. They say nothing about the better-lit places mission planners would actually consider.
- **Nothing is validated.** The terrain horizon, the DEM's suitability, convergence and the requirement thresholds have not been reviewed. Warnings carried in every bundle: `UNVERIFIED`, `UTC_FUTURE_LEAP_SECOND_ASSUMPTION`, `EOP_PREDICTED`.
- **Centre-of-disk visibility only** (the Sun is 0.53° wide, Earth about 1.9°), no refraction, finite 150 km radius, DEM is interpolated everywhere so sparse-coverage areas are not flagged (SDR-001 D-01b).
- **Azimuth convergence is not fully closed**: earlier study showed the skyline still moves by ~0.017° between 0.25° and 0.1° steps at one site. That is far below the clearance margins here but above ε, so results *near* a skyline crossing would need a finer step.
- Sensitivity tolerance (1 percentage point) and the interpolation safety factor (10×) are proposed values (OQ-08).

## Reproduce

```bash
cd science
.venv/Scripts/python scripts/first_real_run.py          # needs data/raw DEMs + SPICE kernels; live Horizons on first run
```

Bundles are in [`docs/runs/bundles/`](bundles/) (canonical JSON, exact bytes). Each carries its request, effective settings, resource pins, Horizons raw-response hashes, the horizon profile, the 10-minute angle series, classified intervals, refined events, metrics, countdown at start, and the sensitivity comparisons.
