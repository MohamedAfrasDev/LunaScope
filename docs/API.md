# LunaScope science service — API (implemented subset)

Base path `/api/v1`, JSON, UTC times ending in `Z`, angles in degrees. The service never computes science in the request path: it validates, hashes, admits (or attaches to) a run, and reads immutable results back. Workers run in separate OS processes.

```bash
cd science
# synthetic stack: instant, offline, always labelled synthetic_demonstration
LUNASCOPE_STACK=synthetic .venv/Scripts/python -m uvicorn lunascope.main:create_app --factory
# live stack: Horizons + LOLA DEM + SPICE; needs data/raw files and network on first use
LUNASCOPE_STACK=live      .venv/Scripts/python -m uvicorn lunascope.main:create_app --factory
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `LUNASCOPE_STACK` | `synthetic` | `synthetic` or `live` |
| `LUNASCOPE_MODE` | `live` | `replay` serves only runs already in the store (`409 REPLAY_ONLY` otherwise) |
| `LUNASCOPE_DATA_DIR` | `var/` | SQLite store, artifacts, staging, Horizons response cache |

## Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Mode, stack, limits, queue counts, running ids, what start-up recovery did |
| `GET /resources` | Resource manifests with readiness (`integrity_verified` is not scientific approval) |
| `GET /sites` | Demonstration catalog with DEM footprint coverage; **not** candidate landing sites |
| `POST /sites/custom` | Validate a typed point, normalise longitude, keep the source point, report DEM coverage |
| `POST /analyses` | Admit a run: `202` new, `200` already exists (attach). `503 QUEUE_FULL` + `Retry-After` |
| `GET /analyses/{run_id}` | Status, stage, progress; once done also the per-site matrix and warnings |
| `GET /analyses/{run_id}/results?site=&target=&include=intervals,events,series` | Metrics; arrays only when asked |
| `GET /analyses/{run_id}/provenance` | Resources, settings, observers, horizon identity, geometry hashes and checks, caveats |
| `GET /analyses/{run_id}/horizon/{site_id}` | Skyline profile |
| `GET /analyses/{run_id}/countdown?site=&target=&horizon=&t=` | Server-decided countdown at a cursor time `t` (seconds from the window start): next set or rise with its solver bracket, `in_decision_band`, `unknown`, `no_event` or `mission_end`. The browser only subtracts the cursor from the returned time |
| `POST /comparisons` | Body `{runs: [id] or [idA, idB], sites?: [...], alignment?: "elapsed" or "calendar"}`. One run: compares its sites (at least two) on identical inputs. Two runs: checks they are variants of each other (`422 INCOMPATIBLE_RUNS` with reasons otherwise), lists held and changed fields, deltas and changed intervals under the chosen alignment. Facts are typed records; there is no winner, rank or score |
| `GET /analyses/{run_id}/export` | Investigative bundle + `X-Content-SHA256`; `?verified=true` is refused (`409 EXPORT_BLOCKED_UNVERIFIED`) |

Not built yet: variants, comparisons, facts, share links.

## Request (`POST /analyses`)

Strict: unknown fields, string-for-number, naive or non-UTC times, and over-limit values are `422 INVALID_INPUT` with the field path. Bounds: start 2020-2100 whole minute; duration 1 h to 30 d; step 60 to 3600 s dividing the duration; radius 1 to 300 km; azimuth step 0.05 to 2 deg dividing 360; observer height 0 to 50 m; 1 to 6 sites; sites x targets x samples at most 60,000; body at most 64 KB. A site is `{"site_id": "<catalog id>"}` or a typed `custom` point (latitude -90 to -80, source text, precision). No paths or URLs are accepted anywhere; the DEM is a named profile.

```json
{"mission": {"start_utc": "2027-01-10T00:00:00Z", "duration_s": 604800},
 "sites": [{"site_id": "rule-89.5S-E0"}],
 "requirements": {"sun_min_availability": 0.6, "earth_min_availability": 0.5},
 "terrain": {"dem_profile": "lola-80s-20m-adj", "radius_km": 150, "az_step_deg": 0.1},
 "options": {"sensitivity": false}}
```

## Identity and lifecycle

- `run_id` = SHA-256 of the named fields (canonical request with resolved sites, every numerical default, resource pins, algorithm id). It is known at admission and is the polling id; the same request gives the same id in any deployment.
- `result_id` is sealed by the worker after all inputs are known.
- Admission is one SQLite transaction: if the id exists the caller attaches (even when the queue is full); otherwise capacity is checked and the row inserted. Only the caller whose insert created the row wakes the supervisor.
- Statuses: `queued`, `running`, `complete`, `complete_with_warnings`, `failed`. At most 2 running and 8 queued by default.
- Each execution is an attempt in its own process. A timeout kills the process and fails the run (`TIMEOUT`, no retry); a crash is retried once then fails (`ATTEMPT_LIMIT`); a handled error fails with its own code. Publishing is conditional on the attempt still being current, so a killed or stale attempt cannot publish.
- On start-up, runs left `running` by a dead process are requeued or failed, and their staging is removed.

## Result states

`synthetic_demonstration` (synthetic stack) or `real_data_unverified` (live stack). `validated` is never produced yet; every response carries `verified: false`, `validated_scopes: []` and the matching warning (`DEMONSTRATION_DATA` or `UNVERIFIED`).

## Errors

```json
{"error": {"code": "INVALID_INPUT", "message": "...", "field": "terrain.az_step_deg", "retryable": false, "correlation_id": "..."}}
```

Codes: `INVALID_INPUT` 422, `NOT_FOUND` 404, `NOT_READY` 409, `REPLAY_ONLY` 409, `EXPORT_BLOCKED_UNVERIFIED` 409, `QUEUE_FULL` 503, `GEOMETRY_PROVIDER_UNAVAILABLE` 502, `RESOURCE_INTEGRITY_FAILED` 500. `X-Correlation-ID` is echoed or generated on every response.
