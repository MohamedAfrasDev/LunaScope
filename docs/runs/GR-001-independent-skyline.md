# GR-001: independent skyline check

**State: `real_data_unverified`.** A second, independently written skyline agrees with the production skyline at all three GR-001 sites, inside gates declared in the code. That is why the *Skyline vs an independent implementation* card now reads **met** and the *Terrain horizon* group reads **met**. It does **not** validate the science.

Code: `science/lunascope/independent_horizon.py`. Driver and evidence writer: `science/scripts/independent_check.py`. Evidence (one file per skyline, named by the skyline's SHA-256): `data/validation/independent_skyline/`. The card finds the file by that digest, checks it is for the same skyline and the same DEM file, and **re-judges the stored metrics against the thresholds in the code**; the verdict recorded in the file is never trusted.

## How the two methods differ

| | Production skyline | Independent skyline |
| --- | --- | --- |
| Traversal | for each azimuth, walk a great-circle ray outward | for every DEM pixel inside 150 km (about 177 million per site), work out where it is |
| Sampling | bilinear interpolation at ray steps | raw pixel values, no interpolation |
| Geometry | 3-D vectors and a local east/north/up basis | inverse stereographic projection, haversine distance, spherical bearing, a 2-D elevation formula |
| Code | `horizon.py`, `terrain.py`, `observer.py` | shares none of it |

**What is not independent, and stays on the card:** both read the same DEM bytes and assume the same stated grid (30,400 pixels of 20 m, true scale at the pole, 1,737.4 km sphere). So this tests the skyline *computation*; it cannot find an error in the DEM.

## The gates

| Gate | Meaning |
| --- | --- |
| ray never above the inclusive skyline (at most 0.01 deg) | a bilinear sample can never exceed its four neighbours, so the ray skyline must not be higher than the highest pixel within a pixel diagonal of the ray. No tuning involved. |
| at least 99% of sectors within the physical tolerance | tolerance is what nearest-pixel and bilinear sampling can differ by: half a pixel times a 45 degree slope, seen from the nearer of the two features (0.34 deg at 1.7 km, 0.03 deg at 20 km). |
| no sector worse than 2 x its tolerance | |
| no azimuth shift | shifting or mirroring the independent skyline by up to 8 sectors never fits better. |
| at most 5% near-field sectors | sectors whose skyline is set within 100 m are counted, not compared (neither method resolves a single 20 m pixel at that range). |
| every sector compared or counted as near-field | nothing is silently skipped. |

## Results

| Site | Compared | Near-field | Median difference | 99th percentile | Within tolerance | Worst / tolerance | Ray above inclusive | Best shift |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `rule-89.5S-E0` | 3551 | 49 | 0.0022 deg | 0.553 deg | 100% | 0.35 | 0.0000 deg | 0 |
| `rule-89.5S-E120` | 3600 | 0 | 0.0041 deg | 0.127 deg | 100% | 0.46 | 0.0000 deg | 0 |
| `rule-89.5S-E240` | 3600 | 0 | 0.0109 deg | 0.235 deg | 100% | 0.53 | 0.0002 deg | 0 |

Far from the observer the two agree closely (in the first-attempt diagnosis at `rule-89.5S-E240`, sectors set beyond 60 km differed by a median of about 0.001 degrees). The larger differences are all close in, where one 20 m pixel is a large angle; that is what the tolerance describes. Relief *between* rays (what a ray skyline can under-estimate) is at most 0.05 degrees at these sites.

## How this was reached, honestly

The thresholds were not tuned to pass. The history is kept in the evidence files (`first_attempt_v1`) and in the module's comments:

1. **First attempt (declared before any real comparison):** a two-sided comparison against a neighbour-inclusive skyline with median 0.02, 99th percentile 0.10 and maximum 0.50 degrees. On `rule-89.5S-E240` it **failed** (median 0.058, 99th percentile 0.70, maximum 0.77 degrees). The ray was never above the independent skyline and there was no shift; the excess came from the definition itself, which counts every pixel within a full diagonal and so over-states steep near slopes. The check design was wrong, not the data.
2. **Revised design, reasoned from the physics:** a one-sided gate against the inclusive skyline (parameter-free) and a two-sided gate against the nearest-pixel skyline with a physical tolerance. Its first run failed 15 sectors at `rule-89.5S-E240` because the tolerance was taken at the *ray's* feature distance, not the nearer of the two features. Fixed, with the thresholds (99%, 2 x) unchanged.
3. **One tie found on real data:** at `rule-89.5S-E0`, azimuth 180 degrees runs exactly along a grid axis, half a pixel from two columns of pixel centres. The nearest-pixel rule was decided by floating-point rounding and missed a one-pixel-wide ridge (the independent skyline read 4.7 degrees against 7.5). "Within half a pixel" is now a closed interval (5 cm of slack), with a unit test that fails without it.

Each of those changes is in the code history and the unit tests: the comparison is tested to *fail* for a rotated skyline, a mirrored skyline, an independent skyline set lower than the rays, a missing sector and every individual threshold.

## What this does and does not show

- The production skyline is computed correctly to within the stated tolerance, on this DEM, at these three sites, and it does not under-estimate the terrain its rays pass through.
- It is **not** a check of the DEM, of the 150 km radius choice, or of any other site. A different skyline (another site, radius or DEM release) has a different digest and shows *not evaluated* until its own comparison is recorded.
- The DEM release is still scientifically unapproved and SDR-001 is unsigned, so every result stays `real_data_unverified`.
