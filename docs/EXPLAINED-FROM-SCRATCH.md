# LunaScope explained from scratch

**Read this first if you do not know what was built.** It assumes no background in astronomy, mapping or the code. It tells the story, explains the science behind every number, shows how the pieces fit together, and ends with how to use it and what you may honestly claim. The companion [User Guide](USER-GUIDE.md) is the page-by-page manual; this document is the *why* and the *how it works*.

Every figure quoted here comes from the project's own records (the frozen reference run in [`docs/runs/GR-001-run.md`](runs/GR-001-run.md) and the first real run in [`docs/runs/RUN-001-first-real-run.md`](runs/RUN-001-first-real-run.md)), not from general knowledge.

---

## Contents

1. [What you built, in one page](#1-what-you-built-in-one-page)
2. [The problem: why this is hard and why it matters](#2-the-problem-why-this-is-hard-and-why-it-matters)
3. [The theory, step by step](#3-the-theory-step-by-step)
4. [The data: where every number comes from](#4-the-data-where-every-number-comes-from)
5. [The method: one site, start to finish, with real numbers](#5-the-method-one-site-start-to-finish-with-real-numbers)
6. [Honesty built into the maths: bounds, certainty and "unknown"](#6-honesty-built-into-the-maths-bounds-certainty-and-unknown)
7. [Trust: how a result can be checked and reproduced](#7-trust-how-a-result-can-be-checked-and-reproduced)
8. [How the software is put together](#8-how-the-software-is-put-together)
9. [What the real results say](#9-what-the-real-results-say)
10. [How to use it, as a person and as a presenter](#10-how-to-use-it-as-a-person-and-as-a-presenter)
11. [What you can and cannot claim](#11-what-you-can-and-cannot-claim)
12. [How it was built, and where everything is](#12-how-it-was-built-and-where-everything-is)

---

## 1. What you built, in one page

You asked for an entry to the **NASA Space Apps Challenge 2026**: a *terrain-aware lunar power and direct-to-Earth opportunity navigator*. The challenge asks for an intuitive tool that lets planners, educators and the public compare places and dates near the Moon's south pole, by showing where the **Sun** and **Earth** are relative to the local horizon, so you can judge:

- **power**: will sunlight reach a solar panel there, and for how much of the time?
- **communications**: can a spacecraft there see Earth directly, and when does it lose it?

**LunaScope is that tool.** You choose a place on the Moon and a stretch of time. It tells you, for the Sun and for Earth separately, *when each one is above the surrounding terrain, how much of the time that is, and whether that meets a requirement you set*. It shows the answer as a timeline, as a moving picture of the sky, and as plain-language sentences. It also shows what a **flat horizon** would have said, because the gap between the two is the whole point.

**What actually exists** (all of it working and tested):

| Part | What it is |
| --- | --- |
| The **science service** | A Python program that does all the computing: it fetches where the Sun and Earth are, builds the terrain skyline from real NASA elevation data, and works out exactly when each is visible. |
| The **web app** | The pages you click through. It only *displays* what the service decided; it never works out visibility itself. |
| The **real data** | NASA's JPL Horizons (positions of the Sun and Earth), NASA's LOLA elevation model (the terrain), and NASA's SPICE toolkit (an independent cross-check). |
| The **reference run, GR-001** | A frozen, fully checked real-data result for three sample sites, used as the project's "golden" example. |
| The **offline package** | A saved copy of that real result so the demo works with no internet. |
| The **evidence** | Records, hashes and tests that let anyone check where each number came from. |

**The single most important result:** at all three sample sites, a flat-horizon estimate says the Sun is visible 100% of the week, while the real terrain says **0%**. Terrain, not geometry, decides. That is exactly the effect the challenge describes, shown with real data.

**An honest note up front.** Nothing here is *validated*: the elevation data has not been formally approved and the project's science decisions have not been signed off. Every result carries a label saying so. The three sample sites are rule-chosen points, **not** proposed landing sites. And LunaScope screens opportunities; it does not certify safety, power or communications.

---

## 2. The problem: why this is hard and why it matters

### Why the Moon's poles are special

On Earth the Sun climbs high and sets each day because our spin axis is tilted about 23° from the plane we orbit the Sun in. The Moon's spin axis is tilted only about **1.5°** (the project spec says "about 1.5°"). So near a lunar pole:

- the Sun never climbs: standing at the pole, it circles the horizon at a very shallow angle, a full turn roughly every 29.5 days;
- over a month the Sun's height stays within a degree or two of the horizon.

In the real run's week at the three sample sites (latitude −89.5°, half a degree from the pole), the Sun's centre was never higher than about **1.3 degrees** above the level horizon and as low as **0.2 degrees**. For comparison, your thumb at arm's length covers about two degrees.

Earth is a similar story from the opposite direction. The Moon always shows nearly the same face to Earth, so from the Moon Earth hangs in almost one place in the sky. It does not stay perfectly still: the Moon wobbles slowly (**libration**), which moves Earth by a few degrees. At a polar site Earth therefore sits close to the horizon too. In the real run Earth's height swung between about **−1.5° and +6.9°** over the week, while its compass direction hardly moved (a spread of only about 4.6°).

### Why the ground decides everything

When the Sun is only a degree or two up, almost *any* rise in the ground in that direction hides it. Here is the arithmetic, in plain numbers:

> A ridge 300 m higher than you, 5 km away, stands about **3.3°** above a level line from your eyes. (The exact figure is 3.4° for flat ground; the Moon's curved surface drops away about 7 m over 5 km, which trims it to about 3.3°.) That is higher than the Sun ever gets here. The Sun is "above the horizon" in the astronomer's sense, but you will never see it.

The south pole is rough. Crater rims, ridges and massifs rise hundreds of metres to kilometres, and the real run found that the terrain's skyline (the highest terrain in each compass direction) has a **median height of 4.4°, 17.4° and 5.3°** at the three sites, reaching over 31° at one of them. Compare that with a Sun at 0.2° to 1.3°.

### Why a "flat horizon" estimate fails

The easy way to estimate sunlight is to say *the Sun is visible whenever its height is above 0°*. That treats the world as a flat plain. At the south pole it overestimates badly: in the real run it said **100%** at all three sites while the terrain-aware answer was **0%**. A planner trusting the simple number would have chosen sites on a false premise.

### Why it matters in the real world

The Moon's south pole is of interest to space agencies because:

- some crater floors there stay in permanent shadow, and shadowed regions are the places where water ice is thought to survive, which is valuable for future missions;
- a few high places on rims and ridges get sunlight for a large fraction of the time, which makes them candidates for solar power;
- a lander or rover also needs a line of sight to Earth to talk to home directly.

Power and communications are exactly the two things LunaScope looks at, and early in planning a team needs to compare many sites and dates quickly and cheaply. A tool that gets the terrain effect right, and is honest about what it is unsure of, helps that screening step. (LunaScope does *not* replace the detailed engineering that follows: see [section 11](#11-what-you-can-and-cannot-claim).)

### The other half of the problem: timing

A site is not just "good" or "bad": the Sun and Earth move, so each is visible for stretches and hidden for others. Missions care about **how long the longest outage lasts** and **what changes if the launch date slips**. That is why LunaScope shows timelines, countdowns to the next sunset or Earthset, and a "Time Machine" that shifts the start date.

---

## 3. The theory, step by step

This section explains the ideas behind each computation. No code, no jargon you cannot look up in the [glossary](USER-GUIDE.md#14-glossary).

### 3.1 Describing "where in the sky": azimuth and elevation

To say where something is in your sky you need two angles:

- **azimuth**: its compass direction, 0° north, 90° east, 180° south, 270° west, measured clockwise;
- **elevation**: its height above the level horizon. 0° is on the horizon, 90° is straight up, negative is below it.

Everything LunaScope does is about comparing the Sun's or Earth's elevation, at its azimuth, with the **skyline**: the elevation of the highest terrain in that same azimuth.

### 3.2 Conventions are not boring

A *convention* is an agreement about meaning: is longitude measured east or west? Is latitude measured from the planet's centre (**planetocentric**) or along the surface normal? Which reference frame is the Moon's "up"? Get one wrong and the whole sky is mirrored or shifted, yet every number still looks plausible. LunaScope fixes one convention (planetocentric latitude, east-positive longitude, a 1,737.4 km reference sphere, the Moon's "Mean Earth" frame) and **converts your input to it**, keeping what you typed alongside. If a convention is missing the observer is refused rather than guessed. The tests deliberately try the wrong direction, wrong sign and wrong units to prove they are caught.

### 3.3 Where are the Sun and Earth? (ephemerides)

An *ephemeris* is a table of where celestial bodies are at any time. NASA's JPL maintains the standard ones. **JPL Horizons** is an online service that, for a point on the Moon's surface, returns the Sun's and Earth's azimuth and elevation at times you ask for. LunaScope asks it for the **apparent** direction, which includes two small real effects:

- **light-time**: light takes time to travel, so you see where a body *was*;
- **stellar aberration**: motion shifts the apparent direction slightly.

The Moon has no atmosphere, so there is no refraction (bending of light) to correct for.

### 3.4 Checking a second way (SPICE)

A single source can be wrong in a way you cannot see. So LunaScope also computes the same directions with **NAIF SPICE**, NASA's separate toolkit, which reads related ephemeris data but is a different implementation. The two are compared at every sample. The agreed tolerance is 0.01 arcseconds; the largest disagreement found was **0.0017 arcseconds**. For scale, the terrain's own uncertainty is a few tenths of a degree, which is roughly **a million times larger**. So geometry is not the weak link. The check validates the *directions only*, never the terrain.

### 3.5 Filling in between the samples

Horizons gives positions every 10 minutes (the default step). The Sun and Earth move smoothly, so between samples LunaScope fits a smooth curve (a cubic **Hermite spline** on direction vectors) and uses a proven bound on the fit error. It then checks that fit against a finer 1-minute series over the first six hours: the largest error was about **1×10⁻⁸ degrees**, far below anything that matters.

### 3.6 The terrain: from laser pulses to a skyline

The terrain comes from **LOLA**, the laser altimeter on NASA's Lunar Reconnaissance Orbiter. It fires laser pulses at the surface and times the return, building a map of heights. The product used here is a grid covering 80°S to the pole at **20 metres per pixel**, in a *polar stereographic* map projection (a way of flattening the polar cap, which distorts distances in a known way that the code undoes exactly). Heights are measured against the 1,737.4 km reference sphere.

To get the **skyline** at a site, the code looks outward in each of 3,600 compass directions (every 0.1°). In each direction it walks out along the surface, up to 150 km, about 7,500 steps. At each step it asks: *seen from the observer's eye, how high above the local level is this ground?* The answer is a 3-D geometry calculation that automatically includes the **curvature** of the Moon: far ground drops away below the level line. The biggest elevation angle along the walk is the skyline in that direction.

Two small but real details: the observer's eye is a couple of metres above the ground (a mast), which slightly changes the skyline; and the Moon is small, so its horizon is close (a 2 m mast sees a flat-ground horizon dipping about 0.09° below level).

**Missing data is kept missing.** If part of the map has no data, those directions are marked *unknown*, not treated as flat ground (which would silently invent a lower skyline).

### 3.7 The central quantity: clearance

Everything comes down to one number that changes with time:

> **clearance(t) = (target's elevation) − (skyline at the target's azimuth) − (margin)**

Positive clearance means the target is above the terrain and visible. Negative means hidden. The moments clearance crosses zero are the **rises and sets** that the tool reports. The margin is normally zero (the "disc size" check below tries other values).

### 3.8 Finding the crossings *without missing any*

You could just look at clearance every 10 minutes. But a brief dip below the skyline between two samples would be invisible, and a skyline with a sharp notch could fool you. So LunaScope does something stronger, called **certification**:

1. It knows an upper limit on *how fast clearance can possibly change* (from how fast the Sun moves and how steep the skyline is).
2. If clearance at a moment is larger than that speed limit times the time to the interval's ends, the sign **cannot** flip in between, so the interval is proven entirely visible or entirely hidden.
3. Otherwise it splits the interval in half and repeats.
4. Where it finds a sign change, it pins the crossing time to within **1 second**.

Time too close to zero to call is kept in a narrow **decision band** (0.01°, about a fiftieth of the Sun's width) and called *unresolved*. If the search cannot settle an interval within its limit, the interval becomes *uncertified*: the tool says "I could not tell", never "nothing happened".

### 3.9 Turning intervals into numbers

Once the window is cut into classified stretches (visible, hidden, unresolved, uncertified, no data), the tool adds up **durations** (never counts of samples). It reports:

- **availability**: visible time ÷ window, as a **lower** bound (only certified visible time) and an **upper** bound (also counting the unsure time);
- the **longest known hidden stretch** (the biggest outage);
- the **requirement outcome**.

### 3.10 The requirement outcome: why four, not two

You set a minimum, say "Sun at least 60% of the time". With a range [lower, upper] there are four honest answers:

| If… | Outcome |
| --- | --- |
| lower ≥ 60% | **Pass**: even the pessimistic number meets it |
| upper < 60% | **Fail**: even the optimistic number misses it |
| the range straddles 60% | **Indeterminate**: the data cannot decide |
| data is missing or uncertified | **Excluded**: left out, not failed |

A single "yes/no" would hide the middle two cases, and those are exactly the cases where a mission decision is risky.

### 3.11 Does the size of the Sun and Earth matter?

Everything above treats the Sun and Earth as single points (their centres). In reality the Sun is about 0.5° wide and **Earth about 1.9° wide** as seen from the Moon. Near the skyline, part of the disc can show while the centre is hidden, or the centre can show while part is still behind the terrain. LunaScope brackets this: it recomputes with the **upper limb** (visible as soon as any part clears) and the **whole disc** (visible only when all of it clears). The real run showed no pass/fail flips, but Earth's availability moved by several percentage points (the whole-disc reading lowest, the upper-limb highest; Earth still passes with 15.5 and 3.8 points to spare at the two sites where it passes), so the effect is real and the tool shows it.

### 3.12 "What if the date slips?" (the Time Machine)

Because the Sun and Earth move against the same fixed terrain, shifting the start date changes the answer. The Time Machine takes a finished run, moves *only* the start date, recomputes, and shows both side by side. Each run keeps its own clock, unless you ask for one shared calendar, so you never compare two different dates as if they were the same.

### 3.13 Visible versus useful

LunaScope measures **geometric visibility**: whether the Sun or Earth is above the terrain. That is necessary, not sufficient:

- for **power** you also need panel orientation, efficiency and battery sizing; a visible Sun a degree above the horizon gives little energy;
- for **communications** you also need antennas, power, data rates and ground-station availability; "Earth is visible" is not "the link works".

The tool says this on its pages. It is a screen, not an engineering design.

---

## 4. The data: where every number comes from

| What | Source | Role | How it is protected |
| --- | --- | --- | --- |
| Where the Sun and Earth are | **JPL Horizons** (NASA/JPL) | primary directions | every response stored verbatim with its SHA-256; a request without a project contact is refused |
| An independent check on those directions | **NAIF SPICE** kernels (NASA/JPL) | cross-check | kernels pinned by checksum and verified before loading |
| The terrain | **LOLA 20 m south-polar elevation model**, two releases (PGDA 2023 "adjusted" and the PDS release) | skyline | files pinned by SHA-256; a missing or altered file blocks the run |
| Looking at the terrain | NASA's **LROC QuickMap** and **Moon Trek** | visual reference only | not a numerical input |

A **manifest** file in `data/manifests/` describes each resource: where it came from, its size and checksum, its coordinate system, its units, and the usage terms. The service checks them every time it starts. The rule is: *no numerical input is used unless it has a manifest*. "Present and matching its checksum" does **not** mean "scientifically approved", and the tool keeps those two ideas separate.

**Why two terrain releases?** They are two published versions of the same 20 m data. Running both shows how much the *choice* of release matters (it is small, but it is a real effect). It does not tell you which is more correct.

---

## 5. The method: one site, start to finish, with real numbers

Take the reference site `rule-89.5S-E0` (latitude −89.5°, longitude 0°), for the week starting 2027-01-10 UTC.

1. **Place the observer.** Convert the coordinates to the standard convention. The ground there is **722 m below** the reference sphere (a low spot), and the observer's eye is 2 m above it.
2. **Get the sky.** Ask Horizons for the Sun's and Earth's azimuth and elevation every 10 minutes for 7 days (1,009 samples each), and cross-check with SPICE. The Sun's height stays between **0.42° and 0.87°**, sweeping through about 85° of compass direction (from 68° to 154°). Earth's height ranges from **−0.75° to +6.90°** while its direction barely moves (352° to 357°).
3. **Build the skyline.** Walk 3,600 directions out 150 km across the elevation model. The skyline runs from **−0.26° up to 9.59°**, with a median of **4.4°**. Every one of the 3,600 sectors is certified (no missing data).
4. **Compare.** The Sun, at 0.4° to 0.9°, is below a skyline that is mostly 4° or more across its whole sweep. Its clearance is negative the whole week: at best it is **5.8° below** the skyline. Result: **0% visible, Fail** against a 60% requirement. A flat horizon would have said 100%.
5. **Earth is different.** Earth's height reaches 6.9°, above a skyline in its direction that is lower. It is visible about **74.5%** of the week, with one set/rise event and a longest outage of about 1 day 18½ hours. Against a 50% requirement: **Pass**.
6. **Quantify the doubt.** Re-run with half the azimuth step and with the other terrain release: Earth's availability moves by under 0.25 percentage points and the outcome never changes. Re-run treating Earth as a disc: availability moves by several points, outcome unchanged.
7. **Record everything.** The request, settings, data checksums, the Horizons responses' hashes, the skyline, every interval and event, the metrics and the caveats are written into one bundle, labelled *real data, unverified*.

The site status is therefore **"Fail: Sun"**: the Earth requirement passes, the Sun requirement fails, and the two are never merged into one score.

---

## 6. Honesty built into the maths: bounds, certainty and "unknown"

Most of the unusual design choices come from three principles.

**1. Unknown is not "not visible".** If the tool cannot prove an interval is visible or hidden, it keeps it as *unknown* (unresolved, uncertified or no-data) and carries it into the **upper bound** of availability only. A hole in the data therefore widens the range; it never silently counts as an outage, and it never silently counts as sunlight either.

**2. Claim only what was proved.** Instead of declaring "visible" from a sampled value, the search proves an interval has one sign using a speed limit on change. Instead of one availability figure, it gives bounds. Instead of "pass/fail", it adds *indeterminate* and *excluded*.

**3. A check must be able to fail.** Throughout the build, each safeguard was tested by deliberately breaking the thing it guards (a corrupted skyline, a wrong unit, a mirrored azimuth, a stale reply, a flat-horizon fallback) and confirming the safeguard noticed. A check that cannot fail proves nothing.

Related ideas:

- **Verification versus validation.** *Verifying* asks "did we compute what we meant to, consistently?" (the tool does this extensively). *Validating* asks "is the model true to the real Moon?" (this needs independent evidence and formal sign-off, which has **not** happened). That is why every result says *unverified*.
- **Sensitivity.** Re-running with a finer setting or the other terrain release shows whether a conclusion is fragile. A result flagged `SENSITIVITY_HIGH` is one to quote with a caution.
- **Convergence.** Changing one numerical setting at a time (smaller time step, finer azimuth, bigger or smaller radius) and finding the answer does not move shows the numbers are not artefacts of those settings.

---

## 7. Trust: how a result can be checked and reproduced

A scientific tool is only as good as the ability to re-check it.

- **Identity by fingerprint.** Each request is reduced to a canonical form (a fixed ordering and number format) and hashed. The **run id** is that fingerprint together with the data checksums and the algorithm version. The same inputs always give the same id, so the same page, and identical requests are never computed twice (even if twelve arrive at the same moment). A **result id** is sealed when a run finishes.
- **Immutable results.** A finished result is stored under the hash of its own content and re-verified every time it is read. It cannot be silently changed.
- **Everything is cached verbatim.** The raw Horizons responses are kept byte for byte, so a result can be recomputed later without the internet and produce the same answer.
- **The frozen reference.** `GR-001` is pinned: its definition contains the fingerprint of its inputs, data and algorithm. Change *anything* scientific and the tool refuses to run it and says to create `GR-002`. The frozen run was recreated from a clean version of the code **with the network switched off** and reproduced the earlier result exactly: same ids, same intervals, same events, same hashes.
- **Gate 2.** Five named checks over the saved result: the geometry agrees with SPICE; the skyline is intact and certified; the totals add up and re-derive; the event search left nothing uncertified; and every convergence case held. A check passes only if it ran *and* held.
- **Tests.** More than 520 automated tests (376 for the service, 147 for the web app) plus browser tests that use only the keyboard and check accessibility. Many are "break it on purpose" tests.
- **The export.** The Evidence page produces a file with the request, settings, data fingerprints, series, skyline, intervals, events, metrics and a snapshot of the validation cards. A "verified" version is refused until something is actually validated.

---

## 8. How the software is put together

Think of three layers.

```
        your browser
             │  (only asks; never computes)
             ▼
   web app  (Next.js)  ── adds a secret token, forwards only allowed requests ──►  science service (Python)
                                                                                      │
                                                  ┌───────────────────────────────────┼─────────────────────────────┐
                                                  ▼                                   ▼                             ▼
                                        JPL Horizons (cached)              LOLA terrain files (pinned)       SPICE kernels (pinned)
                                                                                      │
                                                                              run store (SQLite + files)
```

- **The browser never decides anything.** Whether a target is visible is computed once, in the service. The page draws it. This avoids two programs disagreeing and keeps the logic testable in one place.
- **The web app's server layer** (the "backend for frontend") hides the service's address and password from the browser and only forwards a short fixed list of requests.
- **Each analysis runs as its own process,** so a run that takes too long can be genuinely stopped, and at most two run at once with eight waiting. A crashed run is retried once.
- **The store** is a small database plus content-addressed files. It needs persistent storage, which is why the service cannot run on "serverless" hosts.
- **Two modes of the service.** *Live* computes (or serves cached) results. *Replay* serves **only** saved results and refuses anything new, so a demo works offline.
- **Two data stacks.** *Synthetic* uses invented data and runs instantly with no files; it exists for development and tests and is always labelled. *Live* uses the real data.

---

## 9. What the real results say

The frozen reference run `GR-001`: three sites at latitude −89.5° and longitudes 0°, 120°, 240°, one week from 2027-01-10, with requirements of Sun ≥ 60% and Earth ≥ 50% (scenario values, not mission rules).

| Site | Ground height | Sun (terrain) | Earth (terrain) | A flat horizon would have said |
| --- | --- | --- | --- | --- |
| 0° E | −722 m | **Fail**, 0% (best 5.8° below skyline) | **Pass**, 74.5% | Sun 100%, Earth 92% |
| 120° E | −1,714 m | **Fail**, 0% (best 22.7° below) | **Fail**, 0% (best 8.2° below) | Sun 100%, Earth 84% |
| 240° E | +938 m | **Fail**, 0% (best 2.5° below) | **Pass**, 65.0% | Sun 100%, Earth 85% |

What this tells you:

- **Terrain overturns the simple answer.** Three different Sun results flip from a comfortable pass to zero. This is the effect the challenge describes.
- **The 120° site is walled in:** a skyline of 11° to 31° means neither target ever clears it.
- **The 240° site is the closest call for the Sun** (2.5° below at best): it sits on higher ground, so its skyline is lower.
- **These are not "good sites".** They were chosen by a fixed rule so that nobody can say they were cherry-picked. They are a reference scenario, and the result says nothing about the better-lit places planners would actually study.

**The real five-day shift.** Shifting the start to 2027-01-15 changes the picture: Earth reaches **100%** at two sites (up from 74.5% and 65.0%), and the Sun at the 240° site goes from 0% to **51.2%** with two events (a rise about 76 hours in and a set about 162 hours in), which is still short of the 60% requirement. So *a five-day slip genuinely moves the answer*, which is what the Time Machine is for. This run carries a sensitivity flag at that site: at a finer azimuth step one 4.7-second sliver around the Sun's rise cannot be certified (it is shorter than the 5-second minimum interval), although the availability numbers are identical. It is documented in [`docs/runs/GR-001-plus5d.md`](runs/GR-001-plus5d.md).

**Why a "FAIL" is still a useful result.** The tool's job is to avoid false confidence. Finding out early that a site cannot see the Sun for a week is exactly the information a planner needs, and it is only credible because the same machinery would have said "pass" had the terrain allowed it (it does, for Earth at two sites).

---

## 10. How to use it, as a person and as a presenter

### The ten-minute tour

1. **Start the service and the web app** ([User Guide §2](USER-GUIDE.md#2-starting-it)). For real data without waiting, serve the saved package in replay mode (the commands are in [User Guide §9](USER-GUIDE.md#9-offline-replay-and-the-fallback-package)). If the banner says *Synthetic demonstration data*, you are on the invented data.
2. **Home:** press **Start the reference mission**. You land on the **run page**: a table of sites against Sun and Earth, terrain result beside the flat-horizon result.
3. **Click a site's Local sky.** Press Play. Watch the Sun and Earth tracks sweep over the hatched terrain skyline. Use **Next event** to jump to a rise or set; read the **countdown**.
4. **Open its Timeline.** See the bands, the outage bracket, and the plain-words explanation. Flip **Guided / Technical** in the header to see the same facts in the service's own wording.
5. **Compare** the sites on one page.
6. **Time Machine:** shift by 5 days and see what changes; try the dates search.
7. **Evidence:** read the three validation cards, the data fingerprints, the disc-size table, and download the evidence bundle.
8. **Why the south pole is hard** is the three-minute explainer for any audience.

### As a five-minute pitch (the spec's own outline)

| Time | Show | Say (in your own words) |
| --- | --- | --- |
| 0:00–0:35 | the explainer page | A few degrees of sky and the ground around you decide everything. |
| 0:35–1:05 | Home, reference mission | One reference week, three sites, requirements of 60% Sun and 50% Earth. |
| 1:05–2:05 | run page and Local sky | Flat horizon says 100%; real terrain says 0%. Watch why. |
| 2:05–3:05 | Time Machine | Slip the date five days: Earth improves; the Sun at one site goes from none to about half, still short. |
| 3:05–3:45 | Evidence | Every number traces to NASA data; geometry is double-checked; we tell you what is *not* validated. |
| 3:45–4:25 | dates search | Which start dates pass, with the trade-offs shown, not a hidden score. |
| 4:25–5:00 | limits and impact | A screening tool for planners and learners. It does not certify anything. |

### Questions you are likely to be asked, with honest answers

- **"How do you know the angles are right?"** They come from JPL Horizons and match NASA's independent SPICE toolkit to 0.0017 arcseconds. That check covers the directions only.
- **"How does terrain change the answer?"** Show the flat-versus-terrain columns and the skyline plot: 100% becomes 0%.
- **"Is this validated?"** No. The terrain model is not formally approved and the science decisions are unsigned. Everything is labelled *real data, unverified*. What we did do is check it every way we could and make the checks reproducible.
- **"Is sunlight percentage the same as power?"** No. It is geometric illumination. Power needs spacecraft models.
- **"Does Earth visible mean communication works?"** No. It is a line of sight, not a link budget.
- **"What if the data is missing?"** It stays *unknown* or *excluded*. It is never silently counted as visible or hidden.
- **"Can it choose a safe landing site?"** No. It screens lighting and direct-to-Earth opportunity only.
- **"Why these three sites?"** A fixed, symmetric rule chosen before looking at any result, so none could be cherry-picked. They are a reference scenario, not candidates.

---

## 11. What you can and cannot claim

**You can say** (all backed by the records):
- LunaScope compares terrain-aware sunlight and direct-to-Earth visibility for south-pole sites and dates, using NASA's JPL Horizons, LOLA elevation data and an independent SPICE check.
- On a frozen, reproducible reference run, terrain changes every Sun result from a flat-horizon pass to a fail.
- Results carry their data fingerprints, settings and limits, and unknown is never counted as an outage.
- A five-day date slip measurably changes the outcome.
- The demo works offline from a saved real-data package.

**You must not say:**
- that any result is *validated*, *verified*, *accurate*, *optimal* or *recommended*;
- that the three sites are candidate landing sites, or that LunaScope picks "the best site";
- that sunlight percentage is power, or that Earth visibility is a communications guarantee;
- that NASA endorses or approved it (a NASA logo must never be generated or altered);
- that it is deployed or publicly hosted (it is not);
- that the organizer permission for pre-event work is on file (it is not).

The authoritative list, with the status of every claim, is [`docs/submission/CLAIMS-AUDIT.md`](submission/CLAIMS-AUDIT.md).

---

## 12. How it was built, and where everything is

The work ran in phases, each with a gate:

| Phase | What it delivered | State |
| --- | --- | --- |
| **0. Decisions** | A record of the science decisions (which terrain release, which coordinate convention, tolerances, ...) with evidence for each. | Decided on evidence, **not signed off** (about 70%) |
| **1. Foundation** | The service, real data providers, the skyline and event engine, the run store, the first pages, and the first real run (RUN-001). | Essentially complete (about 95%) |
| **2. Core experience** | Every page, the Time Machine, the Evidence page and export, accessibility, and the frozen reference run GR-001 with its five checks. | all but a few items (about 98%); the independent skyline check is now built and reads met for GR-001 |
| **3. Extras and delivery** | Dates search, guided mode, explainer, sensitivity views, the share link, the offline package, container images and the submission drafts. | About 50%: deployment, the pitch materials and human sign-offs remain |

**Where things are**

| Folder or file | What is in it |
| --- | --- |
| `science/lunascope/` | the service: observer, skyline, events, metrics, run lifecycle |
| `science/scripts/` | command-line tools: reference runs, the offline package, studies |
| `science/tests/` | the service's tests |
| `app/`, `components/`, `lib/` | the web app |
| `tests/` | the web and browser tests |
| `data/manifests/`, `data/sites/`, `data/reference/` | data descriptions, the sample sites, the frozen reference definition |
| `docs/runs/` | the real-run records (RUN-001, GR-001, the five-day shift, the studies) |
| `docs/submission/` | the claims audit, licences, disclosures and pitch draft |
| `docs/sdr/` | the science decision record |
| `docs/USER-GUIDE.md` | the page-by-page manual |
| `docs/LunaScope-Phase-Plan.md` | the live status of everything |

**What is still genuinely open** (each is a human decision or a build step, not a bug): organizer permission for pre-event work (a real eligibility risk), the science owner's sign-off, a public deployment, rebuilding the offline package from the final commit and copying it to the pitch machine, and the slides or video. (The independent second skyline implementation has since been built: the terrain card reads "met" for GR-001, as a check of the computation, not of the DEM.)

---

*If you remember only three things: (1) at the south pole the **terrain**, not the Sun's height, decides whether you get sunlight or a line to Earth; (2) LunaScope shows that with real NASA data and **tells you what it does not know**; (3) it is a **screening and education tool**, honestly labelled as unvalidated.*
