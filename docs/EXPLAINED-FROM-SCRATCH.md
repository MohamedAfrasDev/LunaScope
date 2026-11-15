# LunaScope explained from scratch

**For someone who knows absolutely nothing.** Imagine you have just arrived in the world: you do not know what the Moon is, what an angle is, what a computer program is, or what a "dataset" means. This document starts there. Every new word is explained the first time it appears, in plain language, and every word is collected again in the [A to Z glossary](#16-the-a-to-z-glossary) at the end, so you can always look one up.

It then explains what LunaScope is, why it matters, how it works, every kind of situation it meets (with real results), how it was checked, how to present it, and the questions judges will ask. The companion [User Guide](USER-GUIDE.md) is the page-by-page manual; this document is the *why* and the *how it works*.

**Where the numbers come from.** Every figure quoted here comes from the project's own records, not from general knowledge: [GR-001-run.md](runs/GR-001-run.md), [GR-001-plus5d.md](runs/GR-001-plus5d.md), [GR-001-dates-search.md](runs/GR-001-dates-search.md), [GR-001-independent-skyline.md](runs/GR-001-independent-skyline.md), [GR-001-illumination-vs-map.md](runs/GR-001-illumination-vs-map.md) and [GR-002-GR-003-notable-places.md](runs/GR-002-GR-003-notable-places.md). The only exceptions are plain background facts about astronomy (for example, how big the Sun looks), which are marked as background.

**The live demo:** https://luna-scope.afras.dev (a replay of saved real-data runs; see [part 12](#12-how-it-is-built-and-where-it-runs)).

---

## How to read this document

- **If you want the whole story from nothing:** read [part 1](#1-the-ideas-from-zero) first. It needs no knowledge at all.
- **If you already know basic astronomy:** skip to [part 2](#2-the-product-in-one-page).
- **If you only need to present or answer questions:** go to [part 13](#13-how-to-present-it) and [part 14](#14-questions-judges-will-ask).
- **If a word confuses you:** every important word is in **bold** where it is first explained, and again in the [glossary](#16-the-a-to-z-glossary).

A small convention used throughout: a line that begins with **In plain words** is the same idea said as simply as possible; a line that begins with **For LunaScope** says why the idea matters to this product.

## Contents

1. [The ideas from zero](#1-the-ideas-from-zero)
2. [The product in one page](#2-the-product-in-one-page)
3. [Why it matters](#3-why-it-matters)
4. [The science, step by step](#4-the-science-step-by-step)
5. [The data: where every number comes from](#5-the-data-where-every-number-comes-from)
6. [One site from start to finish, with real numbers](#6-one-site-from-start-to-finish-with-real-numbers)
7. [A tour of the product](#7-a-tour-of-the-product)
8. [Every kind of situation, with real examples](#8-every-kind-of-situation-with-real-examples)
9. [What the real results say](#9-what-the-real-results-say)
10. [How we know it is right, and what is not proven](#10-how-we-know-it-is-right-and-what-is-not-proven)
11. [Honesty built into the design](#11-honesty-built-into-the-design)
12. [How it is built and where it runs](#12-how-it-is-built-and-where-it-runs)
13. [How to present it](#13-how-to-present-it)
14. [Questions judges will ask](#14-questions-judges-will-ask)
15. [What you can and cannot claim](#15-what-you-can-and-cannot-claim)
16. [The A to Z glossary](#16-the-a-to-z-glossary)
17. [Where everything is, and what is still open](#17-where-everything-is-and-what-is-still-open)

---

## 1. The ideas from zero

This part teaches, from nothing, the dozen ideas everything else is built on. Take your time here; the rest becomes easy.

### 1.1 The three characters: Sun, Earth, Moon

- The **Sun** is a star: a gigantic ball of hot glowing gas. It makes light and heat. Everything in our part of space orbits it.
- The **Earth** is the planet we live on. It travels around the Sun, and it also **spins** like a top, once every 24 hours. That spin is why we have day and night.
- The **Moon** is Earth's natural **satellite**, which means a smaller object that travels around a bigger one. The Moon travels around the Earth once about every 27 days, and the Earth-Moon pair travels around the Sun.

**In plain words:** the Sun is the lamp, the Earth is where we are, and the Moon is a rocky ball next door that we want to visit.

**Orbit** means the path one object takes around another, held in place by gravity (the pull that masses have on each other).

### 1.2 Light goes in straight lines, and shadows are what blocks it

Light travels in straight lines. If something solid is in the way, the light cannot get past it, and the space behind the solid thing is dark. That dark space is a **shadow**.

You know this already: stand behind a tree on a sunny day and you are in the tree's shadow. You cannot *see* the Sun from there, and the Sun cannot *see* you. The straight line between you and the Sun is blocked.

This is called **line of sight**: a straight, unblocked path between two things. If you can draw a straight line from your eye to an object without anything solid crossing it, you have line of sight to it.

**For LunaScope:** everything this product does is about line of sight. Is there an unblocked straight line from a place on the Moon to the Sun (so a solar panel gets light)? Is there one to the Earth (so a radio can talk to Earth directly)?

### 1.3 Angles and degrees: how we measure "which way" and "how high"

To describe a direction, we measure an **angle**: how far you must turn from one direction to another.

- A full turn all the way around is **360 degrees**, written 360°. A half turn is 180°. A quarter turn (a right angle, like the corner of a book) is 90°.
- A **degree** is therefore a tiny turn: one 360th of a full circle.
- For feeling the size: at arm's length, your **thumb covers about 2°**, your closed **fist about 10°**, and your **spread hand about 20°**. (Background fact.)
- The Sun and the full Moon both look about **half a degree** wide in the sky. Hold up a small pea at arm's length: it hides the whole Sun. (Background fact.)

Degrees can be divided further. One degree has 60 **arcminutes**, and one arcminute has 60 **arcseconds**. So one **arcsecond** is 1/3600 of a degree, extremely small: it is the angle a one-centimetre coin makes when seen from two kilometres away. (Background fact.)

**For LunaScope:** the whole product lives in small angles. The Sun near the Moon's pole is about one degree above the horizon, and the question "does a hill hide it?" is decided by comparing angles that differ by a degree or two.

### 1.4 The horizon, elevation, azimuth and the compass

Stand in an open field and look around. The line where the ground seems to meet the sky is the **horizon**. If the ground were perfectly flat and nothing stood on it, the horizon would be a perfectly level circle all around you.

To say exactly where something is in your sky, you need only **two** numbers:

1. **Azimuth** (say it AZ-ih-muth): *which compass direction.* Imagine a compass lying flat. North is 0°. As you turn clockwise, east is 90°, south is 180°, west is 270°, and back to north at 360° (which is the same as 0°). So an object at azimuth 135° is in the south-east.
2. **Elevation** (also called **altitude**): *how high above the level horizon.* 0° means exactly on the horizon. 90° means straight overhead. A **negative** elevation means below the horizon, hidden by the ground itself.

**In plain words:** azimuth is "which way do I turn my head," and elevation is "how far up do I tilt it." Two numbers, and you can point at anything in the sky.

The whole sky above you is like the inside of a big upside-down bowl called a **dome**. Every star, the Sun, the Moon and Earth-seen-from-the-Moon is a dot on that bowl, and (azimuth, elevation) is its address.

**For LunaScope:** the service computes the azimuth and elevation of the Sun and of the Earth for a site, every ten minutes. The web app draws them.

### 1.5 Latitude and longitude: addresses on a ball

A ball has no corners, so to give an address on it we use two angles again:

- **Latitude**: how far north or south of the **equator** (the imaginary line around the middle). The equator is 0°. The **north pole** is 90° north and the **south pole** is 90° south. We write southern latitudes as negative, so -89.5° is half a degree from the south pole.
- **Longitude**: how far east or west around the ball. We choose a starting line (the **prime meridian**, 0°) and count around to 360°. In this project we count **east-positive**: moving east increases the number.

A **pole** is one of the two points where the spin axis (the imaginary stick the ball spins on) comes out of the ball. The Moon has a north pole and a **south pole**. This product is about the **lunar south pole** and the region around it.

**In plain words:** latitude says "how close to the pole," and longitude says "which way around." Near the pole, latitude -89.5° means you are about 15 kilometres from the pole itself.

### 1.6 Tilt and seasons, and why the Moon's poles are strange

The Earth's spin axis is **tilted** about 23° compared with its path around the Sun. That tilt gives us **seasons** and makes the Sun climb high in summer and stay low in winter. Near our own poles the Sun can rise and set only once a year.

The **Moon's** spin axis is tilted by only about **1.5°**. (Background fact.) That is almost no tilt at all. The result is startling:

- Near a lunar pole the Sun **never climbs high**. It slides around the horizon in a big circle, staying within about a degree or two of level, taking about **29.5 days** to go all the way around. (One lunar "day-night cycle" is about 29.5 Earth days, because the Moon turns slowly.)
- Standing at the pole, you would see the Sun slowly circling just above or just below the horizon like a coin rolling around the rim of a plate.

In the reference week used by this project, at a spot half a degree from the pole, the Sun's centre never rose above about **1.3°**. Recall that your thumb at arm's length covers 2°.

**In plain words:** at the Moon's poles the Sun is always almost exactly on the horizon. It is *there*, but barely above the ground.

### 1.7 Why the Earth sits still in the Moon's sky, and "libration"

The Moon **spins once for each trip around the Earth**, which means it always shows the *same face* to us. (This is called being **tidally locked**; background fact.) A person standing on the near side of the Moon would see the Earth hanging in almost the same spot in the sky forever, neither rising nor setting.

It is not perfectly still. The Moon's orbit is slightly oval and its axis is slightly tilted, so from the Moon the Earth seems to **wobble** a few degrees (up to about 7°) over a month. This wobble is called **libration**.

Now put those together at the **south pole**: Earth hangs low near the horizon. Libration moves it up and down by a few degrees. So sometimes Earth is a little above the horizon, sometimes a little below. In the reference run, from the 0°E site, Earth's elevation swung between about **-0.75° and +6.90°** over a week, while its compass direction hardly changed.

**For LunaScope:** libration is why "can I see Earth from here?" has a timed answer (yes for some hours, no for others) instead of a single answer.

### 1.8 Hills, craters and the "skyline"

The Moon's surface is not flat. It has **mountains**, **ridges** (long narrow high lines), **massifs** (a big block of mountain), and **craters** (round bowls left by impacts; the middle of a crater is its **floor** and the raised edge is its **rim**).

From any spot, look all the way around. In every compass direction there is a highest thing in the way: a hill, a ridge, a crater wall. Draw the height of that highest thing for every direction and you get the **skyline**: the outline of the land against the sky, exactly like a city skyline against the evening sky.

- If the Sun is *higher* than the skyline in its direction, you can see the Sun. 
- If the Sun is *lower* than the skyline in its direction, the land is in the way, and you are in shadow.

**In plain words:** the skyline is the line above which you can see the sky and below which you see ground.

A worked picture with real numbers: a ridge that is 300 metres taller than you and 5 kilometres away looks about **3.3°** high (the Moon curves away slightly, which trims it from 3.4° to about 3.3°). The polar Sun is only about 1° high. So that ridge hides the Sun completely, even though the Sun is "above the horizon" by the astronomer's rule. (This is why we must compare against the *skyline*, not against zero.)

### 1.9 Shadows that never end: "permanently shadowed"

Because the Sun skims the horizon, the **floors of deep polar craters** are shadowed by their own tall rims **all the time**, for millions of years. Such a floor is **permanently shadowed**. It is extremely cold, and that cold can keep **water ice** frozen there. Ice is valuable: it can be melted to drink, split into air to breathe, or turned into rocket fuel.

In 2009 NASA deliberately crashed a probe called **LCROSS** into the crater **Cabeus** and detected water in the cloud that rose. (Background fact.)

On the other hand, some high places (rims and massifs) catch the Sun for a large part of the time. Those can be good places for **solar panels**.

### 1.10 What a mission needs: power and a way to talk

A spacecraft or a lander that sits on the Moon needs two basic things:

1. **Power.** The easiest source is a **solar panel**, a flat plate that turns sunlight into electricity. It only works while the Sun's light actually reaches it, which means the Sun must be above the skyline. If sunlight is lost for a long time the machine must survive on a **battery** (a store of electricity), and batteries are heavy and limited.
2. **Communication.** The lander must talk to people on Earth. The simplest way is a **direct-to-Earth** radio link: a radio beam aimed straight at Earth. Radio waves, like light, travel in straight lines, so the lander needs **line of sight to Earth**. If a hill is in the way, the link breaks, and the lander would need a **relay** (another spacecraft or station that passes the message along).

**For LunaScope:** "Sun above the skyline" stands in for power, and "Earth above the skyline" stands in for the direct-to-Earth link. (Real engineering needs more than that, as [section 4.12](#412-visible-is-not-the-same-as-useful) says.)

### 1.11 Why anyone needs a tool: planning is hard and changes

Choosing where and when to land is a huge task. Teams of scientists and engineers must agree. Real plans change: a rocket is delayed by days, or a different site is needed. When that happens, planners need to ask quickly: *"If we move the date, or move to another site, is the sunlight and the Earth link still good enough?"*

Existing NASA tools (such as **QuickMap** and **Moon Trek**, which are websites for looking at the Moon, and **Horizons**, which gives positions of bodies in the sky) are excellent but are built for experts and show the pieces separately. The challenge asks for a tool that puts it together *intuitively* so that planners, teachers and the public can compare quickly.

---

## 2. The product in one page

**The challenge** (NASA Space Apps 2026, *Lunar Landing Site Navigator*): build an intuitive tool that lets mission planners, educators and the public compare landing sites and dates near the Moon's south pole, by showing where the **Sun** and **Earth** are relative to the local horizon, so they can judge **power** and **communications**.

**LunaScope is that tool.** In plain words, here is what it does:

1. You choose one or more **places** on the Moon (or type your own coordinates) and a **stretch of time** (for example, one week).
2. For each place it works out when the Sun is above the local skyline and when Earth is, using real NASA data.
3. It reports, separately for the Sun and for Earth, **how much of the time** each is visible, **when each is lost and returns**, and **whether that meets a requirement you set** (for example "Sun at least 60% of the time").
4. It shows the result as numbers and plain sentences, as a moving picture of the sky (flat 2D and a 3D look-around), and as a timeline.
5. Beside every real-terrain result it shows what a **flat horizon** would have claimed, because the gap between the two is the whole point.

**In one sentence for a judge:** *At the lunar south pole the Sun and Earth sit only a few degrees above the horizon, so the terrain around a site, not the Sun's height, decides whether it gets power or a line to Earth; LunaScope computes that from real NASA data, checks it two independent ways, and says plainly what it does not know.*

### What exists, working today

| Part | What it is, in plain words |
| --- | --- |
| The **science service** (written in Python) | The "brain". A program that fetches where the Sun and Earth are, builds the terrain skyline from NASA elevation data, finds every moment each one clears the terrain (to the second), and decides pass, fail, indeterminate or excluded. |
| The **web app** (written with Next.js) | The "face". The pages you click through. It only *shows* what the science service decided; it never works out visibility itself. |
| **Real NASA data** | JPL Horizons (positions of the Sun and Earth), LOLA elevation (the terrain), NAIF SPICE (a second, independent way to compute the positions), the NASA Goddard LOLA illumination maps (a published answer to compare against), and the IAU's official place names. |
| **Sites you can pick** | 3 demonstration points, **12 named south-polar places** (grouped into two ready-made comparisons), and any **custom coordinates**. |
| **Evidence** | Fingerprints of the data, double-checks, a comparison with NASA's own maps, studies of how sensitive the results are, and a "frozen" reference run that reproduces exactly. |
| **Hosting** | A public **replay** demo (the web app on Vercel plus a free container service) and an **offline package**, so the demo survives a network failure. |

### An honest note up front

Nothing here is **validated**. (To "validate" means to prove, with evidence from outside, that the model matches the real Moon. See [part 10](#10-how-we-know-it-is-right-and-what-is-not-proven) for the difference from "verified".) The terrain data is not formally approved and the project's science decisions are unsigned, so every result carries the label **real data, unverified**. The sites in the reference runs are named features or rule-chosen points, **not landing recommendations**. LunaScope **screens** opportunities (it narrows many choices to a few worth studying); it does not **certify** safety, power or communications.

---
## 3. Why it matters

### 3.1 The stakes

The Moon's south pole is where much of the next decade of lunar exploration is aimed.

- NASA's **Artemis** programme (the effort to return people to the Moon) named candidate landing regions near the south pole; in October 2024 it listed nine.
- **CLPS** (Commercial Lunar Payload Services) is a NASA programme that pays private companies to deliver science instruments to the Moon. Other space agencies are also sending missions to the same region.
- The reasons are the three you met in part 1: **water ice** in permanently shadowed craters, a few **sunlit high places** good for solar power, and the challenge of keeping a **link to Earth** when Earth hangs so low in the sky.

### 3.2 Why it is hard

On Earth the Sun climbs and sets every day because our axis is tilted about 23°. The Moon's axis is tilted only about **1.5°**, so near a pole the Sun never climbs. In the real run at latitude -89.5° the Sun's centre never rose above about **1.3°**, and Earth sat between about **-1.5° and +6.9°** over the reference week.

### 3.3 Why the ground decides everything

When the Sun is only a degree or two up, almost *any* rise in the ground hides it. A ridge 300 m higher than you and 5 km away stands about **3.3°**, taller than the Sun ever gets here. The real skyline heights at the three reference sites have **medians of 4.4°, 17.4° and 5.3°**, reaching over 31° at one.

### 3.4 Why a "flat horizon" estimate fails

The easy method is "the Sun is visible whenever its elevation is above 0°". That treats the Moon as a **flat plain** with no hills. At the south pole it badly overestimates: in the reference run it said **100%** at all three sites where the terrain-aware answer was **0%**. A planner who trusted the simple number would choose sites on a false premise.

### 3.5 The other half of the problem: timing

A place is not just "good" or "bad". The Sun and Earth move, so each is visible for stretches and hidden for others. Missions care about **how long the longest outage lasts** (the longest stretch with no sunlight or no Earth link) and **what changes if the launch slips**. That is why LunaScope shows timelines, a **countdown** to the next sunset or **Earthset** (Earth dropping below the skyline), a **Time Machine** that shifts the start date, and a **dates search**.

### 3.6 Real-world examples this speaks to

| Real situation | How LunaScope helps |
| --- | --- |
| **Artemis III candidate regions** (NASA named nine near the south pole in October 2024) | Compare the named features nearest to each (Haworth, Mons Malapert, Mons Mouton, Nobile, de Gerlache, Slater) over the same week; see which get sunlight, which see Earth, which are walled in. |
| **Where to put a relay or ground station** | NASA's LOLA team describes the Malapert massif as having high illumination and exceptional Earth visibility. Our run shows Mons Malapert with Earth visible 100% of the week and the Sun for part of it, the kind of finding a planner screens for. |
| **A launch slips by days** | The Time Machine recomputes the same sites with only the start date moved. In our run a five-day slip took Earth at two sites from 74.5% and 65.0% to **100%**, and the Sun at one site from **0% to 51%**. |
| **Choosing dates for a short surface mission** | The dates search tests a range of start dates against your requirements and shows which pass, with the trade-offs visible and no hidden score. |
| **Teaching and outreach** | Guided mode, the "Why the south pole is hard" page and the 3D look-around let students see why a few degrees and a ridge decide everything. |

(LunaScope does **not** replace the detailed engineering that follows site screening; see [part 15](#15-what-you-can-and-cannot-claim).)

---

## 4. The science, step by step

Here is the whole method first, in six steps, as a story; then each step gets its own section.

> **The whole method in six steps.**
> 1. Say exactly where the observer stands on the Moon (a **site**).
> 2. Ask NASA where the Sun and Earth are, as seen from that spot, over the time window.
> 3. Build the **skyline**: the highest land in every compass direction, from NASA's laser-measured terrain map.
> 4. Subtract: at every moment, **clearance = the target's height in the sky minus the skyline's height in the same direction**. Positive means visible.
> 5. Find, to the second, every moment clearance crosses zero (every sunrise-like and sunset-like event), and prove that nothing was missed between.
> 6. Add up the visible time, compare it with the requirement, and report pass, fail, indeterminate or excluded.

### 4.1 Describing "where in the sky" (a reminder)

Recall from part 1: an object's address in your sky is its **azimuth** (compass direction, clockwise from north) and **elevation** (height above the level horizon). The **skyline** is the elevation of the highest land at each azimuth. All of LunaScope compares *one* thing with *another*: the target's elevation, against the skyline's elevation at the target's azimuth.

### 4.2 Conventions are not boring

A **convention** is an agreement about what a number *means*. Get one wrong and the answer is silently mirrored or shifted, yet looks plausible. LunaScope fixes these, converts anything you type into them, and keeps what you typed alongside:

- **Planetocentric latitude**: latitude measured from the *centre* of the Moon (as opposed to along the surface's local "up" line; on a ball these are the same, but the label avoids doubt).
- **East-positive longitude**: moving east makes the number bigger. (Some old maps count west as positive; we do not.)
- **A reference sphere of radius 1,737.4 km**: we treat the Moon as a perfect ball of this size. All heights are measured as "above or below this ball", which is called the **datum** (the zero level for heights).
- **The Moon's body-fixed frame, "MOON_ME"** (ME = **Mean Earth**): a set of directions that is glued to the Moon and turns with it, defined so that one axis points to the average position of Earth. A **frame** is simply a choice of "which way is up, north and east" for a calculation.

A missing convention is refused, not guessed. The tests deliberately try the wrong direction, sign and unit to prove each mistake is caught.

### 4.3 Where are the Sun and Earth? (ephemerides)

An **ephemeris** (plural *ephemerides*) is a table of where bodies in space are at any given moment, calculated from their orbits. It is *calculated*, not measured live. **JPL Horizons** is NASA's famous online ephemeris service. For a point on the Moon and a list of times, it returns the Sun's and Earth's azimuth and elevation.

Three details, each explained:

- **Apparent**: the direction you would actually see, not the "true" geometric one. Two small effects change it:
  - **Light-time**: light is fast but not instant. It takes about 1.3 seconds to cross from the Earth to the Moon, and about 8 minutes from the Sun. So you see a body where it *was* a moment ago.
  - **Stellar aberration**: because you are moving while the light arrives, the direction shifts very slightly (like rain seeming to slant when you run).
- **No refraction**: on Earth the air bends light, lifting the Sun a little at sunset. The Moon has essentially **no atmosphere**, so there is no bending. The horizon is purely the land and the curve of the ball.
- **Time scales**: **UTC** is the everyday world clock. Space calculations often use **ET** (ephemeris time), which does not skip. UTC adds **leap seconds** now and then to stay in step with Earth's slightly uneven spin. A future leap second cannot be known, so the tool assumes none and says so in a warning (`UTC_FUTURE_LEAP_SECOND_ASSUMPTION`). Likewise **Earth orientation parameters (EOP)**, the tiny measured irregularities of Earth's spin, are only *predicted* for future dates (warning `EOP_PREDICTED`); in tests the effect on our geometry was a few thousandths of an arcsecond, far below anything that matters.

Because this is calculation from orbit models, it works for **any date, including the future** (our reference window is in January 2027). A "real-time feed" would add nothing, which is why the product does not need one. The **Start from now** button simply sets the window's start to the current UTC hour.

### 4.4 Checking a second way (SPICE)

One source can be wrong in a way nobody sees. So LunaScope also computes the same directions with **NAIF SPICE**, NASA's separate toolkit for space geometry, which reads files called **kernels** (data files describing orbits, frames and time). The two results are compared at every sample.

The agreed **tolerance** (the largest disagreement we will accept) is **0.01 arcseconds**. The largest disagreement actually found was **0.0017 arcseconds**: smaller than the angle a coin makes from more than a thousand kilometres away. For comparison, the terrain's own uncertainty is a few tenths of a degree, about **a million times larger**. So the geometry is not the weak link. This check validates the *directions only*, never the terrain.

### 4.5 Filling in between the samples

Horizons answers every 10 minutes (a **sample**). The Sun and Earth move smoothly, so between samples the tool fits a smooth curve (a **cubic Hermite spline**: a curve that passes through the samples *and* matches their speeds) with a proven bound on how wrong it can be. It then checks that curve against a finer series of 1-minute samples over the first six hours. The largest error was about **1 × 10⁻⁸ degrees**, utterly negligible.

### 4.6 The terrain: from laser pulses to a skyline

**LOLA** is the **Lunar Orbiter Laser Altimeter**, an instrument on NASA's **Lunar Reconnaissance Orbiter (LRO)**, a spacecraft circling the Moon. An **altimeter** measures height: it fires a laser pulse at the ground, times how long the echo takes to return, and since light's speed is known, the distance (and so the ground's height) follows. After millions of pulses, scientists built a map of heights.

That height map is called a **DEM** (a **digital elevation model**): a grid of squares called **pixels**, each holding one height. LunaScope uses a DEM covering 80°S to the pole at **20 metres per pixel** (a grid of 30,400 by 30,400 pixels, about 608 km across). Heights are measured above or below the 1,737.4 km reference sphere. A 20 m pixel is about the length of two buses.

Because a map is flat and the Moon is round, the map uses a **polar stereographic projection**. In plain words: imagine a lamp at the *opposite* pole shining through the Moon onto a flat sheet touching the south pole; each spot is drawn where its shadow lands. It gives an accurate flat map around the pole (distances near the edge are stretched by under one percent), and the code undoes the stretching exactly.

To get the **skyline** at a site, the code looks outward in each of **3,600 compass directions** (every **0.1°**, called the **azimuth step**) up to **150 km** (the **radius**), taking about **7,500 steps** along each direction. At each step it asks: *from the observer's eye, how high above the local level does that spot of ground appear?* This is a 3D geometry calculation that automatically includes the **curvature** of the Moon: far ground drops away below the level line, because the ball bends away under it. The biggest answer along the direction is that direction's skyline elevation.

Two real details:

- The observer's eye is **2 metres above the ground** (like a mast on a lander). That changes the skyline slightly. The Moon is small, so even from 2 m the flat-ground horizon dips about **0.09°** below level.
- **Missing data stays missing.** If part of the map has no height (a **no-data** region), those directions are marked **unknown**, never treated as flat ground (which would silently invent a lower skyline).

A caution: a skyline sampled every 0.1° could miss a very thin ridge that falls *between* two directions. That is why the result is called "converged under the tested settings" (see part 10), never "all obstacles resolved".

### 4.7 The central quantity: clearance

> **clearance(t) = (target's elevation) − (skyline at the target's azimuth) − (margin)**

**t** means "at time t". **Positive** clearance: the target is above the land, so it is **visible**. **Negative**: the land is in the way, so it is **hidden**. The instants when clearance crosses zero are the **events** (like a sunrise or sunset, but for "clears or drops behind the terrain"). The **margin** is an optional safety allowance, normally zero.

### 4.8 Finding every crossing without missing any (certification)

You could check clearance every 10 minutes, but a brief dip *between* two checks would be invisible. So LunaScope does something stronger called **certification**. The idea, in plain words:

> If a car is 100 metres from a wall and can go at most 10 metres per second, it **cannot** hit the wall within 5 seconds, no matter how it steers.

Likewise the tool knows a **speed limit on how fast clearance can possibly change** (the Sun's and Earth's apparent speed in the sky, plus how steeply the skyline changes with direction). If clearance is bigger than that speed limit times the time to the interval's ends, the sign **cannot** flip in between, so that whole interval is **proven** entirely visible or entirely hidden. If not, it **splits the interval in half** and tries again. Where it finds a sign change, it narrows the crossing down to within **1 second** (the **root tolerance**: how precisely a crossing is pinned down; a "root" is a value where a function equals zero).

Some terms for what comes out:

- Time too close to zero to call is kept in a narrow **decision band** of **0.01°** (about a fiftieth of the Sun's width) and called **unresolved**.
- If an interval cannot be settled within a limit on effort (**evaluation cap**, 200 tries) or is narrower than the **minimum interval width** (**5 seconds**), it becomes **uncertified**: the tool says "I could not tell", never "nothing happened".
- Any stretch with no terrain data is **no data**.

Every moment of the window is therefore labelled with one of **five interval classes**:

| Letter | Name | Plain meaning |
| --- | --- | --- |
| **V** | visible | proven above the skyline |
| **H** | hidden | proven below the skyline |
| **U** | unresolved | inside the narrow decision band |
| **X** | uncertified | the search could not decide |
| **G** | no data | a gap in the terrain data |

### 4.9 From intervals to numbers and verdicts

The window has been cut into labelled stretches. Now the tool adds up **durations** (lengths of time, never counts of samples).

- **Availability** is the fraction of the window that is visible, **as a range**: a **lower bound** (only certified visible time) and an **upper bound** (also counting the unsure time). A hole in the data therefore *widens* the range; it never silently turns into sunlight or into an outage.
- The **longest known hidden stretch** is the biggest proven outage.

You set a **requirement**, for example "Sun at least 60% of the time". With a range, there are four honest **outcomes**:

| If… | Outcome | Plain meaning |
| --- | --- | --- |
| lower bound ≥ requirement | **Pass** | even the pessimistic number meets it |
| upper bound < requirement | **Fail** | even the optimistic number misses it |
| the range straddles the requirement | **Indeterminate** | the data cannot decide |
| data missing or not certified | **Excluded** | left out, not marked a failure |

A plain yes/no would hide the middle two cases, which are exactly where a mission decision is risky. A **site status** combines the two targets *without* merging them into one score: for example "Fail: Sun" means Earth passed and the Sun failed.

### 4.10 The Sun and Earth are discs, not dots

So far we treated the Sun and Earth as single points (their **centres**). In reality the Sun is about **0.5° wide** and Earth about **1.9° wide** as seen from the Moon. Near the skyline, part of a disc can show while its centre is hidden. LunaScope brackets this: the **upper limb** reading counts a target visible as soon as *any part* of the disc clears, and the **whole disc** reading counts it only when *all* of it clears. In the real run no outcome flipped, but Earth's availability moved by several percentage points, so the tool shows the spread.

### 4.11 What if the date slips? (Time Machine and dates search)

The Sun and Earth move against the same fixed terrain, so shifting the start date changes the answer. The **Time Machine** takes a finished run (the **baseline**), moves *only* the start date, recomputes, and shows both side by side. The **dates search** repeats that over a range of dates and shows a **tested-dates strip** (one chip per date, labelled passes, fails, unknown, or not yet run). Each run keeps its own clock unless you ask for one shared calendar, so two different dates are never compared as if they were the same.

### 4.12 Visible is not the same as useful

LunaScope measures **geometric visibility**: whether the Sun or Earth is above the terrain. That is necessary, but not sufficient.

- For **power** you also need the panel's direction, its efficiency, and battery sizing. A Sun one degree above the horizon gives very little energy even when "visible".
- For **communications** you also need antennas, transmitter power, data rate and ground-station availability. "Earth is visible" is not "the link works".

The tool says this on its pages. It is a **screen**, not an engineering design.

---

## 5. The data: where every number comes from

First, three words used everywhere:

- A **dataset** is a collection of recorded information (here, files of numbers).
- A **manifest** is a small "label on the box" file that says where a dataset came from, how big it is, what units and coordinates it uses, its terms of use, and its fingerprint.
- A **fingerprint** (technically a **SHA-256 hash**) is a long code, 64 characters of letters and digits, computed from a file's contents. Change even one tiny thing in the file and the code changes completely. If a file's fingerprint matches the one in its manifest, the file is exactly the one that was approved to be used. We say the file is **pinned**.

| What | Source | Role | How it is protected |
| --- | --- | --- | --- |
| Where the Sun and Earth are | **JPL Horizons** (NASA's Jet Propulsion Laboratory) | primary directions | every response is stored word for word with its fingerprint; no request is sent without a project contact (JPL asks automated users to identify themselves) |
| An independent check on those | **NAIF SPICE** kernels (NASA/JPL) | cross-check | kernels pinned by fingerprint and verified before loading |
| The terrain | **LOLA 20 m south-polar elevation model**, in two releases (NASA's PGDA "adjusted" 2023 version and the PDS release) | the skyline | files pinned; a missing or altered file blocks the run |
| A published answer to compare against | **NASA Goddard Lunar Polar Illumination maps** (Mazarico et al. 2011), Sun and Earth, 60 m per pixel | comparison only, **not** an input | file fingerprints recorded in the evidence |
| Names and centre points of places | **IAU Gazetteer of Planetary Nomenclature** (published by USGS), public domain | the 12 named places | the rows used and the source file's fingerprint are committed (`data/sites/iau_extract.json`) |
| Looking at terrain | LROC QuickMap and NASA Moon Trek | visual reference only | not a numerical input |

More word-by-word:

- **PGDA** is NASA Goddard's Planetary Geodynamics Data Archive; **PDS** is NASA's Planetary Data System, the official archive of planetary data. **IAU** is the International Astronomical Union, the body that officially names features on the Moon. **USGS** is the US Geological Survey, which publishes the IAU's name list.
- The **rule**: *no numerical input is used without a manifest.* And "present and matching its fingerprint" does **not** mean "scientifically approved"; the tool keeps those two ideas apart (the resource page says "integrity verified", never "approved").
- **Why two terrain releases?** They are two published versions of the same 20 m data. Running both shows how much the *choice of release* matters (a little, but at some places a lot). It does not say which is more correct.
- **Other agencies' data.** The organizers allow data from other agencies except Chinese. This build uses NASA and IAU/USGS data only.

---

## 6. One site from start to finish, with real numbers

The site `rule-89.5S-E0`: latitude -89.5°, longitude 0° east (about 15 km from the pole), the week starting 2027-01-10 at 00:00 UTC.

1. **Place the observer.** Convert to the standard convention. The ground there is **722 metres below** the reference sphere (a low spot). The observer's eye is 2 m above the ground.
2. **Get the sky.** Ask Horizons for the Sun's and Earth's azimuth and elevation **every 10 minutes for 7 days**, which is 1,009 samples each, and cross-check with SPICE. The Sun's elevation stays between **0.42° and 0.87°**, sweeping through about 85° of compass direction. Earth's elevation ranges from **-0.75° to +6.90°** while its direction hardly moves (352° to 357°).
3. **Build the skyline.** 3,600 directions out to 150 km. It runs from **-0.26° up to 9.59°**, with a **median** (the middle value) of **4.4°**, and every one of the 3,600 sectors is **certified**.
4. **Compare.** The Sun, at 0.4° to 0.9°, sits below a skyline that is mostly above 4° across its whole sweep. At best it is **5.8° below** the skyline. Result: **0% visible, Fail** against a 60% requirement. A flat horizon would have said **100%**.
5. **Earth is different.** It climbs to 6.9°, above the skyline in its direction. It is visible about **74.5%** of the week, with one set-or-rise event and a longest outage of about **1 day 18½ hours**. Against a 50% requirement: **Pass**.
6. **Quantify the doubt.** Re-run with half the azimuth step and with the other terrain release: Earth's availability moves by under 0.25 percentage points and the outcome never changes. Treating Earth as a disc moves it by several percentage points, outcome unchanged.
7. **Record everything.** The request, settings, data fingerprints, the Horizons responses' fingerprints, the skyline, every interval and event, the metrics and the caveats are written into one **bundle**, labelled *real data, unverified*.

The **site status** is **"Fail: Sun"**: Earth passes, the Sun fails, and the two are never merged into one score.

---
## 7. A tour of the product

First, the words used on the screens:

- A **web app** is a program you use in a web browser (Chrome, Safari, Edge) instead of installing it. A **page** is one screen of it. A **link** takes you to another page. A **button** does something when pressed. A **form** is a set of boxes to fill in.
- A **site** (in this product) is one place on the Moon you want to examine. A **run** (or **analysis**) is one complete calculation: a set of sites, a time window and some requirements, turned into results. A run has a long code as its name (for example `a06f944012c8…`) that comes from its inputs; the same inputs always give the same run.
- A **status chip** is a small coloured label with an icon *and* a word (for example "✗ Fail"). A colour is never the only signal, so people who cannot tell colours apart can still read it.

(The exact layout keeps being improved. The [User Guide](USER-GUIDE.md) always holds the current control-by-control description.)

| Page | What it is for | What you will see |
| --- | --- | --- |
| **Home** | Start here. | **Start the reference mission** (the saved reference run GR-001); two cards to **compare notable south-polar places** (the Artemis III features and the well-known craters); links to your own analysis and to the explainer. |
| **New analysis** | Set up your own comparison. | A start date and time (with a **Start from now** button), a duration (1 hour to 30 days) and a step; sites grouped as demonstration points, Artemis III features and well-known craters, each with a link to its official IAU entry; **custom coordinates** with a terrain-coverage check; requirements (the percentages the Sun and Earth must reach); a share link that fills in the form but never starts a run. |
| **Run page** | The answer: sites against Sun and Earth. | A table (cards on a phone) with the terrain-aware result beside the flat-horizon result; a one-line verdict; warnings; three evidence cards. |
| **Local sky** | See it. | Three views of the sky: **Polar** (from above, north at the top), **Unrolled** (azimuth laid along the bottom, like a panorama) and **3D (look around)**. Also a **time player** (play, jump to the previous or next event, set the speed) and a **countdown** to the next sunset or Earthset with a stated margin. |
| **The 3D view** | An intuitive picture of the real situation. | You stand at the site. The terrain skyline is a **wall** around you with a bright ridge line; the Sun (orange sphere) and Earth (blue diamond) move beyond it. Drag to look around, or switch to **From outside** to see the whole ring. **Face the Sun**, **Face the Earth** and **N E S W** buttons aim the view. **Exaggerate heights ×3** is optional and is stated on screen when on. A target hidden behind the wall is drawn faintly *through* it, so you can still see where it is. |
| **Timeline** | When each target is visible or lost. | Bands of colour and pattern along a time axis; the longest outage with its margin; a **Guided / Technical** switch (plain sentences, or the service's own wording). |
| **Compare** | Side by side. | Sites against each other in one table. |
| **Time Machine** | "What if the date slips?" | Shift the start (up to 30 days either way) and see the changes; the **dates search** and its tested-dates strip. |
| **Evidence** | Why believe it. | Three **validation cards** (geometry, terrain horizon, numerical convergence), the data fingerprints, the disc-size table, the sensitivity studies, and a download button for the full **evidence bundle**. |
| **Why the south pole is hard** | An explainer for anyone. | A three-minute schematic of a low site, a ridge and a flat horizon. |

Other things you will meet:

- A **data-status pill** at the top of every page says which kind of data you are looking at. On the public demo a **REPLAY MODE** badge also appears.
- A **validation card** reads **Met** (the check ran and passed), **Not met** (it ran and failed) or **Not evaluated** (it was not run). A card never says "validated".
- **Warnings** such as `EOP_PREDICTED`, `UNVERIFIED` or `DEM_COVERAGE_INCOMPLETE` are listed with a plain-language meaning.
- The **evidence bundle** is a single file holding everything needed to re-check a run: request, settings, data fingerprints, series, skyline, intervals, events, metrics and the validation snapshot. A "verified" bundle is refused until something is actually validated.

---

## 8. Every kind of situation, with real examples

These are the cases the tool meets. Each has a real result from the project's records (the reference week starting 2027-01-10; the Sun must reach at least 60%, Earth at least 50%; these are **scenario values**, not mission rules).

| # | The situation | What you see | What it means | Real example |
| --- | --- | --- | --- | --- |
| 1 | **A flat horizon says yes, the terrain says no** | Sun 100% (flat) against 0% (terrain). | The ground is hiding a target that simple geometry says is up. This is the core finding of the whole project. | All three reference sites; also Shackleton, Faustini, Shoemaker and Slater. |
| 2 | **A lit ridge or massif with a clear line to Earth** | Earth 100%, the Sun for part of the week. | The kind of place a planner would look at for power and communications. | **Mons Malapert**: Sun 26.5 to 27.0%, Earth 100%. **Mons Mouton**: Sun 14.6%, Earth 100%. |
| 3 | **A permanently shadowed crater floor** | Sun 0%, Earth 0% or low. | Cold and dark, which is where ice can survive. Poor for solar power, valuable for science. | **Shackleton** (skyline 19.8° to 23.6°): Sun 0%, Earth 0%. **Haworth**, **de Gerlache**, **Faustini**, **Cabeus** and **Sverdrup**: Sun 0%. |
| 4 | **A walled-in site** | Neither target ever clears the skyline. | Nothing reaches it this week. | The 120°E reference site: skyline 11° to 31°. |
| 5 | **Sun yes, Earth no (or the reverse)** | Requirements are judged separately: "Fail: Earth" or "Fail: Sun". | Power and communications are different questions and are never mixed into one score. | **Nobile**: Sun 100%, Earth 30.3 to 30.6% (fails the 50% need). The 0°E reference site: Earth passes, the Sun fails. |
| 6 | **A date slip changes the answer** | Time Machine changes. | Schedule slips are real engineering events. | A five-day slip: Earth at 0°E rises from 74.5% to 100%; the Sun at 240°E from 0% to 51.2%, still short of 60%. |
| 7 | **No date passes** | A dates strip full of "Fails". | An honest "no", instead of an invented best date. | Eight start dates (2027-01-10 to 01-17): none passes; the closest is the Sun at 240°E from 01-15 on (51.2%). |
| 8 | **The data cannot decide** | **Indeterminate** or **Excluded**, with a reason code. | Unknown is never counted as visible or hidden. | The event search could not certify an interval, so the Sun's outcome is Excluded (reason `UNCERTIFIED_EVENT_SEARCH`) at Mons Malapert and Mons Mouton. On 2027-01-17 at 0°E it was a 4.7-second sliver, shorter than the 5-second minimum interval. |
| 9 | **Part of the terrain is missing** | A coverage warning and fewer certified sectors. | The result becomes a wide range, not a guess. | **Amundsen**: only 3,099 of 3,600 sectors certified; Sun 33.3 to 88.2%, Excluded. |
| 10 | **The result depends on which terrain release** | A `SENSITIVITY_HIGH` flag and an "Evidence: Terrain horizon: Not met" card. | A real uncertainty is shown, not hidden. | Mons Malapert (the other release changes the Sun's lower bound by 8.8 percentage points), Mons Mouton and Slater. |
| 11 | **Is the Sun a point or a disc?** | The disc-size table (upper limb, centre, whole disc). | Edge cases near the skyline shift by several points. | Earth's availability moved several points at two reference sites; no outcome flipped. |
| 12 | **Your own coordinates** | A coverage check, then a computed run (on a machine with the terrain files). | Works anywhere from 80°S to the pole. Points north of 80°S are refused because there is no terrain data. | Custom points work on the local live stack; the public demo refuses them (it only replays saved runs). |
| 13 | **Your own requirements** | Change the Sun and Earth percentages in the form. | Outcomes follow your numbers, never a fixed rule. | Defaults are 60% Sun and 50% Earth. |
| 14 | **No network at the pitch** | The offline package opens in replay mode. | The demo survives a failed Wi-Fi. | The `fallback/` package and the public replay demo. |
| 15 | **A beginner or a student** | Guided mode, the explainer page, the 3D view. | The same facts in plain sentences. | The "Why the south pole is hard" page. |

### Playbooks: "I want to…"

- **…compare several places.** Open *New analysis*, tick up to six sites (named places, demonstration points, custom), choose the dates, and run. On the run page read the Sun and Earth columns separately.
- **…see what a delay does.** Open the run, press *Open the Time Machine*, choose a number of days (negative moves earlier), and read the "Changed" rows.
- **…find workable dates.** In the Time Machine, use *Which dates pass?* with a range; read the tested-dates strip; the page names a date only when one passes, and says "no passing date" otherwise.
- **…understand why a place failed.** Open *Timeline and evidence* for the site. The timeline shows when it is lost, the sky view shows by how many degrees, and the 3D view makes the wall obvious.
- **…check the claim.** Open *Evidence*: three validation cards, the fingerprints and a downloadable bundle.
- **…teach someone.** Switch to **Guided**, open "Why the south pole is hard", then the 3D view and press *Face the Earth* after *Next event*.

---

## 9. What the real results say

### GR-001: the frozen reference (three rule-chosen points at -89.5°)

A **reference run** is one carefully chosen standard calculation used for tests, screenshots and demos. **Frozen** means its definition is locked: if anything scientific changes, the tool refuses to run it and says to create a new version. The three sites were chosen by a **fixed symmetric rule** (the same latitude, equally spaced longitudes) **before any result was seen**, so none could be cherry-picked. They are a reference scenario, not candidates.

| Site | Ground height | Sun (terrain) | Earth (terrain) | A flat horizon would say |
| --- | --- | --- | --- | --- |
| 0°E | -722 m | **Fail**, 0% (best case 5.8° below the skyline) | **Pass**, 74.5% | Sun 100%, Earth 92% |
| 120°E | -1,714 m | **Fail**, 0% (22.7° below) | **Fail**, 0% (8.2° below) | Sun 100%, Earth 84% |
| 240°E | +938 m | **Fail**, 0% (2.5° below) | **Pass**, 65.0% | Sun 100%, Earth 85% |

(**Ground height** is relative to the reference sphere, so -722 m is a low spot and +938 m a high one. "Best case 5.8° below" means that at its very highest the Sun was still 5.8° lower than the skyline.) GR-001 was re-created from a clean copy of the code **with the network switched off** and reproduced the identical result.

### The five-day shift and the dates search

Shifting the start by five days gives Earth **100%** at 0°E and 240°E, and the Sun at 240°E **51.2%** with a rise about 76 hours in and a set about 162 hours in, still short of 60%. That run carries a sensitivity flag (documented in [GR-001-plus5d.md](runs/GR-001-plus5d.md)). Across eight start dates, **none passes**.

### GR-002 and GR-003: named places (draft references)

A **draft** reference is one that is not frozen and has not been through the convergence report. These two compare twelve named features from the IAU's official list.

| Place | Sun, terrain | Sun, flat horizon | Earth, terrain | Earth, flat horizon |
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

**Read these carefully.**
- The places are the IAU's official **centre points** of named features. A **crater centre is its floor, not its rim**, and most floors are permanently shadowed, so a dark result says nothing about the rim where a lander would actually sit.
- NASA's Artemis III regions are **15-kilometre areas** on or near these features, and we found no published coordinates for them. So each region uses its *nearest named feature*.
- The lit places are the massifs. That fits what NASA's LOLA team says of the Malapert region (high illumination, good Earth visibility), though ours is one week and theirs is a long-term average.

---

## 10. How we know it is right, and what is not proven

### First, two easily-confused words

- **Verification** asks: *"Did we compute what we meant to compute, correctly and consistently?"* (Like checking your arithmetic.)
- **Validation** asks: *"Is the model true to the real Moon?"* (Like checking your answer against the real world.) That needs **evidence from outside** the project and a **formal sign-off** by a responsible person.

LunaScope does a great deal of verification. It has **not** been validated, which is why every result says **unverified**.

### What we did to check it

| Check | What it means, in plain words | Result |
| --- | --- | --- |
| **Directions against NASA's SPICE** | Compute the Sun and Earth directions two different ways and compare. | Agree to 0.0017 arcsec (tolerance 0.01). |
| **A second, independently written skyline** | Compute the skyline again with a *different method* written separately: instead of walking out along 3,600 lines, look at *every map pixel* and work out where it appears. "Independent" means it shares no traversal, sampling, geometry or code with the first. | Agrees at all three reference sites inside gates declared in the code. Our *first attempt failed* because the check was designed too strictly; we fixed the design and kept the failure in the record. |
| **Comparison with NASA's published illumination maps** | NASA's maps give the average percentage of time the Sun (and Earth) is visible over about 18.6 years (a full cycle of the Moon's orbit wobble). We recomputed our own long-term fractions over the same length of time and compared. **Correlation** (a number from -1 to 1 that says how closely two lists of numbers rise and fall together; 1 is perfect) and **mean absolute difference** (the average size of the gaps) summarise the match. | Ten south-polar sites: correlation **0.974** (Sun) and **0.973** (Earth), mean difference **1.6** and **2.2** percentage points. Where NASA's map says Earth is never visible, so do we. |
| **A check that failed** | On the three reference sites, one gate we declared in advance (the *order* of the Sun's availability at two sites) was **not met**. | A pixel-by-pixel look showed we agree with the map at 7 of 9 pixels around that site; at two adjacent pixels the map is far lower than its own neighbours. Which is right is not established. |
| **Convergence** | Change one numerical setting at a time (finer time step, finer azimuth step, bigger or smaller radius) and check the answer does not move. If it does not, the numbers are not artefacts of those settings. | The reference results hold. |
| **Sensitivity** | Re-run with the *other* terrain release and a finer azimuth step to see whether the conclusion is fragile. | Holds at the reference sites; flagged `SENSITIVITY_HIGH` at Mons Malapert, Mons Mouton and Slater. |
| **Reproducibility** | A frozen run is re-created from a clean copy of the code with the network off. | Same ids, intervals, events and fingerprints. |
| **Tests** | An **automated test** is a small program that checks one fact about the software and fails loudly if it breaks. A **browser test** drives the real pages like a person would, with the keyboard only, and also checks **accessibility** (usability for people with disabilities). | Hundreds of tests (260 web unit tests, 14 browser tests, and the science suite). Many are "break it on purpose" tests: they confirm each safeguard fails when the thing it guards is broken. |

### What is not proven

- **Nothing is validated.** The terrain model is not formally approved, and the science decisions record (**SDR-001**, the Science Decision Record) is unsigned. Every result is labelled *real data, unverified*.
- **The comparisons are not independent of the terrain data.** NASA's maps and our skyline both come from LOLA topography, so agreement tests our *computation*, not the terrain model.
- **No direct lunar measurement** of illumination or Earth visibility at a site was used.
- **One week and a few sites.** The reference windows and sites are small. The named-place runs are draft references with no convergence report.

---

## 11. Honesty built into the design

1. **Unknown is not "not visible".** A hole in the data stays *unknown* and widens the availability range. It never silently counts as an outage, and never silently counts as sunlight.
2. **Claim only what was proved.** Certified intervals instead of sampled guesses; bounds instead of one number; four outcomes instead of two.
3. **A check must be able to fail.** Each safeguard was tested by deliberately breaking what it guards (a corrupted skyline, a wrong unit, a mirrored azimuth, a stale reply) and confirming it notices. A check that cannot fail proves nothing.
4. **Labels everywhere.** `synthetic_demonstration` (invented test data), `real_data_unverified` (real data, not validated) and `validated` are three separate labels, and nothing is `validated`. The public demo says **REPLAY MODE**.
5. **Display only.** The web app draws what the service decided. In the 3D view an unknown skyline sector is left *open*, not drawn as flat ground, and enlarged markers and exaggerated heights are stated on screen.
6. **Reproducible by fingerprint.** A run's id is a fingerprint of its inputs, data fingerprints and algorithm version. A finished result is stored under the fingerprint of its own content and re-checked every time it is read, so it cannot be silently changed.

---
## 12. How it is built and where it runs

### The words first

- A **program** is a list of instructions a computer follows. **Code** is the text of those instructions. **Software** is programs and the data they use.
- A **browser** is the program you use to look at web pages. A **server** is a computer, usually far away, that answers requests. When you open a web page, your browser **asks** a server for it. The asking is a **request** and the answer is a **response**.
- An **API** (application programming interface) is a menu of requests one program is willing to answer from another. "Give me the results for run X" is one such request.
- A **database** is an organised store of information. LunaScope uses **SQLite**, a small database kept in one file, plus ordinary files named by their own fingerprint.
- A **process** is one running copy of a program. A **timeout** is a time limit after which a process is stopped.
- A **container** (as made by **Docker**) is a sealed, portable box holding a program and everything it needs, so it runs the same anywhere. A **host** is a company's computers that run your containers or web pages for you.

### The shape of the system

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

- **The browser never decides anything.** Whether a target is visible is computed once, in the science service, and the page only draws it. That avoids two programs disagreeing and keeps the logic testable in one place.
- **The web app's server layer** (called a **backend for frontend**, BFF) hides the service's address and a secret **token** (a password-like key) from the browser, and forwards only a short, fixed list of allowed requests.
- **The science service** is written in **Python** (a popular programming language for science) using a framework called **FastAPI**. **Next.js** is a framework for building web apps; **React** draws the screens; **TypeScript** is a stricter flavour of JavaScript; **three.js** is a library for 3D graphics in the browser, using **WebGL** (the browser's built-in 3D drawing ability). three.js is loaded only when you open the 3D view.
- **Each analysis runs as its own process**, so one that takes too long can be stopped. At most two run at once and eight can wait in a queue; a crashed run is retried once. Live results are saved so that asking again returns the same answer instantly.

### Where it runs

| Place | What runs there | What you can do |
| --- | --- | --- |
| **The public demo** | The web app on **Vercel** (a web host) and the science service on a free **container host** in **replay mode** | Browse the saved real-data runs (the reference run, its five-day shift, the dates search, and the two named-places comparisons). Anything not saved is refused with a plain "offline copy" message. Free instances **sleep** when idle, so the first request can take up to a minute: open it early. |
| **A machine with the data (live)** | The full system with the terrain and SPICE files (about 2.7 GB) | Enter your own coordinates and dates and compute them, in minutes. This is what you would demonstrate live. |
| **The offline package** | A saved copy of the real-data runs | The demo works with no internet at all. |

**Replay mode** means the service only *replays* results it already holds and refuses to compute anything new. It needs no terrain files, no SPICE kernels and no network, which is why it fits a free tier.

### How it is tested

Automated unit tests, browser tests (keyboard-only use, accessibility, phone-width layout, the 3D view) and a **smoke test** (a quick end-to-end check that the main things work), run signed out against the public link.

---

## 13. How to present it

The judging guide (NASA Space Apps Colombo 2026) gives **5 minutes of demo and 5 minutes of questions**, says complex presentations are not needed, and scores five **criteria** out of 10 each: **Impact, Creativity, Validity, Relevance, Presentation**. The demo link on the project page must be **at most 7 slides or a 30-second subtitled video**, publicly accessible, with no voices or pictures of anyone under 18, and it needs an AI/software disclosure.

**What each criterion means, in plain words**

| Criterion | The judges are asking | Where LunaScope scores |
| --- | --- | --- |
| **Impact** | Does it tackle a big problem, and does it help many people? | Choosing south-pole sites and dates is a real, current planning problem; it serves planners, teachers and the public. |
| **Creativity** | Is it original or a clear improvement on what exists? | Terrain-aware visibility with *certified* event times; a Time Machine; a 3D first-person sky. |
| **Validity** | Is it based on sound science, does it work, and is it usable? | Independent checks, honest labels, a working public demo and accessible pages. |
| **Relevance** | Does it answer the challenge directly, with NASA data at its core? | Every objective is covered, and LOLA, Horizons and SPICE are the core of the method. |
| **Presentation** | Was the story clear and well delivered? | A simple story and a smooth demo (below). |

**A suggested five minutes** (live, from a laptop with the full local stack; the public link as backup)

| Time | Show | Say | Scores on |
| --- | --- | --- | --- |
| 0:00 to 0:40 | the explainer page or a slide | A few degrees of sky and the ground around you decide whether a site gets power or a line to Earth. | Impact |
| 0:40 to 1:30 | Home, **reference mission**, the run page | A flat horizon says the Sun is up 100% of the week; the real terrain says 0%. | Creativity, Relevance |
| 1:30 to 2:30 | **Local sky 3D**: press Next event, then **Face the Earth** | Earth sits on the ridge line at its predicted rise; "hidden" is literally a wall in front of it. | Presentation, Creativity |
| 2:30 to 3:15 | **Named places**: Mons Malapert against Shackleton | The massif gets Earth all week and some Sun; the crater floor stays dark. | Impact, Relevance |
| 3:15 to 3:50 | **Time Machine**: shift five days | A slip changes the answer: Earth reaches 100%, the Sun at one site goes from none to about half. | Impact |
| 3:50 to 4:30 | **Evidence** and the NASA-map comparison | Directions match NASA's SPICE; our long-term numbers track NASA's published maps (correlation 0.97); here is the one check that failed. | Validity, Relevance |
| 4:30 to 5:00 | limits and close | A screening and education tool; unverified; not a landing recommendation. | Validity, Presentation |

If time allows, enter **one custom coordinate live** to show that it computes, and say that the public demo is replay-only.

---

## 14. Questions judges will ask

Each answer is written so that you can say it out loud. Words judges may not know are explained in brackets.

### Impact
- **Who is this for, and why does it matter?** Mission planners screening sites and dates, and educators and the public. Sites and schedules near the south pole are being chosen now, and early screening needs fast, comparable answers.
- **How is it different from QuickMap, Moon Trek or Horizons?** Those are excellent but separate and aimed at experts. LunaScope joins terrain, geometry and time into one answer, shows flat-versus-terrain side by side, and states what it is unsure of.
- **Does it help non-experts?** Yes: a Guided mode with plain sentences, an explainer page, a 3D view and a glossary.
- **What about Sri Lanka?** The same screening idea teaches students how terrain and orbits shape exploration. There is no site-specific Sri Lankan content.

### Creativity
- **What is new here?** Terrain-aware visibility with **certified** event times (no missed crossings, with bounds and an explicit "unknown"), a Time Machine and dates search, and a 3D first-person sky with the skyline as a wall.
- **Why a 3D view?** It makes the central idea (a ridge hides the Sun) physical. The 2D plots give precision; the 3D view gives intuition.

### Validity
- **Is this a real result?** It uses real NASA data and is labelled *unverified*. No validation gate has closed. ("Validation" means proving the model matches the real Moon, using outside evidence and a formal sign-off.)
- **How do you know the angles are right?** JPL Horizons, cross-checked against NASA's SPICE to 0.0017 arcseconds. That covers the directions only.
- **How do you know the skyline is right?** A second, independently written computation agrees at the three reference sites, and our long-term fractions correlate at 0.97 with NASA's published illumination maps over ten sites. Both read related LOLA data, so this checks the computation, not the terrain model itself.
- **Did anything not agree?** Yes: one check we declared in advance on the three reference sites failed (the order of two sites in the Sun result), traced to an outlier pixel in the map. We report it rather than hide it, and sensitivity to the terrain release is flagged at three named places.
- **What does "correlation 0.97" mean?** Imagine two lists of numbers, ours and NASA's. A correlation of 1 means they rise and fall together perfectly; 0 means no relationship. 0.97 is very close.
- **Is the sunlit percentage the same as power?** No. It is geometric illumination. Power needs panel and battery models.
- **Does "Earth visible" mean communications work?** No. It is a line of sight, not a link budget (the full calculation of whether a radio link has enough strength).
- **What if the data is missing?** It stays *unknown* or *excluded*, and the range widens. It is never counted as hidden or visible.
- **Does it account for libration, no atmosphere and curvature?** Libration is in the Earth directions from Horizons and SPICE; there is no refraction on the airless Moon; the skyline includes the Moon's curvature.
- **Why not use real-time data?** The Sun's and Earth's positions are calculated from orbit models for any date, and the terrain does not change. Real-time would add nothing. "Start from now" simply begins a window at the current hour.
- **What is the precision of event times?** Crossings are pinned to within 1 second of the model, and the countdown states that bracket. (The model itself is unverified.)
- **What are the numerical limits?** 3,600 compass directions (0.1° apart), a 150 km radius, a 10-minute step, a 20 m terrain map, a 2 m observer height, at most 6 sites per run, and windows from 1 hour to 30 days.

### Relevance
- **Which NASA data do you use?** LOLA terrain, JPL Horizons, NAIF SPICE, and NASA's published illumination maps for comparison, plus IAU/USGS names for the places. NASA data is the core of the method, not decoration.
- **Did you cover the challenge's objectives?** Site selection and comparison (named places and custom coordinates), date flexibility, Sun and Earth positions with a countdown, the key metrics, 2D and 3D visualizations, animations and timelines, and accessibility across skill levels.
- **Why not Apollo or other landing sites?** Our terrain data covers 80°S to the pole, and most famous landings lie outside it. We say so rather than fake it.
- **Do you handle steep slopes and deep craters?** Yes: the skyline comes from the real 20 m terrain, which includes steep crater walls; deep craters show up as skylines of 20° or more (Shackleton: 19.8° to 23.6°).

### Presentation and the product
- **Can I try my own site and dates?** On the public link the demo replays saved runs, so new inputs are refused with a plain message. On a machine with the terrain files it computes them, and we show that live.
- **Why are those named places "Fail"?** A crater centre is its floor, usually permanently shadowed. A rim would behave differently. These are named features, not landing recommendations.
- **What if the network fails?** The offline package opens the saved runs with no network.
- **Can it choose a safe landing site?** No. It screens lighting and direct-to-Earth opportunity only.
- **How accessible is it?** It can be used by keyboard alone, checked automatically for accessibility, laid out for phones, and it has a plain-language Guided mode. A manual screen-reader pass has not been done.
- **How long does a live run take?** Minutes: a six-site run with its sensitivity checks took about six minutes on the development machine.

### Process and disclosure
- **Who built this, and was AI used?** The project was built with **Claude Code**, an AI coding assistant, at the team's direction. It wrote most of the code, tests and documentation. It did not choose any site, validate any result or generate any NASA logo. The full commit history is public (the repository is public on GitHub) and the disclosure file lists this.
- **Was this started before the event?** The specification and a first implementation were prepared on 13 November and are disclosed with the full commit history; the product was extended during the event. We have not obtained written organizer permission for the earlier work, and we say so.
- **What would you do next?** Get the science decisions reviewed and signed; compare against more independent references; add rim points and more sourced sites; offer live computing online (needs a larger server); add a licence for the code.

---

## 15. What you can and cannot claim

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
- that organizer permission for the earlier work is on file (it is not).

The authoritative list, with each claim's status, is [`docs/submission/CLAIMS-AUDIT.md`](submission/CLAIMS-AUDIT.md).

---
## 16. The A to Z glossary

Every important word in this document, in alphabetical order, in plain language. Where a word is also a project label (like `PASS`), the label is shown in code style.

### A

- **Aberration (stellar aberration)**: a tiny shift in a body's apparent direction caused by your own motion while its light arrives, like rain seeming to slant when you run.
- **Altimeter**: an instrument that measures height, here by timing a laser pulse's echo from the ground.
- **Altitude**: another word for **elevation**: height of something above the level horizon, as an angle.
- **Analysis**: one complete calculation in LunaScope (see **run**).
- **API**: a menu of requests that one program will answer from another program.
- **Apparent (direction)**: the direction you would actually see, including light-time and aberration, as opposed to the "true" geometric direction.
- **Arcminute**: one sixtieth of a degree.
- **Arcsecond**: one sixtieth of an arcminute, so 1/3600 of a degree. A one-centimetre coin seen from two kilometres away spans about one arcsecond.
- **Artemis**: NASA's programme to return people to the Moon. Artemis III is the planned crewed landing near the south pole.
- **Availability**: the fraction of the time window during which a target is visible above the skyline. LunaScope gives it as a **range** (lower bound to upper bound).
- **Azimuth**: the compass direction of something, 0° at north, 90° east, 180° south, 270° west, measured clockwise.
- **Azimuth step**: the gap between the compass directions used to build the skyline. LunaScope uses 0.1°, so 3,600 directions.

### B

- **Backend for frontend (BFF)**: the part of the web app that sits between your browser and the science service, hiding the service's address and secret token and forwarding only allowed requests.
- **Baseline**: the original run that the Time Machine shifts from.
- **Battery**: a store of electricity a lander uses when the Sun is not available.
- **Bound (lower and upper)**: the two ends of a range. The **lower bound** of availability counts only proven visible time; the **upper bound** also counts unsure time.
- **Browser**: the program (Chrome, Safari, Edge…) you use to view web pages.
- **Bundle (evidence bundle)**: one downloadable file holding everything needed to re-check a run.

### C

- **Cabeus**: a large crater near the south pole that NASA's LCROSS probe struck in 2009; water was detected in the cloud.
- **Card (validation card)**: a small panel on the Evidence page showing one check and whether it was **Met**, **Not met** or **Not evaluated**.
- **Centre point**: the official middle coordinate of a named feature, from the IAU. A crater's centre point is on its floor.
- **Certified / certification**: *proved*. A certified interval has been shown, by a mathematical argument, to be entirely visible or entirely hidden. The opposite is **uncertified**.
- **Checksum**: see **fingerprint**.
- **Clearance**: the target's elevation minus the skyline's elevation (minus a margin) at the same compass direction. Positive means visible, negative means hidden.
- **CLPS**: Commercial Lunar Payload Services, a NASA programme that buys deliveries of instruments to the Moon from private companies.
- **Code**: the written instructions of a program.
- **Container (Docker)**: a sealed, portable box holding a program and everything it needs.
- **Convention**: an agreement about what a number means (for example, that longitude counts east as positive).
- **Convergence**: whether the answer stops changing when you make a numerical setting finer. If it stops changing, the setting was fine.
- **Coordinates**: numbers (latitude and longitude) that say where a place is.
- **Correlation**: a number from -1 to 1 that says how closely two lists of numbers rise and fall together. 1 is a perfect match.
- **Countdown**: the time left until the next predicted sunset or Earthset (or rise), with a stated margin of error.
- **Coverage**: how much of a site's surrounding area is inside the terrain data. Partial coverage gives a warning and fewer certified directions.
- **Crater**: a round bowl in the ground left by an impact. Its middle is the **floor** and its raised edge is the **rim**.
- **Curvature**: the way a ball's surface bends away. On the Moon, far ground drops below the level line, which lowers distant skylines.
- **Custom site**: a place whose coordinates you type in yourself.

### D

- **Dataset**: a collection of recorded information, usually files of numbers.
- **Dates search**: the tool that tests a range of start dates and shows which pass.
- **Datum**: the zero level for heights. Here, a ball of radius 1,737.4 km.
- **Decision band**: a narrow band (0.01°) around zero clearance in which the tool refuses to call the target visible or hidden, calling it **unresolved** instead.
- **Degree (°)**: one 360th of a full turn.
- **DEM (digital elevation model)**: a grid of squares (pixels), each holding one height. LunaScope uses NASA's LOLA DEM at 20 m per pixel.
- **Direct-to-Earth**: a radio link straight between a lander and Earth, needing line of sight.
- **Disc**: the Sun and Earth are discs of light, not dots. Their edges matter near the skyline.
- **Dome**: the imaginary upside-down bowl of the sky above you, on which every direction is a point.
- **Draft (reference)**: a reference run whose definition is not frozen and which has not been through the full convergence report (GR-002 and GR-003).

### E

- **Earthset**: Earth dropping below the skyline, the Earth equivalent of a sunset.
- **East-positive**: counting longitude so that going east increases the number.
- **Elevation**: how high something is above the level horizon, as an angle. 0° is on the horizon, 90° is overhead, negative is below.
- **Ephemeris**: a table of where bodies in space are at any moment, calculated from their orbits.
- **EOP (Earth orientation parameters)**: tiny measured irregularities in Earth's spin. For future dates they can only be predicted (warning `EOP_PREDICTED`).
- **Equator**: the imaginary line around the middle of a ball, at latitude 0°.
- **ET (ephemeris time)**: a steady time scale used in space calculations, without leap seconds.
- **Evaluation cap**: a limit (200) on how many tries the event search makes on one interval before giving up and calling it uncertified.
- **Event**: a moment when clearance crosses zero: a target clears or drops behind the skyline.
- **Evidence bundle**: see **bundle**.
- **Excluded (`EXCLUDED`)**: an outcome meaning the data could not support a verdict (for example, uncertified intervals), so the target is left out rather than marked as a failure.
- **Exaggeration (height exaggeration)**: an optional ×3 multiplier on elevation angles in the 3D view, for legibility. It is stated on screen whenever on.

### F

- **FastAPI**: the Python framework used to build the science service's API.
- **Fingerprint (SHA-256 hash)**: a 64-character code computed from a file's contents. Change anything and the code changes completely. It proves a file is exactly the intended one.
- **Flat horizon**: the (wrong, at the pole) assumption that the ground is perfectly level, so a target is visible whenever its elevation is above 0°. LunaScope shows this only as a comparison.
- **Floor (of a crater)**: the bottom of the bowl. Polar crater floors are often permanently shadowed.
- **Frame (reference frame)**: a choice of which way is up, north and east for a calculation. The Moon's is **MOON_ME**.
- **Frozen**: a reference whose definition is locked. If anything scientific changes, the tool refuses to run it and says to create a new version.

### G

- **GR-001**: the frozen reference run: three rule-chosen sites at -89.5° latitude, a week from 2027-01-10.
- **GR-002 and GR-003**: draft references comparing twelve IAU-named south-polar places (the Artemis III features and the well-known craters).
- **Guided mode**: plain-language sentences instead of the service's technical wording (the opposite is **Technical**).

### H

- **Hash**: see **fingerprint**.
- **Hidden (class `H`)**: proven below the skyline.
- **Horizon**: where the ground seems to meet the sky. A perfectly flat, empty plain would have a level horizon; real land has a bumpy **skyline**.
- **Horizons (JPL Horizons)**: NASA's online ephemeris service, the source of the Sun's and Earth's directions.
- **Host**: a company whose computers run your web pages or containers for you.

### I

- **IAU (International Astronomical Union)**: the body that officially names features on the Moon.
- **Independent (check)**: a second computation that shares no method, sampling, geometry or code with the first, so a shared mistake is unlikely.
- **Indeterminate (`INDETERMINATE`)**: an outcome meaning the range straddles the requirement, so the data cannot decide.
- **Interpolation**: filling in values between known samples with a smooth curve.
- **Interval classes**: the five labels given to every stretch of time: `V` visible, `H` hidden, `U` unresolved, `X` uncertified, `G` no data.

### J

- **JPL**: NASA's Jet Propulsion Laboratory, which runs Horizons and SPICE.

### K

- **Kernel**: a data file used by SPICE describing orbits, frames or time.

### L

- **Latitude**: how far north or south of the equator, in degrees. The south pole is -90°.
- **LCROSS**: a NASA probe that struck the crater Cabeus in 2009 and detected water in the plume.
- **Leap second**: a second sometimes added to UTC to keep it in step with Earth's spin. Future ones are unknown, so the tool assumes none.
- **Libration**: the Moon's slow apparent wobble, which makes Earth appear to drift a few degrees (up to about 7°) in the Moon's sky.
- **Light-time**: the time light takes to travel (about 1.3 seconds from Earth to the Moon). A body is seen where it *was*.
- **Line of sight**: a straight path between two things with nothing solid in the way.
- **Live mode**: the service computing new analyses (needs the terrain and SPICE files). The opposite is **replay mode**.
- **LOLA**: the Lunar Orbiter Laser Altimeter on NASA's LRO spacecraft, which measured the Moon's heights.
- **Longitude**: how far east or west around a ball. LunaScope counts east as positive.
- **LRO**: the Lunar Reconnaissance Orbiter, a NASA spacecraft circling the Moon.
- **Lower bound**: see **bound**.

### M

- **Manifest**: a "label on the box" file for a dataset: origin, size, units, terms and fingerprint.
- **Margin**: an optional safety allowance subtracted in the clearance calculation. Normally zero.
- **Massif**: a big block of mountain, for example Mons Malapert.
- **Mast**: the assumed height of the observer's eye above the ground, 2 m.
- **Mean Earth (ME)**: a body-fixed frame whose axis points to Earth's average position (MOON_ME).
- **Median**: the middle value of a list.
- **Minimum interval width**: the shortest stretch (5 seconds) the tool will certify. Shorter slivers become uncertified.
- **Mons**: Latin for "mountain" (for example, Mons Mouton).

### N

- **NAIF**: NASA's Navigation and Ancillary Information Facility, the home of SPICE.
- **Next.js**: the framework used to build the web app.
- **No data (class `G`)**: a gap in the terrain data.
- **Nutation cycle (18.6-year cycle)**: the slow cycle of the Moon's orbit wobble, about 18.6 years long. NASA's illumination maps average over a full cycle.

### O

- **Observer**: the imagined person (or lander mast) standing at the site whose view is being computed.
- **Orbit**: the path of one object around another, held by gravity.
- **Outage**: a stretch of time with no sunlight (or no Earth link).
- **Outcome**: the verdict on a requirement: `PASS`, `FAIL`, `INDETERMINATE` or `EXCLUDED`.

### P

- **PDS**: NASA's Planetary Data System, the official archive of planetary data.
- **PGDA**: NASA Goddard's Planetary Geodynamics Data Archive.
- **Pinned**: a file whose fingerprint is recorded so that any change is detected.
- **Pixel**: one square of a map or grid. In the DEM each pixel is 20 m by 20 m and holds one height.
- **Planetocentric**: latitude measured from the centre of the body.
- **Polar stereographic projection**: a way of drawing a round surface around a pole on a flat map, as if a lamp at the opposite pole projected it onto a sheet.
- **Pole**: either end of the spin axis. This product is about the lunar south pole.
- **Process**: one running copy of a program.
- **Provenance**: the recorded history of where a result came from.

### Q

- **QuickMap**: a NASA web tool for looking at the Moon (used by LunaScope only as a visual reference).

### R

- **Radius**: how far out the skyline is computed (150 km). Also the size of a ball (the Moon's reference sphere is 1,737.4 km).
- **React**: the library that draws the web app's screens.
- **Reference run**: one carefully chosen standard calculation used for tests, demos and evidence.
- **Reference sphere**: the perfect ball (radius 1,737.4 km) against which heights are measured.
- **Refraction**: the bending of light by an atmosphere. The Moon has none.
- **Relay**: a spacecraft or station that passes a message along when there is no direct line of sight.
- **Replay mode**: the service only replays results it already holds and refuses anything new. The public demo runs this way.
- **Request / response**: asking a server for something, and its answer.
- **Requirement**: a percentage you set, such as "Sun at least 60% of the time".
- **Ridge**: a long, narrow high line of ground.
- **Rim**: the raised edge of a crater.
- **Root tolerance**: how precisely a crossing is pinned down (1 second).
- **Run**: one complete calculation, named by a fingerprint of its inputs.

### S

- **Sample**: one calculated value at one moment (for example, the Sun's direction at 10:20 UTC).
- **Screening**: narrowing many choices to a few worth studying. LunaScope screens; it does not certify.
- **SDR-001**: the Science Decision Record, the document listing the science decisions (terrain product, frames, tolerances…). It is unsigned.
- **SHA-256**: the method used to make fingerprints.
- **Site**: one place on the Moon being examined.
- **Site status**: the combined verdict for a site, for example "Fail: Sun" (Earth passed, the Sun failed).
- **Skyline**: the outline of the land against the sky: the height of the highest ground in every compass direction.
- **Smoke test**: a quick end-to-end check that the main things work.
- **SPICE**: NASA's toolkit for space geometry, used as an independent check.
- **SQLite**: a small database kept in a single file.
- **Synthetic data**: invented test data, always labelled `synthetic_demonstration`.

### T

- **Technical mode**: the service's own wording (the opposite of **Guided**).
- **Terrain**: the shape of the ground: hills, ridges, craters.
- **Terrain-aware**: using the real terrain, as opposed to a flat horizon.
- **three.js**: the library used for the 3D view; **WebGL** is the browser feature it uses.
- **Tidally locked**: spinning exactly once per orbit, so the same face always points at the body being orbited (the Moon and Earth).
- **Time Machine**: the tool that moves only the start date and recomputes.
- **Token**: a secret key the web app uses to talk to the science service.
- **Tolerance**: the biggest disagreement or error we will accept.
- **TypeScript**: a stricter flavour of JavaScript used for the web app.

### U

- **Uncertified (class `X`)**: the event search could not decide the interval.
- **Unknown**: not known. Never counted as hidden or visible.
- **Unresolved (class `U`)**: inside the narrow decision band, too close to call.
- **Upper bound**: see **bound**.
- **Upper limb**: the top edge of the Sun's or Earth's disc. The "upper limb" reading counts a target visible as soon as any part clears.
- **UTC**: Coordinated Universal Time, the everyday world clock.

### V

- **Validation**: proving, with outside evidence and a formal sign-off, that the model matches the real world. Not done.
- **Verification**: checking that we computed what we meant to compute, correctly and consistently. Done extensively.
- **Vercel**: the web host the public demo's web app runs on.
- **Visible (class `V`)**: proven above the skyline.

### W

- **Warning**: a labelled notice carried with a result, such as `UNVERIFIED` or `DEM_COVERAGE_INCOMPLETE`.
- **Web app**: a program used in a web browser.
- **WebGL**: the browser's built-in ability to draw 3D graphics.
- **Whole disc**: the reading that counts a target visible only when its whole disc clears the skyline.

### Z

- **Zenith**: the point straight overhead, at elevation 90°.

---

## 17. Where everything is, and what is still open

| Folder or file | What is in it |
| --- | --- |
| `science/lunascope/` | the science service: observer, skyline, events, metrics, run lifecycle, the independent skyline and the illumination comparison |
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
- **A licence for the code.** The GitHub repository is public but has no licence file, so by default nobody else may reuse it.
- Optional upgrades, not needed for the challenge: live computing online (needs a larger paid server), more notable sites with sourced coordinates, rim points for the named craters, and Sri Lanka-specific content.

---

*If you remember only three things: (1) at the south pole the **terrain**, not the Sun's height, decides whether a site gets sunlight or a line to Earth; (2) LunaScope shows that with real NASA data, **checks it independently**, and **tells you what it does not know**; (3) it is a **screening and education tool**, honestly labelled as unvalidated.*
