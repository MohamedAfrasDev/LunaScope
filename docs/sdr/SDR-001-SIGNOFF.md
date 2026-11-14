# SDR-001 sign-off sheet

**Status: UNSIGNED.** This sheet exists so that the science owner and the product owner can sign (or refuse) each decision in one sitting. Nothing here has been signed, and no tool or assistant can sign for them. Until it is signed, every result stays `real_data_unverified` and no page, slide or summary may say "validated" or "verified".

What signing means: *the signer has read the evidence and accepts this value for this project.* It is not a claim that the science is proven correct. What it unlocks: the science owner may then close individual validation scopes, one at a time, and only then may a result carry a closed scope.

## Decisions

| ID | Decision | Value in the code | Evidence | Science owner | Product owner |
| --- | --- | --- | --- | --- | --- |
| D-01 | DEM product | `LDEM_80S_20MPP_ADJ` primary, `LDEM_80S_20M` cross-check, SHA-256 pinned | SDR-001 D-01 analysis; DEM release comparison at ten sites (median RMS 0.076 deg, up to 2.6 deg at one site) | ☐ accept ☐ refuse | ☐ |
| D-02 | Body-fixed frame | `MOON_ME` (DE440 ME, 0.063 arcsec from the DE421 frame the DEMs cite) | SDR-001 D-02 | ☐ ☐ | ☐ |
| D-03 | Latitude, longitude, radius, datum | planetocentric, east-positive, 1,737.4 km sphere | SDR-001 D-03; DEM CRS and PDS label | ☐ ☐ | ☐ |
| D-04 | Horizons and SPICE settings | `QUANTITIES=4`, `APPARENT=AIRLESS`, UTC; `spkcpo` `LT+S` | SDR-001 D-04; GR-001 geometry check (0.0017 arcsec) | ☐ ☐ | ☐ |
| D-05 | Decision band | 0.01 deg, azimuth step 0.1 deg | SDR-001 D-05; GR-001 convergence report | ☐ ☐ | ☐ |
| D-06 | Root tolerance, minimum interval, evaluation cap | 1 s, 5 s, 200 | SDR-001 D-06. **Note:** the 5 s minimum interval leaves a 4.7 s sliver uncertified in `GR-001-plus5d` and the dates search (outcome `EXCLUDED`); relaxing it is the science owner's call, see [GR-001-plus5d.md](../runs/GR-001-plus5d.md) | ☐ ☐ | ☐ |
| D-07 | Requirement policy | PASS / FAIL / INDETERMINATE / EXCLUDED | `requirements.py`; GR-001 | ☐ ☐ | ☐ |
| D-08 | Reference window start | explicit input, no hidden default | SDR-001 D-08 | ☐ ☐ | ☐ |
| D-09 | Demo sites | three rule points (-89.5, E0/E120/E240) as a declared reference scenario, **not candidate sites** | Project owner's decision of 14 Nov 2026 | ☐ ☐ | ☐ |
| D-10 | Geometry tolerance | 0.01 arcsec | GR-001 (max 0.0017 arcsec on one date). The multi-date run in SDR-001 is not done | ☐ ☐ | ☐ |
| D-11 | Horizons contact | the project's GitHub URL (project owner's decision of 14 Nov 2026) | `LUNASCOPE_CONTACT` | ☐ ☐ | ☐ |
| D-12 | Organizer permission | **not on file** | `docs/permissions/` | n/a | ☐ acknowledge it is open |

`docs/sdr/SDR-001.md` still shows D-09 and D-11 as open in its summary table; the entries above reflect the decisions recorded since.

## What the evidence is, and is not

- **Is:** a reproducible real-data run (GR-001, frozen), geometry agreeing with NASA's independent SPICE, a second independently written skyline agreeing with the production one, convergence and DEM-release sensitivity studies, and tests that are shown to fail when the thing they guard is broken.
- **Is not:** an independent check of the DEM itself (both skyline methods read the same elevation data), a comparison with any ground-truth lunar measurement of illumination or Earth visibility, or any check of the 150 km radius choice at other sites. A real validation of those needs evidence from outside this repository, for example comparison with published illumination maps or an independent team's skyline from other data.

## Signatures

| Role | Name | Decision (accept all / list exceptions) | Date | Signature |
| --- | --- | --- | --- | --- |
| Science owner | | | | |
| Product owner | | | | |

After signing: record the date in `docs/sdr/SDR-001.md`, then close validation scopes one at a time through `validated_scopes` only when the matching evidence exists. Do not close a scope on a sign-off alone.
