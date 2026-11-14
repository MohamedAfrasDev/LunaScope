# Comparison with NASA's published illumination maps

**State: `real_data_unverified`. Ten-site gate met; three-site gate NOT met.** LunaScope's long-term sunlit and Earth-visible fractions agree closely with an independent NASA product at ten south-polar sites, but one pre-declared gate failed, so **no validation scope is closed by this comparison**. The result is recorded in full below.

## The reference (not produced by this project)

NASA Goddard PGDA, [Lunar Polar Illumination](https://pgda.gsfc.nasa.gov/products/69): `AVGVISIB_85S_060M_201608` (percentage of time the Sun is visible) and `AVGVISIB_85S_060M_201608_EARTH` (the same for Earth), computed from LOLA topography, hourly over a lunar nutation cycle (about 18.6 years), 60 m per pixel, 85S to the pole. Sun and Earth are discs; Earth counts as visible if any part of its disc is unobscured. Cite: Mazarico et al. 2011, *Icarus* 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030. Files are in `data/raw/illumination/` (git-ignored); their SHA-256 are in the evidence JSON.

## What was compared

Our skyline (the production engine on the pinned 20 m LOLA DEM, 150 km, 0.1 degree) at **ground level** (the map states no observer height), combined with **hourly SPICE directions over 18.6 years** (`spkcpo`, `LT+S`), counting the upper limb of the Sun and of Earth above the skyline. Code: `science/lunascope/illumination_check.py` (gates) and `science/scripts/illumination_check.py` (run). Evidence: [`evidence/illumination-vs-map.json`](evidence/illumination-vs-map.json).

The map is a long-term average, so this tests the whole chain (terrain, skyline, geometry, time integration) against a long-term product. It does not test our one-week reference window directly.

**The gates were written in the code before the comparison was run and were not changed afterwards.**

## Result: ten sites (gate B)

| Site (lat, lon E) | Sun ours | Sun map | Earth ours | Earth map |
| --- | --- | --- | --- | --- |
| -89.5, 0 | 10.3% | 3.6% | 42.4% | 26.8% |
| -89.5, 120 | 0.0% | 0.0% | 0.0% | 0.0% |
| -89.5, 240 | 8.8% | 9.4% | 44.9% | 46.0% |
| -89, 45 | 22.3% | 25.2% | 45.3% | 50.3% |
| -89, 200 | 16.2% | 17.6% | 0.0% | 0.0% |
| -88, 90 | 13.7% | 14.3% | 50.4% | 50.5% |
| -88, 300 | 32.4% | 33.0% | 48.2% | 48.2% |
| -87, 10 | 0.7% | 0.8% | 31.5% | 31.7% |
| -87, 170 | 22.5% | 24.4% | 0.0% | 0.0% |
| -86, 250 | 20.8% | 19.2% | 57.0% | 56.6% |

| Gate | Sun | Earth | Declared |
| --- | --- | --- | --- |
| B1 correlation with the map | **0.974** | **0.973** | at least 0.90 |
| B2 mean absolute difference | **1.6 points** | **2.2 points** | at most 5 points |

**Gate B is met.** Where the map says Earth is never visible (`-89.5, 120`, `-89, 200`, `-87, 170`) so do we, and where the Sun is never visible we agree to the percentage point.

## Result: the three GR-001 sites (gate A): NOT MET

| Gate | Result |
| --- | --- |
| A1 Sun: ours inside the map's 3 x 3 pixel range plus 2 points | met |
| A1 Earth: same | met |
| A2 Earth: same site order as the map | met |
| **A2 Sun: same site order as the map** | **NOT MET** |

The map orders the Sun at the three sites `E120 (0%) < E0 (3.6%) < E240 (9.4%)`. We get `E120 (0%) < E240 (8.8%) < E0 (10.3%)`: the order of E0 and E240 is swapped. The gate failed as declared.

## Why it failed: a diagnostic (after the fact, no gate changed)

At `rule-89.5S-E0` the map's own pixels around the site are very uneven (Sun 2.7% to 12.1% across the 3 x 3 pixels). [`evidence/GR-001-illumination-patch-E0.txt`](evidence/GR-001-illumination-patch-E0.txt) compares us with the map at the centre of each of those nine pixels:

- At **7 of the 9 pixels** we agree with the map: Sun within 1.4 points (for example 10.9% against 11.5%), Earth within about 4.5 points.
- At **two adjacent pixels** (the site's own pixel and the one above it, in the column just east of the 0 degree meridian) the map is far lower (Sun 3.6% and 2.7%, Earth 26.8% and 21.4%) than at its other neighbours (about 10 to 12% and 42 to 47%), while our values stay near 11% and 42 to 45%.
- The map has **no systematic seam** along that column elsewhere (its mean along the column matches its neighbours), so this is not a general artefact of the projection axis.

So the swap comes from the map's value at one 60 m pixel that is an outlier against its own neighbours. **It is not established which is right.** A narrow feature may exist in the 60 m product's terrain (built in 2016) that our 2023 20 m DEM does not show, or the reverse. This was not resolved and is not claimed to be.

## What this does and does not show

- **Shows:** over ten independent sites our whole illumination and Earth-visibility chain reproduces a NASA product to a correlation of about 0.97 and a mean difference of 2 points or less. That is strong support for the terrain, skyline, geometry and time-integration code.
- **Does not show:** that every site agrees (one fails its declared ordering test), that the DEM is correct (the map is built from related LOLA topography, so this is not independent of the LOLA data), or anything about our one-week window.
- **Caveats:** the map states no observer height (we used ground level); epochs differ (the map's 2009-2013 data period against our hourly series from 2026, the same 18.6-year length); the map is 60 m per pixel against our 20 m DEM. A 2 m mast changes the three GR-001 values by under 1 point (Sun 11.1%, 0%, 9.0%).
- **Status:** per the declared rules the comparison is **not fully met**, so it does not close a validation scope. The decision to close one, with this evidence, belongs to the science owner ([sign-off sheet](../sdr/SDR-001-SIGNOFF.md)).
