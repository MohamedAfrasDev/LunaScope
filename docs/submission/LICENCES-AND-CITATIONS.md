# Licences, data terms and citations

**Checked:** 14 Nov 2026. Direct dependencies were read from each installed package's own metadata. Transitive dependencies (the full tree) are **not** listed here; run a licence scanner before final submission if the event requires a complete list.

## Data and services (from the committed manifests)

| Resource | What it is used for | Terms recorded in the manifest | Citation |
| --- | --- | --- | --- |
| `LDEM_80S_20MPP_ADJ.TIF` (LOLA, PGDA 2023) | Primary terrain model | No separate licence stated on the source page; treated as a NASA-produced open dataset with a **citation request**. **Not confirmed in writing by the publisher.** | Barker et al. 2023, *Planet. Sci. J.* 4, 183, doi 10.3847/PSJ/acf3e1; data DOI 10.60903/gsfcpgda-lola-spole |
| `LDEM_80S_20M.IMG` (PDS) | Cross-check terrain model | PDS Geosciences FAQ: archived data sets are public domain; cite the data set | NASA Planetary Data System, Geosciences Node (LOLA LDEM) |
| JPL Horizons API | Sun and Earth directions | Public service with a fair-use policy: identify the client with contact details and send requests one at a time. **The contact value is still missing (D-11), so the client refuses to run live.** | NASA/JPL Solar System Dynamics, Horizons |
| NAIF SPICE kernels (de440s and frame kernels) | Independent geometry check | NAIF generic kernels are public; cite NAIF. **Manifest says: confirm exact wording before publication.** | NASA NAIF / JPL |
| LROC QuickMap, NASA Moon Trek | Looking at terrain only | Not numerical inputs; visual references | As each portal asks |

## Software (direct dependencies, licence as declared by the package)

**Web, shipped:** Next.js 16.4.6 (MIT), React 19.3.0 and React DOM (MIT). Font: Geist and Geist Mono via `next/font/google`, published under the SIL Open Font License 1.1 (**confirm against the font's own licence file before listing**).

**Science service, shipped:** NumPy (BSD-3-Clause and others), SciPy (BSD), FastAPI (MIT), Pydantic (MIT), Uvicorn (BSD-3-Clause), httpx (BSD-3-Clause), rfc8785 (Apache-2.0), SpiceyPy (MIT), rasterio (BSD-3-Clause), pyproj (MIT).

**Development and test only, not distributed:** TypeScript and Playwright (Apache-2.0); axe-core Playwright (**MPL-2.0**); Hypothesis (**MPL-2.0**); Vitest, Vite, ESLint, Testing Library, jsdom, Tailwind CSS, openapi-typescript, pytest, ruff (MIT).

The two MPL-2.0 packages are used for testing only and are not part of the shipped application.

## Images and logos

No images are used. The five scaffold SVGs left by Create Next App (including a Vercel logo) were unused and have been removed. **No NASA logo, insignia or mission patch is used, generated or altered.** The explainer's diagram is an original schematic drawn in the repository.

## Required statements (already in the product footer)

Not flight-qualified; does not certify landing safety, electrical power, link performance or mission feasibility; **not endorsed by NASA**.
