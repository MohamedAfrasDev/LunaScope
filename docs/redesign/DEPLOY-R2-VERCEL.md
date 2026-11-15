# Deploying LunaScope Atlas on Vercel Hobby with Cloudflare R2 (no always-on backend)

Status: plan, not built. Branch: `redesign-layout`. `main` (the pitch version) is not touched by any phase here.

## 1. Why, and the goal

The Python service (FastAPI, the 20 m LOLA DEM, SPICE and Horizons data) is awkward to run: it needs a separate host (Render), the free tier sleeps,
and a cold start takes a long time. The Atlas mostly *shows* results, so most of what it needs can be computed once, offline, and served as
static files.

**Goal:** the public app is Vercel Hobby (the Next.js app) plus Cloudflare R2 (data files). No server runs Python in production for the
catalogue sites. Python stays as an offline build tool and, optionally, a small on-demand compute service for custom points.

**Non-goals:** changing the science, the labels or the product rules (the browser never decides visibility; unknown is not "not visible";
no combined Sun+Earth score; every block keeps its trust tag).

## 2. Limits we design around (check the current pricing pages before relying on them)

| Where | Limit (approximate) | Consequence |
|---|---|---|
| Vercel Hobby | ~100 GB transfer / month, ~1 M function calls, a few CPU-hours, non-commercial | Keep big files off Vercel; avoid a function call per request. Over the limit pauses the project (no bill). |
| Vercel function | ~4.5 MB response, 10 to 60 s, limited memory | Never ray-cast the DEM here. |
| Supabase free | 1 GB DB, 50 MB per file | Not used. |
| Cloudflare R2 free | ~10 GB stored, no download fees | Holds all data; its traffic does not count against Vercel. |

Budget: today one visit moves about 2 to 3 MB through Vercel (Atlas JavaScript, Cesium files, surface pictures), so roughly 30,000 visits a
month fit. Moving Cesium and the pictures to R2 about doubles that.

## 3. Target architecture

```
Browser ──► Vercel (Next.js pages, static JS)
   │
   ├──► R2 public bucket  (immutable JSON/binary: runs, horizons, series, terrain patches, Cesium, pictures)   <- no function call
   └──► [optional] Compute service (Hugging Face Space or similar)  <- only the "Compute" button for custom points
```

Data layout in the bucket (all keys immutable and content-addressed where possible, so they cache forever):

```
catalog/sites.json                       the site catalogue (today GET /sites)
references/GR-001.json                   reference definitions (today GET /references/{id})
runs/{runId}/summary.json                run summary and window
runs/{runId}/results.json                per-site results (intervals, events, series)
runs/{runId}/horizon/{siteId}.json       skyline profile (today /analyses/{id}/horizon/{site})
runs/{runId}/provenance.json, validation.json, export.zip
terrain/{siteId}.bin + .json             terrain patch (today GET /terrain/patch)
grid/{cellId}/...                        precomputed grid for custom points (Phase 5, option A)
manifest.json                            index: versions, run ids, grid spacing, build hash
```

## 4. Phases

Each phase ends with something that works and can be checked. No phase removes the live backend path until Phase 6.

### Phase 0: Measure and decide (half a day)

- Record the real numbers: total size of the three reference runs' bundles, one horizon, one terrain patch (25 km at 150 m is about 300 KB),
  Cesium and the pictures. Run `perf-budget.spec.ts` on a production build for the current transfer per visit.
- Decide how custom points work (see Phase 5): **A** snap to a precomputed grid, **B** compute in a function from a cropped DEM, **C** keep a
  small compute service. Default: A, with C only if A is not enough.
- Create the Cloudflare account, the R2 bucket `lunascope-data`, enable the public `r2.dev` domain (later a custom domain), and write the CORS
  rule: allow `GET` and `HEAD` from the Vercel origin and `http://localhost:3000`.

Done when: the numbers are written in this file and the bucket answers a test `GET` from the browser.

### Phase 1: Export script (Python, offline) (1 to 2 days)

- Add `science/scripts/export_static.py`. It runs the existing service code in-process (no HTTP) for each reference run and catalogue site and
  writes the layout in section 3 to `var/static-export/`, plus `manifest.json`.
- Reuse what exists: `run` creation, `/results`, `/horizon`, `/provenance`, `/validation`, the export bundle, and `sample_patch` for terrain.
- Every file keeps the service's `result_state` and trust fields unchanged. The export must be byte-reproducible (stable key order, fixed
  rounding) so the content hash is stable.
- Gzip or brotli the JSON. Keep each file under a few MB.
- Test: `science/tests/unit/test_export_static.py` checks the layout, that a re-run gives identical bytes, that every `runs/*/horizon` listed in
  the summary exists, and that no file exceeds the size cap.

Done when: `python scripts/export_static.py` produces the tree and its tests pass.

### Phase 2: Upload to R2 (half a day)

- `scripts/upload_r2.mjs` (Node, S3-compatible API with `@aws-sdk/client-s3`) uploads only changed files (compare the manifest hashes).
- Headers: `Cache-Control: public, max-age=31536000, immutable` for hashed or run-id keys; `max-age=300` for `manifest.json` and
  `catalog/sites.json`; correct `Content-Type` and `Content-Encoding`.
- Credentials live in environment variables, never in the repo. Use an R2 API token scoped to this bucket, write access for the script only.

Done when: every key in the manifest returns 200 with the right headers from the public URL, and a second upload sends nothing.

### Phase 3: Static data client in the web app (1 to 2 days)

- Add `lib/api/static.ts`: a reader that maps the existing API paths to R2 keys (for example `analyses/{id}/horizon/{site}` to
  `runs/{id}/horizon/{site}.json`) and returns the same typed objects the app already uses (`lib/api/types.ts`), so the Atlas hooks
  (`useRun`, `useHorizon`, `useTerrainPatch`, `useSiteRuns`) need no changes beyond the base URL.
- Switch with one setting: `NEXT_PUBLIC_DATA_BASE` (the R2 URL). When set, `getJson` reads static files; when unset, it uses `/api/v1/*` as today.
- Keep the same error handling and the replay-style "this copy is read-only" wording for anything that is not available statically.
- Remove nothing from `lib/bff.ts` yet.
- Tests: unit tests for the path-to-key map and for falling back; an e2e that loads the Atlas with `NEXT_PUBLIC_DATA_BASE` pointing at a local
  static server and checks GR-001 loads, Site sky draws, and no `/api/v1` request is made.

Done when: with the base set, the Atlas works end to end against files only (Moon, sites, run, Site sky with real terrain, panels).

### Phase 4: Move heavy assets off Vercel (half a day)

- Move `public/cesium` and the large pictures (`public/explore/moon-2k.jpg`, the Blue Marble and SDO images) to R2 under `assets/`, and point
  `CESIUM_BASE_URL` and the image constants (`lib/atlas/sky-look.ts`, `lib/explore/geometry.ts`) at `NEXT_PUBLIC_ASSET_BASE`.
- Keep a local fallback for development.
- Re-run the perf budget: expected Vercel transfer per visit drops to the app JavaScript only.

Done when: a production visit shows no Cesium or picture request to the Vercel origin.

### Phase 5: Custom points and new dates (2 to 5 days, pick one)

- **A. Precomputed grid (recommended first).** Export horizons for a grid of points near the pole (for example every 0.5 degrees of longitude
  at selected latitudes, tuned so a 150 km footprint overlaps). "Place a point" snaps to the nearest cell and says so in the panel
  ("approximate: nearest precomputed point, 3.2 km away"), tagged `DERIVED`. Free, static, instant. Accuracy loss is shown, never hidden.
- **B. Compute in a Vercel function.** Port the horizon and ephemeris code to TypeScript and read a cropped 100 m DEM tile (about 3000 by 3000)
  from R2 with range requests. Needs validation against the Python results (the same acceptance checks as `science/tests`). Watch the
  10 to 60 s and memory limits. Highest effort.
- **C. Small compute service.** Keep the Python image on a Hugging Face Space (free CPU, 16 GB) or Oracle Cloud Always Free, reached only
  from the Compute button, rate limited. It can sleep: the UI already has "Try again" and a loading state. Lowest effort, keeps full accuracy.

Done when: a custom point either snaps with a clear label (A) or computes (B, C), with the same trust tags as today.

### Phase 6: Cut over and remove the backend dependency (1 day)

- Set the production environment on Vercel: `NEXT_PUBLIC_DATA_BASE`, `NEXT_PUBLIC_ASSET_BASE`, and the compute URL if Phase 5 chose C.
- Remove the `/api/v1/*` proxy from production use (keep it for local development against the Python service). Delete the Render service.
- Add a short runbook: how to re-export and upload after a science change, how to roll back (re-upload the previous export), and how to
  check the limits.
- Update `README.md`, `docs/USER-GUIDE.md` (deployment note) and `docs/submission/LICENCES-AND-CITATIONS.md` if any asset moved.

Done when: the production site works with the Python service stopped, and a load test of repeated page loads stays well inside the limits.

### Phase 7: Guard the limits (ongoing, small)

- Keep Vercel function calls at about zero for normal browsing; alert on the Vercel usage page weekly during judging.
- Rate-limit the compute call (Phase 5 C) and cache its results back to R2 keyed by the request hash, so repeat requests are free.
- Keep the perf budget test in CI against the production build (JavaScript, images, layout shift).

## 5. Risks and answers

| Risk | Answer |
|---|---|
| Static data goes stale after a science change | The manifest carries a build hash; the app shows it in Evidence; CI fails if the export does not match the code. |
| Custom points less accurate in option A | Always labelled approximate with the distance to the cell; option C restores exact compute. |
| R2 public URL changes or is blocked | Use a custom domain on Cloudflare; keep `NEXT_PUBLIC_DATA_BASE` the only place the URL lives. |
| Cache serves an old file | Immutable keys by run id or hash; only `manifest.json` and the catalogue use short caches. |
| Vercel Hobby paused at the limit | Phases 3 and 4 keep transfer small; alert in Phase 7; the pitch version on `main` is separate. |
| Hobby is non-commercial | Fine for the hackathon and a demo; revisit if the product is sold. |

## 6. Order and effort

Phase 0 (0.5 d), 1 (1 to 2 d), 2 (0.5 d), 3 (1 to 2 d), 4 (0.5 d), 5A (1 to 2 d), 6 (1 d), 7 (ongoing). Phases 0 to 4 and 6 already
remove the Python backend for every catalogue site and reference run; Phase 5 decides only what happens to custom points.
