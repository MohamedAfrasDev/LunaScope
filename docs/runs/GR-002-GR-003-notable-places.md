# GR-002 and GR-003: named south-polar places

**State: `real_data_unverified`, draft definitions.** Two saved comparisons that answer the challenge objective *compare sites, including a curated list of notable landing sites and custom coordinates*. They use the same week (2027-01-10, seven days), requirements (Sun at least 60%, Earth at least 50%) and settings as the frozen [GR-001](GR-001-run.md), so the results can be read next to it. They are **drafts**: not frozen, no convergence report, no Gate 2.

## What the sites are, and are not

The twelve places are named features of the IAU Gazetteer of Planetary Nomenclature. Their coordinates are the gazetteer's **official centre points** (USGS Astrogeology, "Public domain" per the file's metadata), copied with the source file's SHA-256 into [`data/sites/iau_extract.json`](../../data/sites/iau_extract.json) by `science/scripts/build_notable_catalog.py`. A test checks the catalog against that file and shows the check can fail.

- **A crater centre is its floor, not its rim.** Most of these floors are permanently shadowed, so a dark result there says nothing about the rim, which is where a lander would sit.
- **NASA's Artemis III regions are 15 km areas** on or near these features. We found no published coordinates for them, so GR-002 uses the *nearest named feature* of each region the October 2024 NASA list names (Haworth, Malapert Massif, Mons Mouton, Nobile, de Gerlache, Slater). "Peak near Cabeus B" has no matching feature, and the "Rim" and "Plateau" regions are not the feature centres.
- **None of this is a landing recommendation or a ranking.** Apollo, Chandrayaan-3 and the other well-known landings lie outside our 80°S terrain data, so they are not in the list.

## GR-002: Artemis III candidate-region features

| Place (IAU centre) | Ground (m, relative to the 1,737.4 km sphere) | Skyline (deg) | Sun, terrain | Sun, flat horizon | Earth, terrain | Earth, flat horizon |
| --- | --- | --- | --- | --- | --- | --- |
| Haworth (-87.45, 354.83) | -3316 | 3.6 to 10.5 | **Fail** 0.0% | 39.7% | **Fail** 0.0% | 100% |
| Mons Malapert (-85.98, 358.33) | +4917 | -3.6 to 10.3 | **Excluded** 26.5 to 27.0% | 36.2% | **Pass** 100% | 100% |
| Mons Mouton (-84.60, 31.00) | +5041 | 0.5 to 9.2 | **Excluded** 14.6 to 14.7% | 72.0% | **Pass** 100% | 100% |
| Nobile (-85.28, 53.27) | +903 | -2.1 to 8.1 | **Pass** 100% | 100% | **Fail** 30.3 to 30.6% | 100% |
| de Gerlache (-88.48, 271.66) | -1192 | 3.6 to 17.7 | **Fail** 0.0% | 6.7% | **Fail** 0.0% | 88.8% |
| Slater (-88.08, 111.29) | -1744 | 3.6 to 8.8 | **Fail** 0.0% | 100% | **Fail** 13.1 to 13.5% | 78.6% |

## GR-003: well-known south-polar craters

| Place (IAU centre) | Ground (m) | Skyline (deg) | Sun, terrain | Sun, flat horizon | Earth, terrain | Earth, flat horizon |
| --- | --- | --- | --- | --- | --- | --- |
| Shackleton (-89.67, 129.78) | -2789 | 19.8 to 23.6 | **Fail** 0.0% | 100% | **Fail** 0.0% | 84.9% |
| Shoemaker (-88.14, 45.91) | -3938 | 5.8 to 8.4 | **Fail** 0.0% | 100% | **Fail** 23.7 to 24.1% | 99.6% |
| Faustini (-87.18, 84.31) | -2748 | 5.2 to 10.2 | **Fail** 0.0% | 100% | **Fail** 0.0% | 87.9% |
| Cabeus (-85.33, 317.87) | -3737 | 1.3 to 22.1 | **Fail** 0.0% | 0.0% | **Fail** 0.0% | 100% |
| Amundsen (-84.44, 83.07) | -3571 | 2.3 to 11.4 | **Excluded** 33.3 to 88.2% | 100% | **Fail** 0.0% | 90.0% |
| Sverdrup (-88.32, 206.61) | -2887 | 2.6 to 14.4 | **Fail** 0.0% | 73.6% | **Fail** 0.0% | 72.8% |

## Reading these results

- **Terrain overturns the flat-horizon answer again.** At Shackleton, Faustini, Shoemaker and Slater a flat horizon says the Sun is up 100% of the week and the real terrain says 0%.
- **The lit places are the massifs.** Mons Malapert and Mons Mouton get the Sun for part of the week and Earth for all of it, and Nobile's centre gets the Sun all week. That is qualitatively what NASA's LOLA team says of the Malapert region (high illumination and excellent Earth visibility; see the [PGDA Lunar Polar Illumination page](https://pgda.gsfc.nasa.gov/products/69)). It is not a quantitative comparison: the published maps are long-term averages and this is one week.
- **Honest limits in the table.** `Excluded` means the event search could not certify an interval, so the Sun figure is a range with no pass or fail. Amundsen has only 3,099 of 3,600 skyline sectors certified (part of its 150 km footprint lies outside the terrain tile), so its Sun range is wide and its outcome excluded. Three places (Mons Malapert, Mons Mouton, Slater) carry `SENSITIVITY_HIGH` for the other DEM release: at Mons Malapert the other release changes the Sun's lower bound by 8.8 percentage points.
- **Nothing here is validated.** The DEM is unapproved, SDR-001 is unsigned, and these drafts have had no convergence report.
