# LunaScope

Terrain-aware lunar power and direct-to-Earth opportunity navigator — NASA Space Apps Challenge 2026.

LunaScope is a **screening and education tool**. It is not a certification of landing safety, electrical power, link performance or mission feasibility. No result in this repository is a validated lunar result yet; synthetic values carry a persistent label.

## Documents

- [Product and Technical Specification v2.1](<LunaScope Product and Technical Specification v2.1.md>)
- [Implementation Specification (v1.1)](docs/LunaScope-Implementation-Spec.md)
- [Phase plan and to-do tracker](docs/LunaScope-Phase-Plan.md)
- [API reference (implemented subset)](docs/API.md)
- [RUN-001: first real end-to-end run](docs/runs/RUN-001-first-real-run.md)
- [Deployment, smoke test and offline fallback](docs/deploy.md)
- [Submission drafts: claims audit, licences, disclosures](docs/submission/CLAIMS-AUDIT.md)
- [SDR-001 science decision record (draft)](docs/sdr/SDR-001.md)

## Layout

- `app/` — Next.js 16 web app (display only; never computes visibility)
- `science/` — Python science service (all visibility, event and metric logic)
- `data/` — resource manifests and site catalog
- `docs/` — specs and decision records

## Web app

```bash
npm install
npm run dev
```

Read `node_modules/next/dist/docs/` before changing routes — this Next.js version differs from older ones (see `AGENTS.md`).

## Science service

```bash
cd science
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"   # Windows; use .venv/bin/python elsewhere
.venv/Scripts/python -m pytest
.venv/Scripts/python -m uvicorn lunascope.main:create_app --factory
```

## Checks

```bash
npm run verify          # API types current, typecheck, lint, web tests
npm run test:e2e        # Playwright core flow + axe (needs the service on :8000 and the web app on :3000, synthetic stack)
npm run test:e2e:fallback   # case 16: the offline fallback opens the demo (build it first, see docs/deploy.md)
node scripts/smoke.mjs http://localhost:3000   # smoke test of a running deployment
cd science && .venv/Scripts/python -m pytest && .venv/Scripts/python -m ruff check .
```
