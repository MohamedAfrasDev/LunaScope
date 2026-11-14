# LunaScope: how it works and how to use it

A complete guide to every page, control, label and setting. It describes the product as it is built, not as it was planned, and it says plainly where something is limited.

**New to the project?** Read [Explained from scratch](EXPLAINED-FROM-SCRATCH.md) first: it covers what was built, the science behind it and why it matters. This guide is the page-by-page manual.

**What LunaScope is.** A screening and education tool for the Moon's south pole. For a site and a set of dates it answers two questions separately: *is the Sun above the terrain, and is Earth above the terrain?* It does not certify landing safety, electrical power, link performance or mission feasibility, and it is not endorsed by NASA.

> **Status you should know before reading further.** Everything the tool shows is labelled either `synthetic_demonstration` (invented test data) or `real_data_unverified` (real NASA data, but no validation gate has closed). Nothing is "validated". The three built-in sites are rule-chosen points, **not candidate landing sites**. See [What it does not do](#13-what-it-does-not-do-and-what-is-not-yet-done).

---

## Contents

1. [The idea in two minutes](#1-the-idea-in-two-minutes)
2. [Starting it](#2-starting-it)
3. [The labels that appear everywhere](#3-the-labels-that-appear-everywhere)
4. [A tour, page by page](#4-a-tour-page-by-page)
5. [Reading a result](#5-reading-a-result)
6. [How the numbers are made](#6-how-the-numbers-are-made)
7. [Keyboard, accessibility and the small things](#7-keyboard-accessibility-and-the-small-things)
8. [The reference runs: RUN-001, GR-001 and the freeze](#8-the-reference-runs-run-001-gr-001-and-the-freeze)
9. [Offline replay and the fallback package](#9-offline-replay-and-the-fallback-package)
10. [The service API](#10-the-service-api)
11. [Command line, scripts and settings](#11-command-line-scripts-and-settings)
12. [When something goes wrong](#12-when-something-goes-wrong)
13. [What it does not do, and what is not yet done](#13-what-it-does-not-do-and-what-is-not-yet-done)
14. [Glossary](#14-glossary)

---

## 1. The idea in two minutes

Near the lunar south pole the Sun and Earth stay within a few degrees of the horizon. The Moon's spin axis is tilted only about 1.5 degrees, so from a polar site the Sun circles the horizon instead of climbing and setting. Earth, which seems to hang in one patch of sky, drifts by a few degrees because the Moon librates. With targets that low, **the ground around you decides everything**: a ridge a few kilometres away can hide a Sun that is "above the horizon" on paper.

A simple estimate treats the horizon as flat. LunaScope computes the real **skyline** from a lunar elevation model and compares each target's position with it, over a time window you choose. For every site and each target (Sun, Earth) it reports:

- **when** the target is visible, hidden, or not certain (a timeline);
- **how much of the time** it is visible (an availability *range*, not a single number);
- whether that meets a **requirement** you set (for example "Sun at least 60% of the time");
- the **flat-horizon** answer beside it, so the effect of terrain is visible.

Sunlight and Earth visibility are judged **separately**. There is no combined score and no ranking of sites.

**Three rules the tool does not break**
1. **No placeholder is shown as science.** Synthetic or unverified values always carry a label.
2. **Unknown is not "not visible".** Time that cannot be certified is kept as unknown. It is never counted as an outage.
3. **No hidden score.** The trade-offs are shown, not summed.

---

## 2. Starting it

LunaScope is two programs: a **science service** (Python) that does all the computing, and a **web app** (Next.js) that only displays results. The web app never computes visibility. It asks the service, through its own server (a "backend for frontend", the BFF), which adds a secret token and forwards only a fixed list of allowed requests. The browser never sees the service address or the token.

### Fastest start (no data files, no network): the synthetic stack

The synthetic stack uses invented geometry and a synthetic ridge. It is instant and offline, and everything it produces is labelled **Synthetic demonstration**. It is for trying the interface and for tests.

```bash
# terminal 1: the service
cd science
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"        # Windows; use .venv/bin/python elsewhere
LUNASCOPE_STACK=synthetic .venv/Scripts/python -m uvicorn lunascope.main:create_app --factory --port 8000

# terminal 2: the web app
npm install
npm run dev -- --port 3000
```

In the Claude desktop app, `.claude/launch.json` has one-click entries: `science-synthetic`, `science-live` (needs the data files; uses `LUNASCOPE_CONTACT` from that file) and `science-replay` (serves a throwaway copy of `fallback/`), each paired with `web`. Only one science entry can run at a time (port 8000).

Open <http://localhost:3000>. (In PowerShell set the variable with `$env:LUNASCOPE_STACK="synthetic"` first.)

### Real data: the live stack

The live stack uses JPL Horizons for the Sun and Earth directions, the LOLA 20 m elevation data for the terrain, and NAIF SPICE as an independent check. It needs:

- the two DEM files and the SPICE kernels under `data/raw/` (sizes and SHA-256 pins are in `data/manifests/` and `docs/resources.md`; `science/scripts/verify_resources.py` checks them);
- network access on the first run for any Horizons request that is not already cached;
- a **contact** for JPL's fair-use policy, set as `LUNASCOPE_CONTACT` (an email address or a URL). The service refuses to send any Horizons request without it.

```bash
LUNASCOPE_STACK=live LUNASCOPE_CONTACT="https://github.com/your-project" \
  .venv/Scripts/python -m uvicorn lunascope.main:create_app --factory --port 8000
```

Horizons responses are cached verbatim on disk, so repeating a request costs nothing and a cached run needs no network.

### Containers

`docker compose -f deploy/compose.yml up --build` runs both programs (web on port 3000). `LUNASCOPE_API_TOKEN` must be set. See [`docs/deploy.md`](deploy.md) for what has and has not been verified.

### Where to look first

On the **Home** page press **Start the reference mission**. That submits the frozen reference scenario and takes you to its results. If it has already been computed, the page opens at once.

---

## 3. The labels that appear everywhere

### The data-status banner (top of every page)

A coloured strip that tells you what the numbers are. It rechecks the service every 30 seconds.

| You see | It means |
| --- | --- |
| **Synthetic demonstration data: values are invented test fixtures, not lunar results.** | The service is on the synthetic stack. Do not read the values as science. |
| **Real data, unverified: no validation gate has closed. Screening and education only, not flight-qualified.** | Real NASA data, but nothing is validated. |
| **Science service not reachable. No results can be computed or shown right now.** | The web app cannot reach the service. Nothing is shown rather than something stale. |
| A **REPLAY MODE** badge, plus "This is an offline copy: it shows saved runs only and cannot compute new ones." | The service is serving a saved package and will refuse anything not in it. See [section 9](#9-offline-replay-and-the-fallback-package). |

### The result-state frame (around every set of numbers)

Every table, chart and number block is inside a labelled frame that repeats the same truth next to the figures:

- **Synthetic demonstration**: invented values; not lunar results.
- **Real data, unverified**: computed from real data, but no validation gate has closed; a screening result.
- **Validated**: validated within the named scopes only. *No result is currently in this state.*

### Outcome words (a status is always an icon *and* a word, never colour alone)

| Word | Meaning |
| --- | --- |
| ✓ **Pass** | Even the *lower* availability bound meets the requirement. |
| ✗ **Fail** | Even the *upper* availability bound is below the requirement. |
| ? **Indeterminate** | The bounds straddle the requirement. Neither pass nor fail can be claimed. |
| ∅ **Excluded** | Missing data or an uncertified region. The case is left out; it is **not** a failure. |

### Site status (one per site)

`Pass` (both requirements pass), `Fail: Sun`, `Fail: Earth`, `Fail: both`, `Indeterminate`, or `Excluded` (not enough data to decide).

### Visibility states (the five classes used on every timeline and sky plot)

| Letter | Name | Meaning |
| --- | --- | --- |
| **V** | Visible | Certified above the skyline. |
| **H** | Hidden | Certified below the terrain skyline (or below the horizon). |
| **U** | Unresolved | Inside the narrow numerical decision band around a crossing. Bounded, and it widens the availability range rather than counting as an outage. |
| **X** | Uncertified | The event search could not decide the interval. Triggers an exclusion. |
| **G** | No data | A gap: missing geometry or terrain coverage. |

Each state has its own **pattern** on the timeline (solid, hatched, dotted, crossed, dashed) and its own **line style** on the sky plot, so you can tell them apart without colour.

---

## 4. A tour, page by page

Pages are reached through the header (**LunaScope** home, **New analysis**, **Why the south pole is hard**, the **Guided / Technical** switch) and through links on each result page.

### 4.1 Header, footer and global controls

- **Skip to content** link: the first thing a keyboard user tabs to.
- **Guided / Technical** switch (top right): chooses how explanations are worded. It is remembered in your browser. At present it changes the explanation text on the **Timeline** page (see 4.6); other pages read the same in both modes. See [section 7](#7-keyboard-accessibility-and-the-small-things).
- **Footer**: "Not flight-qualified. Does not certify landing safety, electrical power, link performance or mission feasibility. Not endorsed by NASA." with the data credits (JPL Horizons, LRO LOLA, NAIF SPICE).

### 4.2 Home (`/`)

- A one-paragraph statement of the question and why a flat horizon can mislead.
- **Start the reference mission**: submits **GR-001**, the frozen reference scenario, exactly as the service stores it, then opens its run page. The sentence beneath it states the scenario read from the service (days, start date, requirements, number of sites, whether sensitivity checks are on) and says **GR-001 is frozen: its inputs and settings cannot change, and any change would be a new reference version. Its three sites are rule-chosen points, not candidate landing sites.**
- Links: **Or set up your own analysis** and **Why the south pole is hard**.
- A side panel with the three rules (above) and **What it is not**: not a landing-safety, power, link-budget or feasibility assessment; sunlight percentage is geometric illumination; Earth visibility is a line of sight, not a communications guarantee.

### 4.3 New analysis (`/analyze`)

Builds a request in four groups. Every field is checked **before** anything is sent, with a message under the field; the service checks again and its errors are shown too. If anything is invalid, a banner says "Fix N field(s) before submitting. Nothing has been sent."

**Mission window (UTC)**

| Field | Allowed | Notes |
| --- | --- | --- |
| Start date | `YYYY-MM-DD`, 2020 to 2099 | UTC. |
| **Start from now** (button) | sets the start to the current UTC hour | Rounded down to the hour so everyone pressing it in the same hour shares one run. With the duration this is "now to +N days". It fills the form only; a window not already saved asks JPL Horizons for fresh positions (live mode, can take minutes). In replay mode it is refused with `REPLAY_ONLY`. |
| Start time | `HH:MM` | UTC. The service needs a whole minute. |
| Duration (days) | 1 hour (0.042) to 30 days | Must be a whole number of steps. |
| Base step (minutes) | 5, 10, 15, 30 or 60 | "Provisional until convergence is shown." Ten minutes is the reference. |

**Requirements (scenario values, not mission rules)**

| Field | Allowed | Meaning |
| --- | --- | --- |
| Minimum sunlight availability (%) | 0 to 100 | Sun *centre* above the terrain skyline. |
| Minimum Earth visibility (%) | 0 to 100 | A direct line of sight, not a link budget. |

A note under them: "Sunlight and Earth are judged separately. There is no combined score."

**Terrain** ("Terrain is always on. The flat-horizon result is shown beside it for comparison.")

| Field | Allowed | Notes |
| --- | --- | --- |
| Elevation data | LOLA 20 m, adjusted (PGDA 2023) or LOLA 20 m, PDS release (2017) | Two pinned releases of the LOLA 20 m south-polar elevation data. The first is the default. |
| Horizon radius (km) | 1 to 300 | How far out the skyline is searched. Default 150. |
| Azimuth step (°) | 0.05, 0.1, 0.2, 0.25, 0.5 or 1 | "Finer is slower; 0.5° was too coarse in tests." Default 0.1. |
| Observer height (m) | 0 to 50 | Above the local ground. Default 2. |

**Sites** (up to six in total)

- **Preset sites** are checkboxes. Each shows its **source**, **precision** (in metres) and whether the 150 km terrain footprint is **fully covered** or **partly outside the data**. The built-in presets are three demonstration points at latitude −89.5° and 0°, 120° and 240° east. The note above them says they are **not candidate landing sites**.
- **Add a custom point** opens a block of fields: **Latitude** (−90 to −80, because the terrain data covers 80°S to the pole), **Longitude** (−360 to 360), **Longitude direction** (east positive or west positive), **Source note** (a short citation, up to 200 characters, not a link or path), and **Precision (m)** (0 to 10,000). **Remove** deletes the point.
- **Check terrain coverage for point N** asks the service about that one point. It shows the **analysis point** after conversion (planetocentric, east-positive), says your **source point is kept separately**, and reports how much of the footprint is inside the data and how many azimuth sectors would be unknown. If you edit the point afterwards, the shown result disappears rather than describing different inputs.

**Options**
- **Also run a sensitivity check** (half the azimuth step, and the other DEM release). Slower, and it fills the Sensitivity panel and two of the validation checks.

**Below the form**
- **Run analysis**: validates, sends, and takes you to the run page.
- **Reset to the reference mission**: restores the default inputs.
- **Copy a link to these inputs**: see [Share link](#share-link).
- A live line: "N samples (sites × 2 targets), limit 60,000". Samples are sites × 2 targets × (duration ÷ step + 1).

**Small behaviours**
- Your edits are kept in this browser tab (session storage) if you navigate away and back, and cleared when you submit or reset. If storage is blocked the form still works.
- If you submit inputs that already have a result, you are taken to the existing run. Nothing is recomputed.

#### Share link

**Copy a link to these inputs** puts a URL on your clipboard (or shows it in a box to copy). It carries **only the form's inputs**, never a run, a token or a result. Opening it fills the form and says **"These inputs came from a shared link. Nothing has been run: check them, then press Run analysis."** A link that cannot be read (wrong format, too large, tampered with) is ignored with a notice and the default inputs are shown. Site ids that are not in the catalog are dropped.

### 4.4 Run page (`/runs/{run id}`)

The run id is a 64-character fingerprint of the request, the data pins and the algorithm, so **the same inputs always lead to the same page**.

- While running: a **Queued / Running: <stage>** card with a progress bar. A seven-day, three-site run with sensitivity takes minutes on a laptop; the page polls and you can leave and come back to the address.
- If it **failed**: a red box with the code and message, "No result was produced, so nothing is shown as passed or failed", and a link to adjust and try again.
- When complete:
  - A link, **What if the date slips? Open the Time Machine**.
  - The **status matrix** (4.5).
  - **Warnings carried with these results**: each code with a plain-words explanation (see [section 5](#5-reading-a-result)).
  - An **Evidence** summary: the three validation cards as icon-and-word chips, with a link to the Evidence page.

### 4.5 The status matrix

One row per site, with **Overall** and four result columns, so each requirement is judged on its own:

| Column | Meaning |
| --- | --- |
| Sun, **terrain-aware (decides)** | The result that counts. |
| Sun, **flat horizon (comparison)** | What a level horizon would say. Shown with a dashed rule on its left; it is not faded. |
| Earth, terrain-aware (decides) | As above for Earth. |
| Earth, flat horizon (comparison) | As above. |

Each cell shows the outcome chip, the availability **range** (for example "74.5–74.7%"), and "needs at least N%". The range is the lower bound (certified visible time) to the upper bound (adding time still inside the decision band).

Each row links to **Timeline and evidence** (the Timeline page) and **Local sky**. With two or more sites there is **Compare these sites side by side**. A site the service could not decide appears in a separate **Excluded** group, "not counted as failures", with a link to see why.

### 4.6 Timeline (`/runs/{id}/timeline/{site}`)

For one site. Header: the site, its status chip, and a link to the **Local sky**.

**One summary card per target (Sun, Earth)**
- The outcome chip.
- **In plain words** (Guided) or **Facts from the service** (Technical): a short list of fixed sentences explaining the result, for example that the target stays below the ridges for the whole window, or that terrain changes the outcome from pass to fail. Guided wording is plain; Technical shows the service's own wording. Unknown time is never described as hidden.
- **Availability, terrain** (a range, with the requirement), **Availability, flat horizon**.
- **Longest known hidden**, **Total known hidden** (plus any unresolved or unknown time).
- **Best clearance over the skyline**: the highest the target gets above the skyline at the sample points of the base step (negative means below it at every sample).
- **At the start**: the countdown at the beginning of the window.
- An **availability bar**: the range from lower to upper bound, with the requirement drawn as a line.
- A note if the case was **excluded**, and why.

**The timeline chart**: aligned bands for Sun and Earth, each in terrain-aware and flat-horizon form, one pattern per state, black ticks for predicted rises and sets, and a red bracket above a terrain-aware band marking its **longest known outage**. Times are UTC, with a day scale underneath. Under it, an expandable **view as table** section for each band lists every interval as a table, and **Download intervals (CSV)** saves them all.

**Predicted events**: each rise or set with its UTC time, the solver bracket (how tightly the crossing was located, in seconds) and the geometry timing bound (or "no timing bound claimed" when the crossing is nearly tangent).

**Sensitivity panel**: for each variant (half the azimuth step; the other DEM release) a table of what changed: availability, outcome, event count, largest event shift. A variant that moved beyond tolerance is flagged **in words**. If no sensitivity check was run, it says so and where to start one.

Warnings for the site are listed at the bottom.

### 4.7 Local sky (`/runs/{id}/sky/{site}`)

The target tracks over the terrain skyline, with a cursor you can move through the window.

**View**: **Polar (north up)** shows the sky from above, north at the top; **Unrolled (azimuth across)** lays azimuth along the horizontal axis. Hatched ground is the terrain skyline from the elevation data; the dashed circle or line is the flat 0° horizon; elevation rings are 5° apart. The Sun is orange and Earth blue, and each has a different marker shape so colour is not the only cue. A line segment is drawn in the style of its state (visible, hidden, unresolved, uncertified, no data). The picture only draws what the service decided: **whether a target is visible is never worked out in the browser.**

**At the cursor** (side panel): the UTC time and "Day X of Y". For each target: **Azimuth**, **Elevation**, **Skyline there** (or "unknown (no terrain data)"), **State**, and a **countdown**.

**The countdown** is asked from the service at the cursor time. It says what happens next ("Predicted set under this terrain model: in 3 h 12 min") with the model bracket in seconds, or one of:

- **Inside the numerical decision band** of a crossing (with how far the event is);
- **No change before the end of the computed window**;
- **Unknown**: uncertified or missing data before the next event, so no count is given;
- **At the mission end** (a censored boundary, never a "sunset").

Under a predicted event it adds **how far that time moves across the terrain variants** (finer azimuth step, other DEM release), warns if a variant finds a different number of events, or says that no sensitivity check was run.

**The time player**
- **Play / Pause**, **Previous event**, **Next event**, and **Speed** (1 hour, 6 hours or 1 day per second).
- A **Time (UTC)** slider in one-minute steps with the start and end shown under it.
- If your system asks for **reduced motion**, playback is turned off and a line says so; the slider and event buttons still work.
- Playback only moves the cursor. It never computes anything.

**Keyboard** (when the player group itself has focus): **Space** play/pause, **.** next event, **,** previous event, **←** and **→** step ten minutes. These do nothing while you are typing in a field.

**Text alternative**: **View sky positions as a table (every 6 hours)** with azimuth, elevation and state in words, and **Download all positions (CSV)**.

### 4.8 Compare (`/runs/{id}/compare`)

Compares the sites **within one run**, all computed from identical inputs. Choose at least two with the checkboxes (fewer shows "Choose at least two sites"). The comparison is recomputed by the service for exactly the sites you picked.

- **Held constant and changed**: the full list of inputs that are identical for every site (duration, radius, step, requirements, algorithm, data pins), and the one thing that differs: the site (with its status and ground height).
- **What differs**: typed facts from fixed templates, for example "terrain changes the Sun result: Pass on a flat horizon but Fail with the terrain skyline", "the sites reach different outcomes", "the same availability but a different longest outage", "a wide gap between the lower and upper bounds". **LunaScope does not rank the sites.**
- **Per target** (Sun, Earth): the range of availability across the compared sites, a table (terrain-aware decides; flat horizon is the comparison), and a **paired timeline** with one row per site on one shared time axis, each with its own table.
- Warnings, and the limits that apply to every number.

### 4.9 Time Machine (`/runs/{id}/time-machine`)

Answers **"what changes if the date slips?"** It takes a finished run (the *baseline*), moves the start date, and recomputes with **everything else identical**. The baseline stays frozen.

**Shift the start by (days)**: a whole number from −30 to 30, not zero (negative is earlier). Errors appear under the field and nothing is sent until it is valid. **Shift and recompute** creates the shifted run. If that run already exists you get it back instead of a new computation.

**Shifted runs of this baseline**: one button per run already made, labelled like "+5 d · starts 2027-01-15 00:00:00 UTC". Click one to compare it.

**Time alignment**: how the two runs are lined up.
- **Elapsed time**: each run keeps its own UTC; day 1 of the baseline is compared with day 1 of the shifted run.
- **Calendar time**: one shared UTC axis. Only the dates **both runs cover** are compared, and time outside a run's own window is never counted. If the two windows do not overlap, the service refuses ("the two windows do not overlap in calendar time").

**The comparison**
- **Shifted by +N d, compared in … time**, the alignment note, and (for calendar) the shared window.
- **Changed** (the one field, the start) and **Held constant** (a collapsible list).
- **Deltas from the baseline (terrain-aware)**: per site and target, the baseline and shifted outcome and availability, the change in percentage points, a flag if the **outcome changes**, the longest known hidden stretch before and after, event counts, and how many spans differ. No date is ranked.
- **Each run on its own clock**: two panels, **Baseline** and **Shifted**, each showing its own start time in UTC, the site status, its own countdown at the start (with the resolved UTC time) and its own timeline and interval table. This is deliberate: the two never share one clock unless you choose calendar alignment.
- **Changed spans**: for each target, the periods where the state differs, shown on both clocks.

#### Which dates pass? (on the same page)

Tests a **range of start dates** against the same sites, requirements and terrain.

- **From (days)**, **To (days)**, **Step (days)**. The range is checked before sending: whole numbers, at most 30 days either way, the first not after the last, **at most 15 dates**, and not only the baseline.
- **Test N dates** plans every date up front, then computes them **two at a time** (it pauses if the queue is full). The search holds no processor slot of its own, and the same search is never run twice.
- **The strip**: one chip per date with its offset ("+3 d", "baseline"), a verdict (**Passes** if at least one site passes both requirements, **Fails**, **Unknown**) and the date. A date still **Not run yet**, **Queued**, **Running**, or **Run failed** is shown as such and is **never counted as a pass or a fail**.
- The counts line ("N of M dates tested: …").
- **View the tested dates as a table**: every date and the result for every site with its margin (the smaller of the Sun margin and the Earth margin, as lower availability bound minus the requirement). A **Compare** button opens that date's shifted run in the comparison above.
- The **objective is stated on screen**, and it is used only to name, per site, the passing date with the largest margin. There is no score or ranking of sites.

### 4.10 Evidence (`/runs/{id}/evidence`)

"Can I trust and reproduce this?" Sections, top to bottom:

1. **Validation cards**: three cards, each a roll-up of narrower checks.
   - **Sun and Earth geometry**: provider against an independent SPICE calculation, and interpolation against a finer held-out series. Says nothing about the terrain.
   - **Terrain horizon**: skyline certification (coverage), sensitivity to the DEM release, and an independent skyline check. Does not check the DEM's accuracy.
   - **Numerical convergence**: whether results hold at a finer azimuth step.

   A card is **Met** only if *every* check in it ran and passed, **Not met** if any failed, and **Not evaluated** otherwise. An unrun check never counts as a pass. Open **The N checks behind this card** for each check, its facts and its scope. *The terrain-horizon card currently reads Not evaluated because no second, independent skyline implementation exists.*
2. **Identity and pinned resources**: the run id, the result id (sealed at completion), the algorithm, and the SHA-256 pins of the DEM and SPICE kernels.
3. **Method and inputs**: every input and setting (window, step, requirements, terrain, decision band ε, root tolerance τ, minimum interval, interpolation, algorithm names, data stack).
4. **Per site**: position and frame, ground and mast height, each provider with its signature, correction mode, time scale, retrieval time and response hash, the SPICE check and interpolation holdout, the skyline settings, sector counts, key and digest, and any warnings.
5. **Disc size: centre or edge?**: see [section 6](#6-how-the-numbers-are-made). A table per site showing the **Upper limb**, **Centre (used)** and **Whole disc** readings for each target, flagged in words if the outcome changes. If a result was made before this check existed it says **not computed** and shows no invented numbers.
6. **Limits that apply to every number here.**
7. **Export**: **Download investigative bundle (JSON)**. It holds the request, settings, resource pins, provider response hashes, angle series, skyline, classified intervals, events, metrics and caveats, plus a **frozen snapshot of the validation cards**. It is designated *investigative*. **A "verified" export is refused** (error `EXPORT_BLOCKED_UNVERIFIED`) until a validation scope closes. The file comes with an `X-Content-SHA256` header, and the same result always gives the same bytes.

### 4.11 Why the south pole is hard (`/why-the-south-pole-is-hard`)

A short explainer for learners, one click from Home and the header: the Sun barely clears the horizon, so the ground decides; Earth is near the horizon too; what follows (a flat horizon overestimates, dates matter, small errors matter, "not sure" is a real answer); and what LunaScope does about it. It has a **schematic** (labelled as not to scale and not computed from data) with a text description, a "What this page is not" note, and the data sources. Its rounded figures are textbook values and one worked example, not results.

---

## 5. Reading a result

### Availability is a range

"Availability" is the share of the window the target is visible. It is shown as **lower to upper**:

- **Lower** = certified visible time ÷ window.
- **Upper** = (certified visible + unresolved + uncertified + no-data time) ÷ window.

When everything is certified the two are almost equal ("74.5–74.7%"). A wide gap means a lot of time could not be settled, and a pass or fail near the threshold is not certain.

### How a requirement becomes an outcome

With threshold θ: **Pass** if lower ≥ θ; **Fail** if upper < θ; **Indeterminate** if the bounds straddle θ; **Excluded** if the case has missing or uncertified data. A site is `Pass` only when both targets pass; otherwise it names which fail.

### Terrain-aware versus flat horizon

The **terrain-aware** result decides. The **flat horizon** result is there to show what terrain changed. When they differ, the fact is stated ("terrain changes the Sun result").

### Warnings and what they mean

| Code | Meaning |
| --- | --- |
| `UNVERIFIED` | Real data computed, but no validation gate has closed. |
| `DEMONSTRATION_DATA` | Synthetic demonstration data. |
| `UTC_FUTURE_LEAP_SECOND_ASSUMPTION` | UTC after the last announced leap second assumes none is added. Expected for 2027 windows. |
| `EOP_PREDICTED` | Earth-orientation data is predicted, not measured, for part of the window. Expected for 2027 windows. |
| `DEM_COVERAGE_INCOMPLETE` | Part of the terrain footprint lacks data; those sectors are unknown, not flat. |
| `GEOMETRY_REFERENCE_MISMATCH` | The independent geometry check disagreed beyond tolerance. |
| `SENSITIVITY_HIGH` | The result changes beyond tolerance under a finer or alternative setting: an outcome changes, the number of events changes, or availability moves by more than one percentage point. |
| `INTERPOLATION_ERROR_ASSUMED` | Interpolation error was assumed, not measured. |

### Explanation sentences (Guided and Technical)

The sentences on the Timeline come from a **fixed set of templates**, keyed on the facts the service established (hidden for the whole window, closest approach below the skyline, visible throughout, availability range, unresolved time, longest hidden stretch, terrain changes the outcome, terrain reduces availability, excluded). Nothing is generated freely, no cause is stated beyond the arithmetic, and a fact the templates do not know falls back to the service's own wording.

### Run states

A run is **queued**, **running**, **complete**, **complete with warnings**, or **failed**. "Complete with warnings" is the normal state for real data (the expected warnings above), not an error.

---

## 6. How the numbers are made

The pipeline for each site, in order:

1. **Observer.** Your latitude and longitude are converted to one convention: planetocentric latitude, east-positive longitude, on the 1,737.4 km lunar reference sphere. Ground height and mast height are separate terms. If a convention or vertical reference is missing the observer is *unresolved* and nothing is computed.
2. **Sun and Earth directions.** JPL Horizons gives the apparent azimuth and elevation of each target centre at the site, on the base-step grid (10 minutes by default; airless, so no refraction; UTC). The raw response is stored verbatim with its hash. Between the grid points the direction is interpolated with a cubic Hermite spline on unit vectors, with a rigorous bound on the interpolation error, checked against a finer 1-minute held-out series.
3. **Independent geometry check.** The same directions are computed with NAIF SPICE (a different implementation) and compared. The tolerance is 0.01 arcsec; on the reference run the largest disagreement was 0.0017 arcsec. This validates the *directions only*, not the terrain.
4. **The skyline.** For each azimuth step the highest elevation angle to any terrain point out to the horizon radius is found by marching rays across the LOLA elevation model, including the curvature of the Moon. Sectors with missing data stay **unknown** unless a recorded bound covers them; they are never treated as flat. The skyline is stored under a key covering the observer, terrain identity, settings and algorithm, and reused when the same computation recurs.
5. **Clearance.** `clearance(t) = target elevation − skyline at its azimuth − margin`. Positive means visible.
6. **Certified event search.** Rises and sets are found where clearance crosses zero. The interval is subdivided and a bound on how fast clearance can change is used to prove an interval holds *one* sign before it is called visible or hidden. Roots are refined to 1 second. A narrow **decision band** (ε = 0.01°) around zero is kept as *unresolved*. If an interval cannot be certified within the evaluation cap it becomes *uncertified*, never "no event".
7. **Metrics and outcomes.** Durations (not sample counts) give visible, hidden and unknown time, availability bounds, the longest known hidden stretch, and the outcome against each requirement.
8. **Identity.** A **run id** is a hash of the canonical request, effective settings, resource pins and algorithm. A **result id** is sealed when the run completes. Same inputs, same ids.

### Disc size (centre or edge)

Every result uses the **centre** of each disc. Earth is about 1.9° across as seen from the Moon (the Sun about 0.5°), so near the skyline the centre can be hidden while part of the disc shows. Two bounding cases are recomputed with the same sky and terrain, moving the clearance margin by the disc's angular radius (Sun 0.27°, Earth 0.95°, nominal means): **upper limb** (visible when *any* part clears the skyline) and **whole disc** (visible only when *all* of it does). The centre result lies between them. Earth's radius varies from about 0.90° to 1.03° over the lunar orbit; that variation is stated and not modelled. This brackets a modelling assumption; it does not model partial illumination or partial signal.

### Sensitivity and convergence

- **Sensitivity** (the option on the form) re-runs the site with the azimuth step halved and with the other DEM release, and quantifies the differences.
- **Convergence** (used for the reference run) changes **one setting at a time** against the base: 1-minute step, azimuth 0.5° and 0.25°, radius 100 km and 200 km. A case is flagged `SENSITIVITY_HIGH` by the rule above. Near/far DEM merging is recorded as not applicable (no such merge exists).

### Limits that always apply

Screening and education only; centre-of-disc visibility (bracketed above); no refraction; a finite horizon radius; and no validation gate has closed.

---

## 7. Keyboard, accessibility and the small things

**Keyboard.** Every control is reachable with Tab and operable from the keyboard: forms, switches, radio groups (arrow keys), the date and shift controls, tables and downloads. The core flow (Home → run → Time Machine → Evidence → download) was tested with keyboard only. The **Skip to content** link and visible focus rings are provided. Sky-player shortcuts are in 4.7.

**Not colour alone.** Every status is an icon *and* a word. Timeline states have patterns; sky states have line styles; Sun and Earth have different marker shapes.

**Text alternatives.** Every chart has a text description (the SVG title and description) and a table version of its data: timeline intervals, sky positions every 6 hours, tested dates, deltas.

**Reduced motion.** If your system asks for reduced motion, the sky player's playback is disabled and says so; stepping still works.

**Guided and Technical.** The switch in the header is remembered in your browser (and still works if storage is blocked). *Guided* uses plain-language sentences from fixed templates; *Technical* shows the service's own wording. It is a convenience of this browser only.

**Downloads.** Timeline intervals (CSV), local-sky positions (CSV), and the investigative evidence bundle (JSON).

**Dates and times.** Everything is **UTC**. Durations are in plain units ("1 d 18 h 31 min"). Times near an event keep their seconds.

**Letting the page wait.** Pages that depend on a running computation poll and stop when it finishes. A late reply for something you have since changed (a different run, site, date or alignment) is ignored and never replaces what you are looking at.

**Errors are shown, not hidden.** A failure never produces an empty chart. Messages are specific ("The service is busy. Try again in a few seconds."; "This is an offline copy that only holds saved runs, so this request cannot be computed.").

---

## 8. The reference runs: RUN-001, GR-001 and the freeze

### RUN-001

The first real end-to-end run (13 Nov 2026): three rule-chosen sites at latitude −89.5° and 0°, 120° and 240° east, seven days from 2027-01-10 UTC, live Horizons + LOLA 20 m + SPICE, with sensitivity variants. Its record is [`docs/runs/RUN-001-first-real-run.md`](runs/RUN-001-first-real-run.md). Follow-ups: [disc size](runs/RUN-001-disk-edge.md) and [convergence](runs/RUN-001-convergence.md).

### GR-001, the golden reference run

The frozen version of the same scenario, used as the common reference for tests, screenshots, the demo and exported evidence.

- **Definition:** `data/reference/GR-001.json`, with a recorded reason for every field.
- **Sites:** the three rule points, **declared a reference scenario and not candidate landing sites** (SDR-001 D-09, decided by the project owner; science-owner sign-off is pending).
- **Frozen:** the definition pins the run id on the live stack. That id includes the DEM and SPICE kernel hashes and the algorithm version, so **any change to the request, settings, DEM or kernel identity, or algorithm makes `check_freeze` refuse to run**. The answer is then a new reference, GR-002, never an edit.
- **Gate 2:** five named checks over the saved bundles: **geometry** (SPICE and interpolation), **horizon** (digest, summary, every sector certified), **aggregation** (intervals tile the window, bounds follow from the intervals, results re-derive), **event search** (nothing uncertified, every root within tolerance) and **convergence** (all cases ran, none flagged). A check passes only if it ran and held. Passing says the run is sound and converged; **it is not a validation of the science**.
- **Record:** [`docs/runs/GR-001-run.md`](runs/GR-001-run.md), generated from the bundles in `docs/runs/GR-001/`. It was re-run from a clean commit with no Horizons contact set (so no request could be sent) and reproduced the earlier draft run exactly. Permanent tests guard the freeze.
- **Real five-day shift:** [`docs/runs/GR-001-plus5d.md`](runs/GR-001-plus5d.md). A variant of GR-001, with a sensitivity flag explained there, and no convergence report.
- **Independent skyline check:** [`docs/runs/GR-001-independent-skyline.md`](runs/GR-001-independent-skyline.md). Why the terrain-horizon card reads met for GR-001, and how the gates were reached.
- **Real dates search:** [`docs/runs/GR-001-dates-search.md`](runs/GR-001-dates-search.md). Eight dates of GR-001 on real data; no date passes.

---

## 9. Offline replay and the fallback package

**Replay mode** (`LUNASCOPE_MODE=replay`) makes the service serve **only runs already saved**, so the demo works with no network. It refuses everything else with `REPLAY_ONLY`. The web app shows a **REPLAY MODE** badge on every page and explains refusals in plain words.

**The fallback package** is a saved copy of GR-001 and its five-day shift, plus a manifest.

```bash
cd science
.venv/Scripts/python scripts/build_fallback.py build --stack live --out ../fallback --seed-from ../var   # build
.venv/Scripts/python scripts/build_fallback.py check ../fallback --stack live                            # rehearse offline
```

- **build** runs the real service code, so the package is the real result. `--seed-from` reuses recorded Horizons responses and verified skylines so only a genuinely new window reaches JPL. The manifest records the commit, algorithm version, artifact hashes and how many responses were reused versus newly fetched. Use `--stack synthetic` for a rehearsal package. `--search-days N` also runs and packages a dates search over 1..N days, so "Which dates pass?" works offline; `check` confirms the packaged search is served and an unpackaged one is refused.
- **check** opens the package in replay mode with every network connection and DNS lookup refused, and confirms each run is served and matches its recorded hash, the Home request and the five-day shift resolve to the packaged runs, an unpackaged request is refused, and zero network attempts happened.
- **To start it,** read `fallback/README.md` (written by the build). In short: the service in replay mode on that data folder, then the web app.
- **Browser check:** `LUNASCOPE_FALLBACK_STACK=live npm run test:e2e:fallback`.

The package is **gitignored and local to the machine that built it**. Rebuild it from a clean commit and copy it to the machine you will present from.

---

## 10. The service API

The web app is the only normal client, but the service is a plain HTTP API under `/api/v1`. The full reference is [`docs/API.md`](API.md); the machine-readable description is [`docs/openapi.json`](openapi.json) (TypeScript types are generated from it with `npm run gen:api`).

| Request | What it does |
| --- | --- |
| `GET /health` | Mode, stack, limits, queue counts, what start-up recovery did. Never needs the token. |
| `GET /resources` | The data manifests and their readiness (`integrity_verified` is not scientific approval). |
| `GET /sites`, `POST /sites/custom` | The demonstration catalog with terrain coverage; check a typed point. |
| `GET /references/{id}` | A reference definition (GR-001) and the exact request Home submits. |
| `POST /analyses` | Admit a run. `202` new, `200` already exists (you are attached to it), `503 QUEUE_FULL` with `Retry-After`. |
| `GET /analyses/{id}` | Status and progress; when done, the site matrix and warnings. |
| `GET /analyses/{id}/results` | Metrics and explanation facts; add `?include=intervals,events,series` for arrays. |
| `GET /analyses/{id}/provenance` | Resources, settings, observers, skyline identity, geometry hashes, caveats and the disc-size bracket. |
| `GET /analyses/{id}/horizon/{site}` | The skyline profile. |
| `GET /analyses/{id}/countdown?site=&target=&horizon=&t=` | The countdown at a cursor time, decided by the service. |
| `GET /analyses/{id}/validation` | The validation cards and their three-group roll-up. |
| `POST /analyses/{id}/variants` | `date_shift` (Time Machine) or `alternatives_search` (dates search). |
| `GET /analyses/{id}/variants`, `/searches`, `/searches/{id}` | Linked runs and the tested-dates strip. |
| `POST /comparisons` | Compare sites in a run, or two runs under an explicit alignment. No winner, rank or score anywhere. |
| `GET /analyses/{id}/export` | The investigative bundle. `?verified=true` is refused. |

**Identity.** Submitting the same request returns the same run. Admission is atomic: twelve simultaneous identical requests schedule exactly one job.

**Caching.** Reads of a finished result are tagged with its result id and cached for good; the validation cards and the export are revalidated. Run status is never cached.

**Errors** use one envelope: a stable `code`, a human `message`, the `field` that caused it, a `retryable` flag and a correlation id. Common codes are in [section 12](#12-when-something-goes-wrong).

---

## 11. Command line, scripts and settings

### npm scripts (from the repository root)

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Run, build or serve the web app. |
| `npm run verify` | The web gate: API types current, typecheck, lint, web tests. |
| `npm test`, `typecheck`, `lint` | The pieces of the above. |
| `npm run gen:api`, `check:api` | Regenerate / check the TypeScript types from `docs/openapi.json`. |
| `npm run test:e2e` | Playwright core flow and accessibility checks (service on :8000 and web on :3000, synthetic stack). |
| `npm run test:e2e:fallback` | The offline-fallback browser test. |
| `npm run smoke` / `node scripts/smoke.mjs <url>` | A 10-step smoke test of a running deployment. |

### Python (from `science/`)

`.venv/Scripts/python -m pytest` runs the service tests; `-m ruff check .` lints. Scripts in `science/scripts/`:

| Script | Purpose |
| --- | --- |
| `reference_run.py identity|run|check|gate` | Reference runs: the pinned id, run GR-001, readiness of saved bundles, Gate 2's five checks. |
| `reference_report.py` | Writes the run record from saved bundles. |
| `build_fallback.py build|check` | Build and rehearse the offline package. |
| `disk_edge_real.py`, `convergence_study.py` | The RUN-001 disc-size and convergence records. |
| `shift_report.py`, `shift_flag_diagnosis.py` | The real five-day shift record and its flag diagnosis. |
| `first_real_run.py`, `geometry_agreement.py`, `dem_check.py`, `dem_release_comparison.py`, `verify_resources.py`, `export_openapi.py`, `work_log.py`, `phase0/*` | The first real run, geometry and DEM studies, resource hash check, OpenAPI export, the pre-event work log, and the Phase 0 decision studies. |

### Environment variables

| Variable | Where | Meaning |
| --- | --- | --- |
| `LUNASCOPE_STACK` | service | `synthetic` (default) or `live`. |
| `LUNASCOPE_MODE` | service | `live` (default) or `replay`. |
| `LUNASCOPE_DATA_DIR` | service | Store, artifacts, skylines, Horizons cache. Needs persistent storage. Default `var/`. |
| `LUNASCOPE_CONTACT` | service | Email or URL for JPL's fair-use policy. Required for any new Horizons request. |
| `LUNASCOPE_API_TOKEN` | service | Shared secret; if set, every request except `/health` must carry it. |
| `LUNASCOPE_LOG` | service | `json` for one structured log line per event (no coordinates or tokens are logged). |
| `SCIENCE_API_URL` | web | Where the web server reaches the service (default `http://127.0.0.1:8000`). |
| `SCIENCE_API_TOKEN` | web | The same secret, added by the web server. Never sent to the browser. |
| `LUNASCOPE_PYTHON`, `LUNASCOPE_FALLBACK_STACK` | tests | Which Python the Playwright config starts, and which stack the fallback test uses. |

### Limits built in

Up to **6 sites**; at most **60,000 samples** (sites × 2 targets × steps); window 1 hour to 30 days; request body at most 64 KB. The service runs **2 jobs at once** with **8 queued**; each job is its own process, killed for real on timeout (240 s synthetic, 900 s live) and retried once if it crashes. Only one Horizons request is in flight at any time, with backoff.

### Data and files

`data/manifests/` (one pinned manifest per DEM, the SPICE kernels and Horizons), `data/sites/catalog.json` (the three demonstration points), `data/reference/GR-001.json` (the frozen reference), `data/raw/` (the large files, not in git). Documentation index: [`README.md`](../README.md).

---

## 12. When something goes wrong

| You see | What it means | What to do |
| --- | --- | --- |
| Banner: **Science service not reachable** | The web app cannot reach the service. | Start the service, check `SCIENCE_API_URL` and the token. |
| **The service is busy. Try again in a few seconds.** (`QUEUE_FULL`) | 8 jobs are already queued. | Wait; existing runs still open. |
| **The analysis did not complete** with `TIMEOUT` | A run exceeded its time limit. | Narrow the window or use a larger step. The failure is stored; the same inputs return it. |
| `CONFIGURATION_MISSING` mentioning `LUNASCOPE_CONTACT` | A Horizons request is needed and no contact is set. | Set the contact. A fully cached run needs none. |
| `INVALID_INPUT` with a field name | An input is out of range; the field is shown. | Fix that field. |
| **This is an offline copy that only holds saved runs** (`REPLAY_ONLY`) | You asked a replay-mode service for something not packaged. | Open the saved reference run, or switch to a live service. |
| `NOT_READY` (409) | Results were requested before the run finished. | Wait for the run page to show complete. |
| `EXPORT_BLOCKED_UNVERIFIED` | A "verified" export was requested. | Download the investigative bundle instead. |
| `INCOMPATIBLE_RUNS` | Two runs differ in more than the start date, or calendar windows do not overlap. | Compare variants of one baseline. |
| `RESOURCE_INTEGRITY_FAILED` | A data file is missing or fails its checksum. | Run `verify_resources.py`, restore the file. The tool blocks rather than substituting. |
| `UNAUTHORIZED` | The service token is missing or wrong. | Match `LUNASCOPE_API_TOKEN` and `SCIENCE_API_TOKEN`. |
| Warning `SENSITIVITY_HIGH` | The result is less settled under a finer or alternative setting. | Read the Sensitivity panel; quote the flag beside the number. |
| A card reads **Not evaluated** | The check has not been run, or no recorded comparison exists for that exact skyline. | It supports nothing; it is not a failure. |

---

## 13. What it does not do, and what is not yet done

**By design**
- It does not certify landing safety, electrical power, link performance or mission feasibility.
- Sunlight percentage is **geometric illumination**, not power. Earth visibility is a **line of sight**, not a communications guarantee.
- It judges the Sun and Earth separately. No combined score, no ranking of sites or dates.
- It never treats unknown as "not visible" and never fills missing terrain with a flat horizon.

**Not built or not finished (honest list)**
- **Nothing is validated.** The DEM is not scientifically approved and SDR-001 is unsigned. Every result is `real_data_unverified` or `synthetic_demonstration`.
- **Terrain-horizon card** reads *met* for GR-001 only: a second, independent skyline agrees (`docs/runs/GR-001-independent-skyline.md`). It checks the skyline computation, not the DEM. A skyline with no recorded comparison (a custom site, another radius) reads *not evaluated*.
- **The built-in sites are demonstration points**, not candidate landing sites. A real candidate-site selection would be a new reference.
- **The dates search** has been run once on real data (eight dates of GR-001; no date passes; see `docs/runs/GR-001-dates-search.md`), and the Time Machine once. Neither is validated.
- **No near/far DEM merge**, so that convergence case is not applicable.
- **Nothing is deployed.** There is no public web address yet; the offline package is local to one machine.
- **Disc size** brackets the centre assumption; it does not model partial illumination, partial signal, or Earth's changing size.
- A manual screen-reader pass has not been done (keyboard and automated accessibility checks have).
- Organizer permission for pre-event work (D-12) is **not on file**, and the submission materials (slides or video) are not written.

The authoritative status is [`docs/LunaScope-Phase-Plan.md`](LunaScope-Phase-Plan.md); what may and may not be claimed is in [`docs/submission/CLAIMS-AUDIT.md`](submission/CLAIMS-AUDIT.md).

---

## 14. Glossary

| Term | Meaning |
| --- | --- |
| **Azimuth** | Compass direction of a target, 0° north, 90° east, clockwise. |
| **Elevation** | Angle above the local horizontal. Negative is below it. |
| **Skyline / horizon profile** | For each azimuth, the highest terrain elevation angle out to the horizon radius. |
| **Flat horizon** | A level horizon at 0°. The simple estimate LunaScope compares against. |
| **Clearance** | Target elevation minus the skyline (minus any margin). Positive means visible. |
| **Availability** | Share of the window the target is visible, as a lower to upper range. |
| **Requirement** | The minimum availability you set for the Sun and for Earth. |
| **Outcome** | Pass, Fail, Indeterminate or Excluded for one target against its requirement. |
| **Decision band (ε)** | A narrow range around zero clearance (0.01°) kept as *unresolved* instead of guessed. |
| **Root tolerance (τ)** | How tightly a rise or set time is located (1 second). |
| **Certified** | Proven by a bound, not just sampled, to hold one state across an interval. |
| **Run id / result id** | Fingerprint of the inputs; fingerprint of the sealed result. Same inputs, same ids. |
| **Baseline / variant** | A finished run, and a linked run that differs in one field (the Time Machine start). |
| **Alignment** | How two runs are paired in time: *elapsed* or *calendar*. |
| **Reference run (GR-001)** | The frozen golden run used as the common reference. |
| **Freeze** | Pinning the reference's run id so any scientific change must become a new reference. |
| **Gate 2** | The five checks (geometry, horizon, aggregation, event search, convergence) a reference run must pass. |
| **Replay mode** | The service serves only saved runs, so the demo works offline. |
| **BFF** | The web app's server layer that forwards allowed requests and adds the token. |
| **JPL Horizons** | NASA/JPL's ephemeris service; supplies the Sun and Earth directions. |
| **NAIF SPICE** | NASA's ephemeris toolkit; used here as an independent check on the directions. |
| **LOLA / DEM** | Lunar Orbiter Laser Altimeter elevation data; the digital elevation model behind the skyline. |
| **Libration** | The slow wobble of the Moon that moves Earth by a few degrees in its sky. |
| **Planetocentric** | Latitude measured from the Moon's centre (the convention used throughout). |
| **Synthetic / unverified / validated** | Invented data; real data with no validation gate closed; validated within named scopes (none yet). |
