# Licences, data terms and citations

**Checked:** 14 Nov 2026. Direct dependencies were read from each installed package's own metadata. Transitive dependencies (the full tree) are **not** listed here; run a licence scanner before final submission if the event requires a complete list.

## Data and services (from the committed manifests)

| Resource | What it is used for | Terms recorded in the manifest | Citation |
| --- | --- | --- | --- |
| `LDEM_80S_20MPP_ADJ.TIF` (LOLA, PGDA 2023) | Primary terrain model | No separate licence stated on the source page; treated as a NASA-produced open dataset with a **citation request**. **Not confirmed in writing by the publisher.** | Barker et al. 2023, *Planet. Sci. J.* 4, 183, doi 10.3847/PSJ/acf3e1; data DOI 10.60903/gsfcpgda-lola-spole |
| `LDEM_80S_20M.IMG` (PDS) | Cross-check terrain model | PDS Geosciences FAQ: archived data sets are public domain; cite the data set | NASA Planetary Data System, Geosciences Node (LOLA LDEM) |
| JPL Horizons API | Sun and Earth directions | Public service with a fair-use policy: identify the client with contact details and send requests one at a time. **The contact value is still missing (D-11), so the client refuses to run live.** | NASA/JPL Solar System Dynamics, Horizons |
| NAIF SPICE kernels (de440s and frame kernels) | Independent geometry check | NAIF generic kernels are public; cite NAIF. **Manifest says: confirm exact wording before publication.** | NASA NAIF / JPL |
| `AVGVISIB_85S_060M_201608.TIF` and `..._EARTH.TIF` (NASA GSFC PGDA, Lunar Polar Illumination) | A reference to compare our results against (not an input) | The page states no licence and asks only for citation; not committed to this repository (downloaded to `data/raw/`, git-ignored). **Confirm wording before publication.** | Mazarico, E. et al. (2011), Illumination conditions of the lunar polar regions using LOLA topography, Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030 |
| `MOON_nomenclature_center_pts.zip` (IAU Gazetteer of Planetary Nomenclature, Moon centre points; USGS Astrogeology) | The names and centre coordinates of twelve named south-polar places | The file's own metadata says "Public domain."; the zip is not committed (git-ignored in `data/raw/iau/`), only the twelve rows used (`data/sites/iau_extract.json`, with the file's SHA-256) | IAU Working Group for Planetary System Nomenclature; Gazetteer of Planetary Nomenclature, USGS Astrogeology Science Center, https://planetarynames.wr.usgs.gov |
| LROC QuickMap, NASA Moon Trek | Looking at terrain only | Not numerical inputs; visual references | As each portal asks |
| NASA Moon Trek tiles, layer `LRO_WAC_Mosaic_Global_303ppd_v02` (LROC wide-angle camera mosaic; NASA/GSFC/Arizona State University) | The picture on the Moon explorer (`/explore`), streamed from `trek.nasa.gov` as tiles. **Illustration of the surface only; never a result and never an input** | NASA's media guidelines allow use with NASA acknowledged as the source and no implied endorsement. **Moon Trek's own terms page could not be read (it is script-rendered) and must be confirmed by the project owner before submission** | NASA/GSFC/Arizona State University, Lunar Reconnaissance Orbiter Camera, via NASA Moon Trek |

## Software (direct dependencies, licence as declared by the package)

**Web, shipped:** Next.js 16.4.6 (MIT), React 19.3.0 and React DOM (MIT), three.js 0.187.0 (MIT, the 3D sky view), CesiumJS 1.147.0 (Apache-2.0, the Moon explorer at `/explore`). Font: Geist and Geist Mono via `next/font/google`, published under the SIL Open Font License 1.1 (**confirm against the font's own licence file before listing**).

**Science service, shipped:** NumPy (BSD-3-Clause and others), SciPy (BSD), FastAPI (MIT), Pydantic (MIT), Uvicorn (BSD-3-Clause), httpx (BSD-3-Clause), rfc8785 (Apache-2.0), SpiceyPy (MIT), rasterio (BSD-3-Clause), pyproj (MIT).

**Development and test only, not distributed:** TypeScript and Playwright (Apache-2.0); axe-core Playwright (**MPL-2.0**); Hypothesis (**MPL-2.0**); Vitest, Vite, ESLint, Testing Library, jsdom, Tailwind CSS, openapi-typescript, pytest, ruff (MIT).

The two MPL-2.0 packages are used for testing only and are not part of the shipped application.

## Images and logos

One photographic image is used: a decorative night view of the Earth's limb behind the Home introduction (`app/images/hero-2400.jpg`, a 2400 px copy of `app/images/hero-bg.jpg`). It is not data and is labelled on the page as an illustration, **not NASA imagery**. A second image, `public/explore/moon-2k.jpg`, is **NASA imagery**: the same Moon Trek layer, level 2, stitched and re-compressed (2048 x 1024) as the offline fallback for the explorer; it carries the same credit. **Its source and licence are not recorded in this repository and must be confirmed by the project owner before submission** (see the open item in `docs/ui/GALAXY-PLAN.md`, Appendix I); if they cannot be, remove the image (the hero falls back to the plain night background by deleting `HeroStage`'s `Image`). The five scaffold SVGs left by Create Next App (including a Vercel logo) were unused and have been removed. **No NASA logo, insignia or mission patch is used, generated or altered.** The explainer's diagram is an original schematic drawn in the repository.

## Required statements (already in the product footer)

Not flight-qualified; does not certify landing safety, electrical power, link performance or mission feasibility; **not endorsed by NASA**.
