# Offline fallback: start LunaScope with no network

This folder holds saved runs only. The service runs in REPLAY mode: it serves what is packaged and
refuses everything else (`REPLAY_ONLY`). The web app shows a "Replay mode" label on every page.

Built: 2026-11-15T13:56:51Z UTC by commit `2b0b28c46068` (uncommitted changes), algorithm 0.2.0-phase1, stack **live**.
Real data, unverified: no validation gate has closed. GR-001 is frozen. Its three sites are rule-chosen points, not candidate landing sites.

## Start (two commands, from the repository root)

```bash
# 1. the service, replay mode, reading this package
LUNASCOPE_STACK=live LUNASCOPE_MODE=replay LUNASCOPE_DATA_DIR=fallback/data \
  science/.venv/bin/python -m uvicorn lunascope.main:create_app --factory --port 8000   # Windows: science\.venv\Scripts\python.exe
# 2. the web app (build once with `npm run build`)
npm run start -- --port 3000
```

Or with containers: `LUNASCOPE_MODE=replay LUNASCOPE_STACK=live LUNASCOPE_API_TOKEN=local docker compose -f deploy/compose.yml up`
after copying `fallback/data` into the `lunascope-data` volume.

Open http://localhost:3000 and press **Start the reference mission**: it opens the packaged GR-001 run.
Packaged runs: see FALLBACK-MANIFEST.json. Check the package: `python science/scripts/build_fallback.py check fallback`.
