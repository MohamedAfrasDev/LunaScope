# Run LunaScope on your computer (full compute)

The hosted site is a showcase of **pre-built results**: the Moon, the catalogue sites, the saved reference runs (GR-001, GR-002, GR-003),
Site sky, Timeline, Metrics, Clearance, Evidence and Compare. It is an offline copy, so it cannot compute anything new.

To analyse your own sites, dates and points, run the two parts on your computer. You need Node 20+ and Python 3.12+.

## 1. Get the code

```bash
git clone https://github.com/MohamedAfrasDev/LunaScope.git
cd LunaScope
```

## 2. Start the science service (terminal 1)

```bash
cd science
python -m venv .venv
.venv/Scripts/python -m pip install -e .          # Windows; on macOS or Linux use .venv/bin/python
.venv/Scripts/python -m uvicorn lunascope.main:create_app --factory
```

By default this is the **synthetic** stack: it computes instantly with invented demonstration tracks and a demonstration ridge, and
labels everything `SYNTHETIC`. It needs no downloads. Use it to try every feature: Analyse, Compute sky for a point, Place a point, Dates.

### Real data (optional, about 4.4 GB)

Real results need the LOLA terrain and the SPICE kernels in `data/raw/` (see `data/raw/run_all.sh` and `docs/deploy.md`). With them in place:

```bash
set LUNASCOPE_STACK=live        # PowerShell: $env:LUNASCOPE_STACK = "live"
.venv/Scripts/python -m uvicorn lunascope.main:create_app --factory
```

Live runs also read ephemeris from JPL Horizons over the internet and take seconds to minutes per run. Results carry the label
`Real data, unverified`.

## 3. Start the web app (terminal 2)

```bash
npm install
npm run dev
```

Open http://localhost:3000/atlas. The Analyse panel and "Compute sky for this site" now work, and "Place a point" adds a computed point.

Not flight-qualified. Screening and education only. Not endorsed by NASA.
