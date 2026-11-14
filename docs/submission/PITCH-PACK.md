# Pitch pack (DRAFT: for the team to edit and present)

Nothing here has been submitted. Every number comes from a committed record and is labelled **real data, unverified**; none is validated. Before using any line, check it against [CLAIMS-AUDIT.md](CLAIMS-AUDIT.md). Records: [GR-001-run.md](../runs/GR-001-run.md), [GR-001-plus5d.md](../runs/GR-001-plus5d.md), [GR-001-dates-search.md](../runs/GR-001-dates-search.md), [GR-001-independent-skyline.md](../runs/GR-001-independent-skyline.md).

## Project summary (with the result; limit 50 to 200 words)

LunaScope is a terrain-aware screening tool for the Moon's south pole. Near the pole the Sun and Earth sit only a few degrees above the horizon, so a ridge or crater wall can hide a target that a flat-horizon estimate counts as visible. On a reference week at three rule-chosen points, a flat horizon says the Sun is up 100% of the time; with real terrain it is up 0% at all three, while Earth is visible 74.5% and 65.0% of the week at two of them. Users choose sites and dates and see the local sky against the terrain skyline, the outages and a countdown to the next sunset. A Time Machine shows what a delayed start changes, and a dates search shows which start dates pass. Sun and Earth directions come from JPL Horizons and are checked against NASA's SPICE; terrain comes from NASA's LOLA elevation model. Every result is labelled unverified, and unknown data is never counted as an outage. It is a screening and education tool, not a landing-safety, power or link-budget result.

_Word count: about 175. The three points are a reference scenario, not candidate landing sites._

## Seven slides

| # | Slide | On the slide | Say |
| --- | --- | --- | --- |
| 1 | The problem | The Sun and Earth sit 0 to 7 degrees above the horizon at the pole; a 300 m ridge 5 km away stands about 3.3 degrees. | "A few degrees of sky and the ground around you decide everything." |
| 2 | Why a flat horizon fails | Table: flat horizon Sun 100% at all three sites; terrain 0%. | "The simple answer is wrong for the one thing the Sun can do here: nothing." |
| 3 | What LunaScope does | Sun and Earth against the terrain skyline, outages, countdown, requirement outcome. Screenshot of the Local sky page. | Show the hatched skyline and the tracks. |
| 4 | The Time Machine | +5 days: Earth 74.5% and 65.0% become 100%; the Sun at one site goes from 0% to 51.2%, still short of 60%. | "A five-day slip genuinely changes the answer." Say the run carries a sensitivity flag. |
| 5 | Which dates pass | Eight dates, none pass; the Sun's closest approach is 51% at one site. | "The search says so instead of inventing a best date." |
| 6 | Why trust it | NASA sources; SPICE agrees to 0.0017 arcsec; a second skyline written independently agrees at all three sites; reproduces with the network off. | "We checked it every way we could, and we say what is not validated." |
| 7 | Limits and impact | Screening only; unverified; three points are not landing sites; no power or link claims. | "A fast first filter for planners and learners." |

## 30-second video (subtitled)

1. (0-6 s) Moon's south pole, a low Sun. Caption: "At the lunar south pole the Sun never climbs."
2. (6-14 s) Flat-horizon column 100% beside terrain 0%. Caption: "A flat horizon says sunlit. The real terrain says dark."
3. (14-22 s) Local sky, press Play. Caption: "LunaScope shows when the Sun and Earth clear the ridgeline."
4. (22-30 s) Time Machine +5 days, then the Evidence page. Caption: "Real NASA data. Checked. Honest about what is not validated."

No voice or picture of anyone under 18. Do not generate or alter a NASA logo.

## Five-minute run sheet

Use the outline in [SUBMISSION-DRAFT.md](SUBMISSION-DRAFT.md). Demo on the offline package in Replay mode (see [deploy.md](../deploy.md)); the banner says so on screen, say it out loud too. Rehearse the Time Machine step and the dates strip, because those are the two pages that need a click.

## Questions you will be asked

- **Is this a real result?** It uses real NASA data and is labelled unverified; no validation gate has closed, and the terrain model is not formally approved.
- **How do you know the angles are right?** JPL Horizons, cross-checked against NASA's SPICE to 0.0017 arcseconds. That covers directions only.
- **How do you know the skyline is right?** A second, independently written skyline agrees at all three sites inside gates declared in advance. Both read the same elevation data, so this checks the computation, not the terrain model. Our first version of that check failed and we fixed the check, not the thresholds; the record shows it.
- **Is sunlit time the same as power?** No. It is geometric visibility; power needs panel and battery models.
- **Does Earth visible mean communications work?** No. It is a line of sight, not a link budget.
- **Why these three sites?** A fixed, symmetric rule chosen before looking at any result. They are a reference scenario, not candidates.
- **What if the data is missing?** It stays unknown or excluded; it is never silently counted as visible or hidden.
- **What if the network fails?** The packaged real run opens in Replay mode with no network.
