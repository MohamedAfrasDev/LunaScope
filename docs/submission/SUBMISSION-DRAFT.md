# Submission draft (DRAFT: for the team to edit)

Nothing here has been submitted or published. It follows the spec's rule: **do not script any number until the reference run is locked.** The summary below describes what the tool does and contains no result.

## Project summary (limit 50 to 200 words)

LunaScope is a terrain-aware screening tool for the Moon's south pole. Near the pole the Sun and Earth sit only a few degrees above the horizon, so a ridge or crater wall can hide a target that a flat-horizon estimate counts as visible. Users set up a mission, choose sites and dates, and see the local sky against the terrain skyline, the outages, and a countdown to the next predicted sunset or Earthset. JPL Horizons supplies the Sun and Earth directions, an independent SPICE calculation checks them, and a pinned LOLA elevation model from NASA's Planetary Data System builds the horizon. A Time Machine shows what a delayed start changes, and a dates search shows which start dates pass. Every result carries its request, data checksums, settings and limits, and unknown is never counted as an outage. LunaScope is a screening and education tool: it does not certify landing safety, power, link performance or mission feasibility.

_Word count: 156. Re-read it against `CLAIMS-AUDIT.md` before use._

## Five-minute pitch outline, mapped to the product

| Time | Beat | Page | Ready? |
| --- | --- | --- | --- |
| 0:00 to 0:35 | The problem: a few degrees of sky and the ground decide | `/why-the-south-pole-is-hard` (schematic) | Yes |
| 0:35 to 1:05 | The reference mission | Home: "Start the reference mission" (GR-001) | Runs, but GR-001's sites are placeholders |
| 1:05 to 2:05 | Baseline: matrix, animated sky, countdown, flat versus terrain | `/runs/{id}`, `/sky/{site}`, `/timeline/{site}` | Yes on synthetic and on RUN-001; **numbers wait for the locked run** |
| 2:05 to 3:05 | Time Machine: shift five days, see the deltas | `/runs/{id}/time-machine` | Yes on synthetic; **not yet run on real data** |
| 3:05 to 3:45 | Evidence: Horizons request, SPICE residual, pinned DEM, three cards | `/runs/{id}/evidence` | Yes; the terrain-horizon card honestly reads "not evaluated" |
| 3:45 to 4:25 | Alternatives: the tested-dates strip and the trade-off | Time Machine, "Which dates pass?" | Yes on synthetic |
| 4:25 to 5:00 | Impact, limits, close | `CLAIMS-AUDIT.md`, the footer wording | Yes |

If the real data shows no dramatic change, show the real stability or trade-off. Do not force a reversal.

## Before this can be used

1. Choose the three GR-001 sites (D-09) and run GR-001 live; freeze it.
2. Settle D-11 (Horizons contact) and D-12 (organizer permission).
3. Fill in the demo link, team roles and the slide or video content: **not written here**, because they depend on decisions and people outside the repository.
4. Re-run `CLAIMS-AUDIT.md` against the final text.

## Likely questions

Answers are in the spec's "Likely questions" table. Two to add from this build: *"Is this a real result?"* (it is labelled `real_data_unverified` until a scope closes) and *"What if the network fails?"* (the offline fallback opens the packaged run in Replay mode; see `docs/deploy.md`).
