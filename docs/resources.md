# Resource inventory (Phase 1 step 1.1)

Every numerical resource has a manifest in `data/manifests/`, is checked at service start
(`GET /api/v1/health` -> `resources_ok`, `GET /api/v1/resources` -> per-file status) and can be
fully hashed with `python science/scripts/verify_resources.py`.
`resources_ok` means the files are present with the pinned sizes. It does **not** mean the
resource is scientifically approved (`resources_approved` stays `false` until SDR-001 is signed).

| Resource | Official source | Role | Manifest |
| --- | --- | --- | --- |
| LOLA 20 m south-polar DEM, adjusted (`LDEM_80S_20MPP_ADJ`) | NASA GSFC PGDA, Barker et al. 2023 (DOI 10.3847/PSJ/acf3e1; data DOI 10.60903/gsfcpgda-lola-spole) | primary terrain | `dem-lola-80s-20mpp-adj.json` |
| LOLA 20 m south-polar DEM (`LDEM_80S_20M` v2.0) | NASA PDS Geosciences Node | cross-check terrain | `dem-pds-ldem-80s-20m.json` |
| NAIF SPICE kernels (LSK, lunar frame kernel, lunar PCK, DE440s) | NASA NAIF / JPL | independent geometry reference | `spice-kernels.json` |
| JPL Horizons API | NASA JPL Solar System Dynamics | primary geometry provider | `horizons-api.json` |
| LROC QuickMap, NASA Moon Trek | NASA / Arizona State University LROC; NASA JPL | **visual portals only** | none (not a numerical input) |

QuickMap and Moon Trek are used to look at terrain and to orient the team. No number in any result
is read from them: a numerical input must be a pinned file with a checksum. If a team member uses a
portal to choose a site, that choice is recorded as the site input, not as a data resource.

Citation text to carry into the product (confirm exact wording before submission):
- LOLA DEM: Barker et al. 2023, PSJ, doi:10.3847/PSJ/acf3e1; LOLA team, NASA PDS.
- Horizons: JPL Horizons On-Line Ephemeris System, NASA JPL Solar System Dynamics.
- SPICE: NASA NAIF, generic kernels (naif0012, moon_de440, de440s).
