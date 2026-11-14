# GR-001 dates search on real data

**State: `real_data_unverified`.** The alternatives (dates) search had only ever been run on synthetic data. This is the first run on the live stack: real JPL Horizons positions (cached verbatim), the pinned LOLA 20 m terrain and the SPICE cross-check. It is a *variant* of the frozen GR-001 reference, not part of it, and its dates carry no convergence report, so the Gate 2 checks do not apply to them.

Produced by `science/scripts/real_search.py` (it drives the ordinary search endpoint; nothing is special-cased). The raw strip is [`evidence/GR-001-dates-search.json`](evidence/GR-001-dates-search.json).

**Tested:** the baseline start 2027-01-10 and each of the seven following days (to 2027-01-17), same three rule-chosen sites, same requirements (Sun at least 60%, Earth at least 50%, scenario values), same terrain and settings. Only the start moved.

| Start (UTC) | Site E0 | Site E120 | Site E240 | Verdict |
| --- | --- | --- | --- | --- |
| 2027-01-10 (baseline) | fail (Sun) | fail (Sun and Earth) | fail (Sun) | fail |
| 2027-01-11 to 2027-01-16 | fail (Sun) | fail (Sun and Earth) | fail (Sun) | fail |
| 2027-01-17 | **indeterminate** (Sun) | fail (Sun and Earth) | fail (Sun) | unknown |

## What it shows

- **No tested date passes at any site.** The Sun requirement fails everywhere in the first week. That is a real result of this terrain and these dates, and the search says so instead of picking a "best" date.
- **Earth is not the problem at two sites.** From about 2027-01-12 Earth meets its requirement with its full margin at `rule-89.5S-E0` and from 2027-01-13 at `rule-89.5S-E240`. `rule-89.5S-E120` never gets Earth (it is walled in; see the GR-001 record).
- **The Sun at `rule-89.5S-E240` is slowly improving.** Its margin below the 60% requirement narrows from 0.60 (no Sun) on the baseline to 0.088 from 2027-01-15 (about 51% availability): the closest any date gets, still a fail.
- **2027-01-17 at `rule-89.5S-E0` is not a pass or a fail.** The Sun begins to appear (availability about 3.7% to 3.9%, still far below 60%), but one 4.7 second interval cannot be certified because it is narrower than the 5 second minimum interval width (SDR-001 D-06). By the service's rule that makes the outcome `EXCLUDED` (`UNCERTIFIED_EVENT_SEARCH`), shown as *unknown* in the strip. It is the same kind of limit as the one documented in [GR-001-plus5d.md](GR-001-plus5d.md), and changing that policy is a science-owner decision that has not been made.

## What this does and does not show

- It shows the search working end to end on real data: eight dates, each an ordinary immutable run, none counted as a pass or fail until it finished.
- It is `real_data_unverified`: the DEM is not scientifically approved and SDR-001 is unsigned.
- The three points are a reference scenario, **not candidate landing sites**. A week of dates at three rule-chosen points says nothing about where a lander should go, and a search window of eight days cannot show the Sun's month-long cycle.
- The search ranks nothing. Its stated objective is the smaller of the Sun and Earth margins, used only to name a passing date, and no date passed.
