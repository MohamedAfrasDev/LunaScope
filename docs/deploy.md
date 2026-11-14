# Deployment, smoke test and offline fallback

## Status: read this first

| Piece | State |
| --- | --- |
| Service and web run locally (`uvicorn`, `next dev`) | Verified |
| Service installs and imports in a clean environment with only its declared dependencies | Verified (this found that `pyproject.toml` omitted `spiceypy`, `rasterio` and `pyproj`; fixed) |
| `scripts/smoke.mjs` against the local synthetic stack | Verified, 10 of 10 steps |
| Offline fallback: build, rehearse with the network blocked, browser spec | Verified on the **synthetic** stack |
| `deploy/*.Dockerfile` and `deploy/compose.yml` | **Built and run on one machine (14 Nov, Docker Desktop on Windows).** Both images build; the stack starts healthy; `smoke.mjs` passes 10 of 10 against it; the service runs as a non-root user; the token is enforced (only `/health` is exempt); the store and skylines are written to the volume and a run survives a service restart; the packaged fallback opens in a replay container. **Not yet run on a host or from a clean CI machine** |
| Anything hosted (Vercel, a container host) | **Not deployed** |
| A fallback package of **real** data | **Not built** (needs the DEMs, the SPICE kernels, the Horizons contact, and network) |

## Two processes

```
browser -> web (Next.js, BFF) -> science service (FastAPI) -> store, caches, data files
```

The browser only ever talks to the web app. The web app adds the service token and forwards allow-listed routes; the service URL and token are server-side environment variables, never sent to the browser.

| Variable | Where | Meaning |
| --- | --- | --- |
| `SCIENCE_API_URL` | web | Base URL of the service, e.g. `http://service:8000` (default `http://127.0.0.1:8000`) |
| `SCIENCE_API_TOKEN` | web | Shared secret sent as a bearer token |
| `LUNASCOPE_API_TOKEN` | service | The same secret; `/api/v1/health` is exempt so probes work |
| `LUNASCOPE_STACK` | service | `synthetic` (offline, labelled demonstration data) or `live` |
| `LUNASCOPE_MODE` | service | `live` or `replay` (serves saved runs only; `409 REPLAY_ONLY` otherwise) |
| `LUNASCOPE_DATA_DIR` | service | Store, artifacts, skylines, Horizons response cache. **Needs a persistent volume** |
| `LUNASCOPE_CONTACT` | service | Contact for the Horizons User-Agent. **Required for the live stack; still undecided (D-11)** |

Generate a token with `openssl rand -hex 32`. Do not commit it.

## With containers

```bash
export LUNASCOPE_API_TOKEN=$(openssl rand -hex 32)
docker compose -f deploy/compose.yml up --build        # synthetic stack by default; web on :3000
```

For the live stack mount the large data files read-only at `data/raw/` (they are not in the image): the two DEMs and `data/raw/spice/`. See `docs/resources.md` and `scripts/verify_resources.py` for the exact files and checksums.

The service image keeps the repository layout (`/app/science`, `/app/data`) because the code finds its manifests relative to the package.

## Smoke test

```bash
node scripts/smoke.mjs https://your-host --stack synthetic --mode live
```

It goes through the web app: health, GR-001, run, label and cache headers (including a 304), the export hash, and the run, evidence and Time Machine pages. Exit code 0 only if every step passes. Run it **as soon as something is deployed**, not at the end.

## Offline fallback (test case 16)

Build a package from the real service code, then rehearse it with the network blocked:

```bash
science/.venv/Scripts/python science/scripts/build_fallback.py build --stack synthetic     # writes ./fallback
science/.venv/Scripts/python science/scripts/build_fallback.py check fallback
npm run test:e2e:fallback                                                               # needs port 8000 free
```

`check` opens the package in replay mode with every non-loopback socket and DNS lookup refused, confirms each packaged run is served and matches its recorded SHA-256, that the Home button and the five-day shift resolve to the packaged runs, that an unpackaged request is refused (`REPLAY_ONLY`), and that **zero** network attempts happened. The browser spec confirms the page says "Replay mode" and makes no request to another host.

To start it for real, see `fallback/README.md` (written by `build`). The web app shows a **Replay mode** badge on every page.

**A synthetic package is only a rehearsal.** For the pitch, build with `--stack live` after GR-001 is chosen and frozen, then run `check` on that package.

## Before relying on any of this

1. ~~Build both images and run the smoke test against them~~ done locally; repeat on the host.
2. Deploy somewhere reachable and run the smoke test there, signed out.
3. Build the live fallback package and rehearse it with Wi-Fi off.
4. Freeze versions and record commit and checksums (`reference_run.py` and `build_fallback.py` write these).
