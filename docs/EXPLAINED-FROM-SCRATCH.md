# LunaScope explained from scratch

**Read this first if you do not know what was built.** It assumes no background in astronomy, mapping or the code. It tells the story, explains the science behind every number, walks through every kind of situation the tool can meet with real results, shows how to present it, and lists the questions judges are likely to ask with honest answers. The companion [User Guide](USER-GUIDE.md) is the page-by-page manual; this document is the *why* and the *how it works*.

Every figure quoted here comes from the project's own records, not from general knowledge: [GR-001-run.md](runs/GR-001-run.md), [GR-001-plus5d.md](runs/GR-001-plus5d.md), [GR-001-dates-search.md](runs/GR-001-dates-search.md), [GR-001-independent-skyline.md](runs/GR-001-independent-skyline.md), [GR-001-illumination-vs-map.md](runs/GR-001-illumination-vs-map.md) and [GR-002-GR-003-notable-places.md](runs/GR-002-GR-003-notable-places.md).

**The live demo:** https://luna-scope.afras.dev (a replay of saved real-data runs; see [section 11](#11-how-it-is-built-and-where-it-runs)).

---

## Contents

1. [The product in one page](#1-the-product-in-one-page)
2. [Why it matters](#2-why-it-matters)
3. [The science, step by step](#3-the-science-step-by-step)
4. [The data: where every number comes from](#4-the-data-where-every-number-comes-from)
5. [One site from start to finish, with real numbers](#5-one-site-from-start-to-finish-with-real-numbers)
6. [A tour of the product](#6-a-tour-of-the-product)
7. [Every kind of situation, with real examples](#7-every-kind-of-situation-with-real-examples)
8. [What the real results say](#8-what-the-real-results-say)
9. [How we know it is right, and what is not proven](#9-how-we-know-it-is-right-and-what-is-not-proven)
10. [Honesty built into the design](#10-honesty-built-into-the-design)
11. [How it is built and where it runs](#11-how-it-is-built-and-where-it-runs)
12. [How to present it](#12-how-to-present-it)
13. [Questions judges will ask](#13-questions-judges-will-ask)
14. [What you can and cannot claim](#14-what-you-can-and-cannot-claim)
15. [Where everything is, and what is still open](#15-where-everything-is-and-what-is-still-open)

---

## 1. The product in one page

**The challenge** (NASA Space Apps 2026, *Lunar Landing Site Navigator*): build an intuitive tool that lets mission planners, educators and the public compare landing sites and dates near the Moon's south pole, by showing where the **Sun** and **Earth** are relative to the local horizon, so they can judge **power** (does sunlight reach a solar panel, and for how long?) and **communications** (can the site see Earth directly, and when does the line of sight break?).

**LunaScope is that tool.** You pick places on the Moon and a stretch of time. For the Sun and for Earth, separately, it tells you *when each is above the surrounding terrain, how much of the time that is, and whether that meets a requirement you set*. It shows the answer three ways: as numbers and plain sentences, as a moving picture of the sky (2D and 3D), and as a timeline. Next to every terrain-aware result it shows what a **flat horizon** would have said, because the gap between the two is the whole point.

**In one sentence for a judge:** *At the lunar south pole the Sun and Earth sit only a few degrees above the horizon, so the terrain around a site, not the Sun's height, decides whether it gets power or a line to Earth; LunaScope computes that from real NASA data, checks it two independent ways, and says plainly what it does not know.*

**What exists, working today**

| Part | What it is |
| --- | --- |
| The **science service** (Python) | Fetches where the Sun and Earth are, builds the terrain skyline from NASA elevation data, finds every moment each one clears the terrain (to the second), and decides pass, fail, indeterminate or excluded. |
| The **web app** (Next.js) | Displays what the service decided: Home, analysis form, run page, Local sky (polar, unrolled and **3D**), timeline, compare, Time Machine, dates search, evidence. It never decides visibility itself. |
| **Real NASA data** | JPL Horizons (Sun and Earth positions), LOLA elevation (terrain), NAIF SPICE (independent check), the NASA Goddard LOLA illumination maps (a comparison target), and the IAU's official place names. |
| **Sites you can pick** | 3 demonstration points, **12 named south-polar places** (two ready-made comparisons), and any **custom coordinates**. |
| **Evidence** | Data fingerprints, double-checks, a comparison against NASA's published illumination maps, sensitivity and convergence studies, and a frozen reference run that reproduces exactly. |
| **Hosting** | A public replay demo (Vercel web plus a free container service) and an offline package, so the demo survives a network failure. |

**An honest note up front.** Nothing is *validated*: the terrain data is not formally approved and the project's science decisions are unsigned. Every result is labelled **real data, unverified**. The sites in the reference runs are named features or rule-chosen points, **not landing recommendations**. LunaScope screens opportunities; it does not certify safety, power or communications.

---

## 2. Why it matters

### The stakes

The Moon's south pole is where much of the next decade of lunar exploration is aimed. NASA's Artemis programme named candidate landing regions there for a crewed landing; commercial lunar landers (the CLPS programme) and missions from other space agencies are heading to the same region. Three reasons:

- **Water ice.** Some crater floors never see sunlight, and the cold keeps ice that could become drinking water or rocket fuel. In 2009 NASA's LCROSS probe struck the crater Cabeus and detected water in the plume.
- **A few places get a lot of sunlight.** Near the pole the Sun skims the horizon, so ridges and massifs can stay lit for large parts of the year. Those are candidates for solar power.
- **A lander still has to talk to home.** Earth hangs low in the south-polar sky, so a direct line to Earth is not guaranteed.

### Why it is hard

On Earth the Sun climbs and sets daily because our axis is tilted about 23°. The Moon's axis is tilted only about **1.5°**, so near a pole the Sun never climbs: it circles the horizon once every 29.5 days at an elevation within a degree or two of level. In the real run at latitude -89.5°, the Sun's centre never rose above about **1.3°**. For scale, your thumb at arm's length covers about 2°.

Earth is similar from the other direction. The Moon always shows nearly the same face to Earth, so Earth hangs in almost one spot, wobbling a few degrees with **libration**. At a polar site Earth sat between about **-1.5° and +6.9°** over the reference week.

### Why the ground decides everything

When the Sun is only a degree or two up, almost *any* rise in the ground hides it. A ridge 300 m higher than you and 5 km away stands about **3.3°**, taller than the Sun ever gets here. The Sun is "above the horizon" in the astronomer's sense, but you will never see it. The real skyline heights at the three reference sites have **medians of 4.4°, 17.4° and 5.3°**, reaching over 31° at one.

### Why a flat-horizon estimate fails

The easy method is "the Sun is visible whenever its elevation is above 0°", which treats the Moon as a flat plain. At the south pole it badly overestimates: in the reference run it said **100%** at all three sites where the terrain-aware answer was **0%**. A planner trusting the simple number would choose sites on a false premise.

### The other half: timing

A site is not just good or bad: the Sun and Earth move, so each is visible for stretches and hidden for others. Missions care about **how long the longest outage lasts** and **what changes if the launch slips**. That is why LunaScope shows timelines, a countdown to the next sunset or Earthset, a **Time Machine** that shifts the start date, and a **dates search**.

### Real-world examples this speaks to

| Real situation | How LunaScope helps |
| --- | --- |
| **Artemis III candidate regions** (NASA named nine near the south pole in October 2024) | Compare the features nearest to each (Haworth, Mons Malapert, Mons Mouton, Nobile, de Gerlache, Slater) over the same week; see which get sunlight, which see Earth, which are walled in. |
| **Where to put a relay or ground station** | NASA's LOLA team describes the Malapert massif as having high illumination and exceptional Earth visibility. Our run shows Mons Malapert with Earth visible 100% of the week and the Sun for part of it, the kind of finding a planner screens for. |
| **A launch slips by days** | The Time Machine recomputes the same sites with only the start date moved: in our run a five-day slip took Earth at two sites from 74.5% and 65.0% to **100%**, and the Sun at one site from **0% to 51%**. |
| **Choosing dates for a short surface mission** | The dates search tests a range of start dates against requirements and shows which pass, with the trade-offs visible and no hidden score. |
| **Teaching and outreach** | The Guided mode, the "Why the south pole is hard" page and the 3D look-around show students why a few degrees and a ridge decide everything. |

(LunaScope does **not** replace the detailed engineering that follows site screening; see [section 14](#14-what-you-can-and-cannot-claim).)

---

## 3. The science, step by step

No code and no jargon you cannot look up in the [glossary](USER-GUIDE.md#14-glossary).

### 3.1 Where in the sky: azimuth and elevation
To say where something is in your sky you need two angles: **azimuth** (compass direction: 0° north, 90° east, 180° south, 270° west, clockwise) and **elevation** (height above the level horizon: 0° on the horizon, 90° straight up, negative below). Everything LunaScope does compares the Sun's or Earth's elevation, at its azimuth, with the **skyline**: the height of the highest terrain in that same direction.

### 3.2 Conventions are not boring
An agreement about meaning (longitude east or west? latitude measured from the centre or along the surface normal?) decides whether the whole sky is mirrored, yet every number still looks plausible. LunaScope fixes one convention (planetocentric latitude, east-positive longitude, a 1,737.4 km sphere, the Moon's "Mean Earth" frame) and **converts your input to it**, keeping what you typed alongside. A missing convention is refused rather than guessed, and the tests deliberately try the wrong direction, sign and units to prove they are caught.

### 3.3 Where are the Sun and Earth? (ephemerides)
An *ephemeris* is a table of where bodies are at any time. **JPL Horizons** returns, for a point on the Moon, the Sun's and Earth's azimuth and elevation at times you ask for, including **light-time** (you see where a body *was*) and **stellar aberration**. The Moon has no atmosphere, so there is no refraction. Positions can be computed for any date, including future ones: this is calculation from orbit models, not a live feed, so a real-time stream would add nothing.

### 3.4 Checking a second way (SPICE)
A single source can be wrong invisibly, so LunaScope also computes the same directions with **NAIF SPICE**, NASA's separate toolkit. They are compared at every sample. The agreed tolerance is 0.01 arcseconds; the largest disagreement found was **0.0017 arcseconds**, roughly a million times smaller than the terrain's own uncertainty. This validates the *directions only*, never the terrain.

### 3.5 Filling in between samples
Horizons gives positions every 10 minutes. The Sun and Earth move smoothly, so between samples the tool fits a smooth curve with a proven error bound, then checks it against a finer 1-minute series: the largest error was about **1×10⁻⁸ degrees**.

### 3.6 The terrain: from laser pulses to a skyline
The terrain comes from **LOLA**, the laser altimeter on NASA's Lunar Reconnaissance Orbiter: a map of heights at **20 m per pixel** covering 80°S to the pole. To get the skyline at a site, the code looks outward in each of **3,600 compass directions** (every 0.1°) up to **150 km**, asks at each step how high that ground appears from the observer's eye (a 2 m mast), including the **curvature** of the Moon, and keeps the highest. **Missing data stays missing**: an unknown direction is marked unknown, never treated as flat ground.

### 3.7 The central quantity: clearance
> **clearance(t) = (target's elevation) − (skyline at the target's azimuth) − (margin)**

Positive clearance: visible. Negative: hidden. The moments it crosses zero are the **rises and sets** the tool reports.

### 3.8 Finding the crossings without missing any
Looking every 10 minutes could miss a brief dip. LunaScope instead **certifies**: it knows a speed limit on how fast clearance can change; if clearance is bigger than that limit times the time to an interval's ends, the sign *cannot* flip, so the interval is proven entirely visible or hidden. Otherwise it splits the interval and repeats, pinning each crossing to **1 second**. Time too close to zero to call is kept in a narrow **decision band** (0.01°, a fiftieth of the Sun's width) as *unresolved*. If an interval cannot be settled it becomes *uncertified*: the tool says "I could not tell", never "nothing happened".

### 3.9 Durations, bounds and outcomes
The window is cut into classified stretches (visible, hidden, unresolved, uncertified, no data) and the tool adds up **durations**. **Availability** is a range: a **lower** bound (only certified visible time) and an **upper** bound (also counting unsure time). You set a requirement (say Sun at least 60%). With a range there are four honest outcomes:

| If… | Outcome |
| --- | --- |
| lower bound ≥ requirement | **Pass** |
| upper bound < requirement | **Fail** |
| the range straddles it | **Indeterminate** |
| data missing or not certified | **Excluded** (left out, not failed) |

### 3.10 The Sun and Earth are discs
The Sun is about 0.5° wide and Earth about 1.9° wide from the Moon. Near the skyline part of a disc can show while its centre is hidden. LunaScope brackets this with the **upper limb** (visible as soon as any part clears) and the **whole disc**. In the real run no outcome flipped, but Earth's availability moved by several percentage points.

### 3.11 What if the date slips? (Time Machine, dates search)
The Sun and Earth move against the same fixed terrain, so shifting the start changes the answer. The **Time Machine** moves *only* the start date and shows both results side by side. The **dates search** does it for a range of dates and shows a tested-dates strip.

### 3.12 Visible is not the same as useful
LunaScope measures **geometric visibility**. For power you also need panel orientation, efficiency and batteries (a Sun one degree up gives little energy). For communications you also need antennas, power, data rate and ground stations ("Earth is visible" is not "the link works"). The tool says this on its pages.

---

## 4. The data: where every number comes from

| What | Source | Role | How it is protected |
| --- | --- | --- | --- |
| Where the Sun and Earth are | **JPL Horizons** (NASA/JPL) | primary directions | every response stored verbatim with its SHA-256; no request without a project contact |
| An independent check on those | **NAIF SPICE** kernels (NASA/JPL) | cross-check | kernels pinned by checksum and verified before loading |
| The terrain | **LOLA 20 m south-polar elevation model**, two releases (PGDA 2023 "adjusted" and the PDS release) | skyline | files pinned by SHA-256; a missing or altered file blocks the run |
| A published answer to compare against | **NASA Goddard Lunar Polar Illumination maps** (Mazarico et al. 2011), Sun and Earth, 60 m per pixel | comparison only, not an input | file hashes recorded in the evidence |
| Names and centre points of places | **IAU Gazetteer of Planetary Nomenclature** (USGS), public domain | the 12 named places | the rows used and the source file's hash are committed (`data/sites/iau_extract.json`) |
| Looking at terrain | LROC QuickMap and NASA Moon Trek | visual reference only | not a numerical input |

A **manifest** per resource records its origin, size, checksum, coordinate system, units and terms. The rule is: *no numerical input is used without a manifest.* "Present and matching its checksum" does **not** mean "scientifically approved", and the tool keeps those two ideas apart.

**Why two terrain releases?** They are two published versions of the same 20 m data. Running both shows how much the *choice* of release matters. It does not say which is more correct.

**Other agencies' data.** The organizers allow data from other agencies (except Chinese). This build uses NASA and IAU/USGS data only.

---

## 5. One site from start to finish, with real numbers

Site `rule-89.5S-E0` (latitude -89.5°, longitude 0°), the week from 2027-01-10 UTC.

1. **Place the observer.** Convert to the standard convention. The ground there is **722 m below** the reference sphere (a low spot); the eye is 2 m above it.
2. **Get the sky.** Ask Horizons for the Sun's and Earth's azimuth and elevation every 10 minutes for 7 days (1,009 samples each), and cross-check with SPICE. The Sun's elevation stays between **0.42° and 0.87°**; Earth's ranges from **-0.75° to +6.90°** while its direction barely moves.
3. **Build the skyline.** 3,600 directions out 150 km. It runs from **-0.26° up to 9.59°** with a median of **4.4°**, every sector certified.
4. **Compare.** The Sun at 0.4° to 0.9° sits below a skyline mostly above 4° across its whole sweep. At best it is **5.8° below** the skyline. Result: **0% visible, Fail** against a 60% requirement, where a flat horizon says 100%.
5. **Earth is different.** It climbs to 6.9°, above the skyline in its direction: visible about **74.5%** of the week, with one set or rise event and a longest outage of about 1 day 18½ hours. Against 50%: **Pass**.
6. **Quantify the doubt.** Re-run with half the azimuth step and with the other terrain release: Earth's availability moves by under 0.25 percentage points and the outcome never changes. Treating Earth as a disc moves it several points, outcome unchanged.
7. **Record everything.** Request, settings, data fingerprints, Horizons response hashes, skyline, every interval and event, metrics and caveats go into one bundle labelled *real data, unverified*.

The site status is **"Fail: Sun"**: Earth passes, the Sun fails, and the two are never merged into one score.

---

## 6. A tour of the product

| Page | What it is for | Highlights |
| --- | --- | --- |
| **Home** | Start here. | **Start the reference mission** (GR-001); two cards to **compare notable south-polar places** (Artemis III features, well-known craters); links to your own analysis and the explainer. |
| **New analysis** | Set up your own comparison. | Start date and time (with **Start from now**), duration, step; presets grouped as demonstration points, Artemis III features and well-known craters, each with its IAU entry; **custom coordinates** with a terrain-coverage check; requirements; a share link that fills the form and runs nothing. |
| **Run page** | The answer: sites against Sun and Earth. | Terrain-aware result beside the flat-horizon result; a verdict line; warnings; the three evidence cards. |
| **Local sky** | See it. | **Polar**, **Unrolled** and **3D (look around)** views, a time player (play, previous and next event, speed), a countdown to the next sunset or Earthset with a stated model bracket. |
| **3D view** | An intuitive picture of the real situation. | Stand at the site: the terrain skyline is a wall around you with a bright ridge line; the Sun (sphere) and Earth (diamond) move beyond it. Look around or view from outside; face the Sun or Earth; optional ×3 height exaggeration (stated on screen). A target behind the wall is hidden, with a faint copy through it. |
| **Timeline** | Outages and bands. | Visibility bands with the longest outage bracketed; a **Guided / Technical** switch for plain sentences or the service's own wording. |
| **Compare** | Side by side. | Sites against each other. |
| **Time Machine** | What if the date slips? | Shift the start (±30 days) and see deltas; **dates search** with a tested-dates strip; each run keeps its own clock unless you ask for a shared calendar. |
| **Evidence** | Why believe it. | Three validation cards, data fingerprints, the disc-size table, sensitivity, and a downloadable evidence bundle (verified export is refused until something is actually validated). |
| **Why the south pole is hard** | Explainer for any audience. | A three-minute schematic. |

The data-status pill is on every page, and a **REPLAY MODE** badge appears on the public demo.

---

## 7. Every kind of situation, with real examples

These are the cases the tool meets, each with a real result from the project's records (the reference week 2027-01-10, Sun needs at least 60%, Earth at least 50%; scenario values, not mission rules).

| # | Situation | What you see | What it means | Real example |
| --- | --- | --- | --- | --- |
| 1 | **Flat horizon says yes, terrain says no** | Sun 100% (flat) against 0% (terrain). | The ground is hiding a target that geometry puts above zero. The core finding. | All three GR-001 sites; also Shackleton, Faustini, Shoemaker and Slater. |
| 2 | **A lit ridge or massif with a clear line to Earth** | Earth 100%, Sun for part of the week. | The kind of place a planner would screen for power and communications. | **Mons Malapert**: Sun 26.5 to 27.0%, Earth 100%. **Mons Mouton**: Sun 14.6%, Earth 100%. |
| 3 | **A permanently shadowed crater floor** | Sun 0%, Earth 0% or low. | Cold and dark, where ice survives. Poor for solar power, valuable for science. | **Shackleton**: skyline 19.8° to 23.6°, Sun 0%, Earth 0%. **Haworth**, **de Gerlache**, **Faustini**, **Cabeus**, **Sverdrup**: Sun 0%. |
| 4 | **A walled-in site** | Neither target ever clears the skyline. | Nothing will reach it this week. | GR-001 site at 120°E: skyline 11° to 31°. |
| 5 | **Sun yes, Earth no (or the reverse)** | Requirements judged separately; status "Fail: Earth" or "Fail: Sun". | Power and communications are different questions and are never merged into one score. | **Nobile**: Sun 100%, Earth 30.3 to 30.6% (fails 50%). GR-001 0°E: Earth passes, Sun fails. |
| 6 | **A date slip changes the answer** | Time Machine deltas. | Schedule slips are real engineering events. | +5 days: Earth at 0°E from 74.5% to 100%; the Sun at 240°E from 0% to 51.2%, still short of 60%. |
| 7 | **No date passes** | A dates strip full of "Fails". | Honest "no" instead of an invented best date. | Eight dates (2027-01-10 to 01-17): none passes; the closest is the Sun at 240°E from 01-15 (51.2%). |
| 8 | **The data cannot decide** | **Indeterminate** or **Excluded**, with a reason code. | Unknown is never counted as visible or hidden. | The event search could not certify an interval, so the Sun's outcome is Excluded (reason `UNCERTIFIED_EVENT_SEARCH`) at Mons Malapert and Mons Mouton. On 2027-01-17 at 0°E it was a 4.7 s sliver, shorter than the 5 s minimum interval. |
| 9 | **Part of the terrain is missing** | A coverage warning and fewer certified sectors. | The result is a wide range, not a guess. | **Amundsen**: 3,099 of 3,600 sectors certified, Sun 33.3 to 88.2%, Excluded. |
| 10 | **The result depends on which terrain release** | A `SENSITIVITY_HIGH` flag and an "Evidence: Terrain horizon: Not met" card. | A real uncertainty is shown, not hidden. | Mons Malapert (the other release changes the Sun's lower bound by 8.8 points), Mons Mouton, Slater. |
| 11 | **Is the Sun a point or a disc?** | The disc-size table (upper limb, centre, whole disc). | Edge cases near the skyline can shift by several points. | Earth's availability moved several points at two reference sites; no outcome flipped. |
| 12 | **Your own coordinates** | A coverage check, then a computed run (on a machine with the terrain files). | Works anywhere from 80°S to the pole. Points north of 80°S are refused because there is no terrain data. | Custom points on the local live stack; the public demo refuses them (replay only). |
| 13 | **Your own requirements** | Change the Sun and Earth thresholds in the form. | Outcomes follow your numbers, never a fixed rule. | Default 60% Sun, 50% Earth. |
| 14 | **No network at the pitch** | The offline package opens in replay mode. | The demo survives a failed Wi-Fi. | `fallback/` plus the public replay demo. |
| 15 | **A beginner or a student** | Guided mode, the explainer page, the 3D view. | The same facts in plain sentences. | The "Why the south pole is hard" page. |

---

## 8. What the real results say

### GR-001: the frozen reference (three rule-chosen points at -89.5°)

| Site | Ground height | Sun (terrain) | Earth (terrain) | A flat horizon would say |
| --- | --- | --- | --- | --- |
| 0°E | -722 m | **Fail**, 0% (best 5.8° below skyline) | **Pass**, 74.5% | Sun 100%, Earth 92% |
| 120°E | -1,714 m | **Fail**, 0% (22.7° below) | **Fail**, 0% (8.2° below) | Sun 100%, Earth 84% |
| 240°E | +938 m | **Fail**, 0% (2.5° below) | **Pass**, 65.0% | Sun 100%, Earth 85% |

These were **chosen by a fixed symmetric rule** before any result was seen, so none could be cherry-picked. They are a reference scenario, not candidates. GR-001 is frozen and reproduces exactly from a clean checkout with the network off.

### The five-day shift and the dates search
Shifting the start by five days gives Earth **100%** at 0°E and 240°E, and the Sun at 240°E **51.2%** with a rise about 76 hours in and a set about 162 hours in, still short of 60%. That run carries a sensitivity flag (documented in [GR-001-plus5d.md](runs/GR-001-plus5d.md)). Across eight start dates **none passes**.

### GR-002 and GR-003: named places (draft references)

| Place | Sun, terrain | Sun, flat | Earth, terrain | Earth, flat |
| --- | --- | --- | --- | --- |
| Haworth | Fail 0.0% | 39.7% | Fail 0.0% | 100% |
| **Mons Malapert** | Excluded 26.5 to 27.0% | 36.2% | **Pass 100%** | 100% |
| **Mons Mouton** | Excluded 14.6 to 14.7% | 72.0% | **Pass 100%** | 100% |
| Nobile | **Pass 100%** | 100% | Fail 30.3 to 30.6% | 100% |
| de Gerlache | Fail 0.0% | 6.7% | Fail 0.0% | 88.8% |
| Slater | Fail 0.0% | 100% | Fail 13.1 to 13.5% | 78.6% |
| Shackleton | Fail 0.0% | 100% | Fail 0.0% | 84.9% |
| Shoemaker | Fail 0.0% | 100% | Fail 23.7 to 24.1% | 99.6% |
| Faustini | Fail 0.0% | 100% | Fail 0.0% | 87.9% |
| Cabeus | Fail 0.0% | 0.0% | Fail 0.0% | 100% |
| Amundsen | Excluded 33.3 to 88.2% | 100% | Fail 0.0% | 90.0% |
| Sverdrup | Fail 0.0% | 73.6% | Fail 0.0% | 72.8% |

**Read these carefully.** The places are the IAU's official **centre points** of named features. A **crater centre is its floor, not its rim**, and most floors are permanently shadowed, so a dark result says nothing about the rim where a lander would sit. NASA's Artemis III regions are 15 km areas on or near these features with no published coordinates we could source, so each uses its *nearest named feature*. The lit places are the massifs, which fits what NASA's LOLA team says of the Malapert region (high illumination and good Earth visibility), though ours is one week and theirs is a long-term average.

---

## 9. How we know it is right, and what is not proven

**What we did to check it**

| Check | Result |
| --- | --- |
| **Directions against NASA's SPICE** | Agree to 0.0017 arcsec (tolerance 0.01). |
| **A second, independently written skyline** | A pixel-by-pixel computation (different traversal, sampling and geometry from the ray method) agrees at all three reference sites inside gates declared in the code. Our *first attempt failed* because the check was designed too strictly; the design was fixed and the failure is kept in the record. |
| **Comparison with NASA's published illumination maps** | We recomputed long-term sunlit and Earth-visible fractions over an 18.6-year cycle and compared them with NASA's maps at ten south-polar sites: correlation **0.974** (Sun) and **0.973** (Earth), mean difference **1.6** and **2.2** percentage points. Where NASA's map says Earth is never visible, so do we. |
| **A check that failed** | On the three reference sites, one declared gate (the order of the Sun's availability at two sites) was **not met**. A pixel-by-pixel look showed we agree with the map at 7 of 9 pixels around that site; at two adjacent pixels the map is far lower than its own neighbours. Which is right is not established. |
| **Convergence and sensitivity** | Finer time step, azimuth step and radius do not change the reference results; the other terrain release does at some named places, and the tool flags it. |
| **Reproducibility** | The frozen run is re-created from a clean version of the code with the network off and reproduces the same ids, intervals and hashes. |
| **Tests** | Hundreds of automated tests (260 web unit tests, 14 browser tests including accessibility, and the science suite). Many are "break it on purpose" tests: they confirm each safeguard fails when the thing it guards is broken. |

**What is not proven**

- **Nothing is validated.** The terrain model is not formally approved, and the science decisions record (SDR-001) is unsigned. Every result is labelled *real data, unverified*.
- **The comparisons are not independent of the terrain data.** NASA's maps and our skyline both come from LOLA topography, so agreement tests our *computation*, not the DEM.
- **No direct lunar measurement** of illumination or Earth visibility at a site was used.
- **One week, a few sites.** The reference windows and sites are small. The named-place runs are draft references with no convergence report.

---

## 10. Honesty built into the design

1. **Unknown is not "not visible".** A hole in the data stays unknown and widens the availability range; it never silently counts as an outage or as sunlight.
2. **Claim only what was proved.** Certified intervals instead of sampled guesses; bounds instead of one number; four outcomes instead of two.
3. **A check must be able to fail.** Each safeguard was tested by deliberately breaking what it guards (a corrupted skyline, a wrong unit, a mirrored azimuth, a stale reply) and confirming it notices.
4. **Labels everywhere.** `synthetic_demonstration`, `real_data_unverified` and `validated` are separate, and nothing is `validated`. The public demo says **REPLAY MODE**.
5. **Display only.** The web app draws what the service decided. In the 3D view an unknown skyline sector is left open, not drawn as flat ground, and enlarged markers and exaggerated heights are stated on screen.
6. **Reproducible by fingerprint.** A run's id is a hash of its inputs, data checksums and algorithm version; a finished result is stored under the hash of its own content and re-checked on every read.

---

## 11. How it is built and where it runs

```
your browser
   │ (only asks; never computes)
   ▼
web app (Next.js)  ── adds a secret token, forwards only allowed requests ──►  science service (Python)
                                                                                  │
                              ┌───────────────────────────────────────────────────┼─────────────────────────────┐
                              ▼                                                   ▼                             ▼
                    JPL Horizons (cached)                          LOLA terrain files (pinned)         SPICE kernels (pinned)
                                                                                  │
                                                                      run store (SQLite + files)
```

- **Where it runs**
  - **Public demo:** web on **Vercel**, science service on a free container host in **replay mode**. It serves the saved real-data runs (GR-001, its five-day shift, the dates search, GR-002 and GR-003) and refuses anything new with a plain "offline copy" message. Free instances sleep when idle, so open it a minute early.
  - **Live computing:** on a machine with the terrain and SPICE files (about 2.7 GB). Custom coordinates and dates compute there, in minutes.
  - **Offline package:** a saved copy of the real-data runs, so the demo survives a network failure.
- **Each analysis runs as its own process**, so one that takes too long can be stopped; at most two run at once with eight waiting.
- **The 3D view** uses three.js, loaded only when you choose it.
- **Tested** with automated unit tests, browser tests (keyboard-only, accessibility, phone width, the 3D view) and a smoke test run signed out against the public link.

---

## 12. How to present it

The judging guide gives **5 minutes of demo and 5 minutes of questions**, says complex presentations are not needed, and scores five criteria out of 10 each (**Impact, Creativity, Validity, Relevance, Presentation**). The demo link on the project page must be **at most 7 slides or a 30-second subtitled video**, publicly accessible, with no voices or pictures of anyone under 18, and with an AI/software disclosure.

**Suggested five minutes (live, from a laptop with the full local stack; the public link as backup)**

| Time | Show | Say | Scores on |
| --- | --- | --- | --- |
| 0:00 to 0:40 | the explainer page or a slide | A few degrees of sky and the ground around you decide whether a site gets power or a line to Earth. | Impact |
| 0:40 to 1:30 | Home, **reference mission**, the run page | Flat horizon says the Sun is up 100% of the week; real terrain says 0%. | Creativity, Relevance |
| 1:30 to 2:30 | **Local sky 3D**: Next event, **Face the Earth** | Earth sits on the ridge line at its predicted rise; hidden is a wall in front of it. | Presentation, Creativity |
| 2:30 to 3:15 | **Named places**: Mons Malapert against Shackleton | The massif gets Earth all week and some Sun; the crater floor stays dark. | Impact, Relevance |
| 3:15 to 3:50 | **Time Machine**: shift five days | A slip changes the answer: Earth reaches 100%, the Sun at one site goes from none to about half. | Impact |
| 3:50 to 4:30 | **Evidence** and the NASA-map comparison | Directions match NASA's SPICE; our long-term numbers track NASA's published maps (0.97); here is the one check that failed. | Validity, Relevance |
| 4:30 to 5:00 | limits and close | Screening and education tool; unverified; not a landing recommendation. | Validity, Presentation |

If time allows, enter **one custom coordinate live** to show it computes, and say that the public demo is replay-only.

---

## 13. Questions judges will ask

### Impact
- **Who is this for, and why does it matter?** Mission planners screening sites and dates, educators and the public. Sites and schedules near the south pole are being chosen now, and early screening needs fast, comparable answers.
- **How is it different from QuickMap, Moon Trek or Horizons?** Those are excellent but separate and expert-oriented. LunaScope joins terrain, geometry and time into one answer, shows flat versus terrain side by side, and states what it is unsure of.
- **Does it help beyond experts?** Yes: Guided mode, an explainer page, a 3D view and plain-language results.
- **What about Sri Lanka?** The same screening idea teaches students how terrain and orbits shape exploration; there is no site-specific Sri Lankan content.

### Creativity
- **What is new here?** Terrain-aware visibility with **certified** event times (no missed crossings, with bounds and an explicit "unknown"), a Time Machine and dates search, and a 3D first-person sky with the skyline as a wall.
- **Why a 3D view?** It makes the central idea (a ridge hides the Sun) physical. The 2D plots give precision; the 3D view gives intuition.

### Validity
- **Is this a real result?** It uses real NASA data and is labelled unverified. No validation gate has closed.
- **How do you know the angles are right?** JPL Horizons, cross-checked against NASA's SPICE to 0.0017 arcseconds. That covers the directions only.
- **How do you know the skyline is right?** A second, independent computation agrees at the three reference sites, and our long-term fractions correlate at 0.97 with NASA's published illumination maps over ten sites. Both read related LOLA data, so this checks the computation, not the terrain model.
- **Anything that did not agree?** Yes: one declared check on the three reference sites failed (the order of two sites in the Sun result), traced to an outlier pixel in the map. We report it rather than hide it, and sensitivity to the terrain release is flagged at three named places.
- **Is the sunlit percentage the same as power?** No. It is geometric illumination. Power needs panel and battery models.
- **Does "Earth visible" mean communications work?** No. It is a line of sight, not a link budget.
- **What if the data is missing?** It stays unknown or excluded, and the range widens; it is never counted as hidden or visible.
- **Does it account for libration, no atmosphere, curvature?** Libration is in the Earth directions from Horizons and SPICE; there is no refraction on the airless Moon; the skyline includes the Moon's curvature.
- **Why not just use real-time data?** The Sun and Earth positions are calculated from orbit models for any date, and the terrain is static. Real-time would add nothing; "Start from now" simply starts a window at the current hour.

### Relevance
- **Which NASA data do you use?** LOLA terrain, JPL Horizons, NAIF SPICE, and NASA's published illumination maps for comparison. IAU/USGS names for the places. NASA data is the core of the method.
- **Did you cover the challenge's objectives?** Site selection and comparison (named places, custom coordinates), date flexibility, Sun and Earth positions with a countdown, key metrics, 2D and 3D visualizations, animation and timelines, and accessibility across skill levels.
- **Why not Apollo or other landing sites?** Our terrain data covers 80°S to the pole, and most famous landings lie outside it. We say so rather than fake it.

### Presentation and the product
- **Can I try my own site and dates?** On the public link the demo is a replay of saved runs, so new inputs are refused with a plain message. On a machine with the terrain files it computes them; we show that live.
- **Why are those sites "Fail"?** A crater centre is its floor, usually permanently shadowed. A rim would behave differently, and these are named features, not landing recommendations.
- **What if the network fails?** The offline package opens the saved runs with no network.
- **Can it choose a safe landing site?** No. It screens lighting and direct-to-Earth opportunity only.

### Process and disclosure
- **Who built this, and was AI used?** The project was built with **Claude Code**, an AI coding assistant, at the team's direction. It wrote most of the code, tests and documentation. It did not choose any site, validate any result or generate any NASA logo. The commit history is public and the disclosure file lists this.
- **Was this started before the event?** The specification and a first implementation were prepared on 13 November and are disclosed, with the full commit history; the product was extended during the event. We have not obtained written organizer permission for the earlier work, and we say so.

---

## 14. What you can and cannot claim

**You can say** (all backed by the records):
- LunaScope compares terrain-aware sunlight and direct-to-Earth visibility for south-pole sites and dates using NASA's JPL Horizons, LOLA elevation data and an independent SPICE check.
- On a frozen, reproducible reference run, terrain changes every Sun result from a flat-horizon pass to a fail.
- A second skyline written independently agrees, and our long-term numbers correlate at 0.97 with NASA's published illumination maps over ten sites (with one disclosed failed check).
- A five-day date slip measurably changes the outcome.
- You can compare twelve IAU-named south-polar places and your own coordinates; unknown is never counted as an outage.
- The demo works offline from a saved real-data package and is publicly available as a replay.

**You must not say:**
- that any result is *validated*, *verified*, *accurate*, *optimal* or *recommended*;
- that the named places or reference sites are candidate landing sites, or that the tool picks "the best site";
- that sunlight percentage is power, or that Earth visibility is a communications guarantee;
- that the public demo computes new analyses online (it replays saved runs);
- that NASA endorses it, or use or alter a NASA logo;
- that organizer permission for earlier work is on file (it is not).

The authoritative list, with each claim's status, is [`docs/submission/CLAIMS-AUDIT.md`](submission/CLAIMS-AUDIT.md).

---

## 15. Where everything is, and what is still open

| Folder or file | What is in it |
| --- | --- |
| `science/lunascope/` | the service: observer, skyline, events, metrics, run lifecycle, the independent skyline and the illumination comparison |
| `science/scripts/` | command-line tools: reference runs, the offline package, the studies and checks |
| `app/`, `components/`, `lib/` | the web app, including the 3D view (`Sky3D.tsx`, `sky3d.ts`) |
| `tests/` and `science/tests/` | web, browser and science tests |
| `data/manifests/`, `data/sites/`, `data/reference/` | data descriptions, the site catalog and IAU extract, the reference definitions (GR-001 frozen, GR-002 and GR-003 draft) |
| `docs/runs/` | the real-run records and evidence |
| `docs/submission/` | the claims audit, licences, disclosures, pitch pack |
| `docs/sdr/` | the science decision record and the (unsigned) sign-off sheet |
| `deploy/`, `render.yaml` | container images, the replay package and the hosting blueprint |
| `docs/USER-GUIDE.md` | the page-by-page manual |
| `docs/LunaScope-Phase-Plan.md` | the live status of everything |

**Still open** (each is a human decision or a presentation task, not a bug):
- The **7 slides or the 30-second video** and the **project page text** (summary, NASA resources, AI disclosure), which the submission requires.
- A **timed rehearsal**, and opening the public demo a minute early.
- The **science owner's sign-off** on SDR-001, without which nothing can be called validated.
- **Organizer permission** for the pre-event work (not on file; disclosed).
- Optional upgrades, not needed for the challenge: live computing online (needs a larger paid server), more notable sites with sourced coordinates, rim points for the named craters, and Sri Lanka-specific content.

---

*If you remember only three things: (1) at the south pole the **terrain**, not the Sun's height, decides whether a site gets sunlight or a line to Earth; (2) LunaScope shows that with real NASA data, **checks it independently**, and **tells you what it does not know**; (3) it is a **screening and education tool**, honestly labelled as unvalidated.*
