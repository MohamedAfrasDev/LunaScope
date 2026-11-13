# Performance record (Phase 1 step 1.9)

Measured on the development machine (Windows 11, Python 3.13, files on local disk, OS file cache
warm after the first run). One run per site; no repeats, so these are single observations, not
distributions. Other machines and cold caches are **not measured**.

## First real run (RUN-001: three sites, 0.1 deg step, 150 km, real ADJ DEM, SPICE + Horizons cache)

| Site | terrain load | horizon | geometry | events | total |
| --- | --- | --- | --- | --- | --- |
| E0 | 3.7 s | 9.7 s | 0.6 s | 0.6 s | 14.7 s |
| E120 | 4.2 s | 9.7 s | 0.5 s | 0.5 s | 14.9 s |
| E240 | 5.4 s | 10.7 s | 0.7 s | 0.7 s | 17.4 s |

Source: `timing_s` in `docs/runs/bundles/*.json`.

## Against the budgets

| Budget (spec) | Measured | State |
| --- | --- | --- |
| Per-site horizon, 20 s target at the finest allowed settings | 9.7 to 10.7 s at 0.1 deg; 8.6 s in the earlier single-site check; 0.025 deg took about 60 to 88 s in the convergence study | **Met at the default step. Not met at 0.025 deg** (that step is for studies, not requests) |
| Whole run, 120 s timeout | 14.7 to 17.4 s per site, sites run one after another | Met with margin for 3 sites; scale with site count |
| Window memory | about 937 MB window held in RAM for the PDS product | Constrains concurrency: 2 running runs may hold two windows |
| Precomputed showcase horizon read < 300 ms | **Not built, not measured** | Open |
| Cached vs uncached Horizons latency | **Not measured** (recorded responses only; no new requests without a contact, SDR-001 D-11) | Open |

## Reading

- Horizon ray-marching dominates (about two thirds of the time); geometry and events are under a
  second per site once the Horizons responses are cached and the SPICE reference is loaded.
- Time scales about linearly with 1 / azimuth step, which is why 0.1 deg is the default and why
  the discretisation study in SDR-001 caps what a request may ask for.
- Per-stage timings are also logged as JSON when `LUNASCOPE_LOG=json` (`run_finished`).
