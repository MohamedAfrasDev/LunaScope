import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Why the south pole is hard",
  description: "Why sunlight and a line of sight to Earth are hard to predict near the lunar south pole.",
};

/** Schematic only: drawn to explain the idea, not to any scale, and not derived from any data. */
function Schematic() {
  return (
    <figure className="my-6">
      <svg viewBox="0 0 640 230" role="img" aria-labelledby="sch-t" aria-describedby="sch-d" className="h-auto w-full max-w-3xl rounded border border-border bg-surface">
        <title id="sch-t">Schematic: the Sun is above a flat horizon but hidden behind a ridge</title>
        <desc id="sch-d">
          A viewer stands on low ground on the left. A dashed horizontal line shows the flat horizon. The Sun sits
          just above that line. A ridge to the right rises above the dashed line and blocks the straight line from the
          viewer to the Sun, so the Sun is not visible even though it is above the flat horizon. Not to scale.
        </desc>
        <path d="M0 200 L120 200 L220 178 L300 120 L330 96 L360 124 L440 176 L640 190 L640 230 L0 230 Z"
          style={{ fill: "var(--surface-2)", stroke: "var(--muted)" }} strokeWidth="1.5" />
        <line x1="70" y1="188" x2="640" y2="188" strokeDasharray="6 5" strokeWidth="1.2" style={{ stroke: "var(--muted)" }} />
        <text x="470" y="206" fontSize="12" style={{ fill: "var(--muted)" }}>flat horizon (0°)</text>
        <circle cx="70" cy="186" r="4" style={{ fill: "var(--foreground)" }} />
        <text x="30" y="172" fontSize="12" style={{ fill: "var(--foreground)" }}>site</text>
        <circle cx="560" cy="166" r="14" style={{ fill: "var(--warn)" }} />
        <text x="520" y="140" fontSize="12" style={{ fill: "var(--foreground)" }}>Sun, about 1° up</text>
        {/* the straight line of sight to the Sun runs into the ridge; the ray to the ridge top is the skyline */}
        <line x1="70" y1="186" x2="546" y2="167" strokeWidth="1.5" strokeDasharray="5 4" style={{ stroke: "var(--fail)" }} />
        <text x="352" y="150" fontSize="12" style={{ fill: "var(--fail)" }}>line of sight to the Sun</text>
        <text x="352" y="164" fontSize="12" style={{ fill: "var(--fail)" }}>(blocked by the ridge)</text>
        <line x1="70" y1="186" x2="330" y2="96" strokeWidth="1.2" style={{ stroke: "var(--foreground)" }} />
        <text x="104" y="118" fontSize="12" style={{ fill: "var(--foreground)" }}>skyline: higher than the Sun</text>
      </svg>
      <figcaption className="mt-2 text-sm text-muted">
        Schematic, not to scale and not computed from data. A flat-horizon estimate counts the Sun as up; the ridge
        decides that it is not visible.
      </figcaption>
    </figure>
  );
}

export default function WhySouthPoleIsHard() {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Why the south pole is hard</h1>
      <p className="mt-3 text-lg leading-8 text-muted">
        Near the Moon’s south pole, whether a spot gets sunlight, or can see Earth, is decided by a few degrees of sky
        and by the shape of the ground around it. A simple estimate gets that wrong in a predictable way.
      </p>

      <h2 className="mt-8 text-xl font-semibold">1. The Sun barely clears the horizon</h2>
      <p className="mt-2 leading-7">
        The Moon’s spin axis is tilted only about 1.5° away from the plane it orbits the Sun in. Standing at the pole,
        the Sun therefore circles the horizon instead of climbing and setting the way it does at home. Its centre stays
        within roughly a degree or two of the horizon (and the Sun’s disc is about half a degree wide). Sunlight here is
        a grazing light.
      </p>

      <h2 className="mt-8 text-xl font-semibold">2. So the ground around you decides</h2>
      <p className="mt-2 leading-7">
        When the Sun is only a degree or two up, almost any rise in the ground blocks it. As an illustration of the
        arithmetic: a ridge 300 m higher than you and 5 km away stands about 3.4° above a level horizon, which is more
        than the Sun ever climbs. The polar region has crater rims and ridges that rise by hundreds of metres or more,
        so a site can have the Sun “above the horizon” on paper and still be in shadow.
      </p>
      <Schematic />

      <h2 className="mt-8 text-xl font-semibold">3. Earth is near the horizon too</h2>
      <p className="mt-2 leading-7">
        Seen from a polar site, Earth also sits close to the horizon. It drifts by a few degrees because the Moon
        slowly wobbles as it orbits (libration). Depending on the site and the date, Earth can be a little above the
        local skyline, a little below it, or hidden behind terrain. A direct line to Earth is a matter of the same few
        degrees.
      </p>

      <h2 className="mt-8 text-xl font-semibold">4. What follows</h2>
      <ul className="mt-2 list-disc space-y-2 pl-6 leading-7">
        <li>
          <strong>A flat horizon overestimates.</strong> Treating the horizon as level can count a target as visible
          when a ridge hides it.
        </li>
        <li>
          <strong>Dates matter.</strong> As the Sun and Earth move, outages begin and end. Two sites with the same
          total availability can have very different longest outages.
        </li>
        <li>
          <strong>Small errors matter.</strong> A fraction of a degree in the terrain or the geometry can change when an
          outage starts, or whether a requirement is met at all.
        </li>
        <li>
          <strong>“Not sure” is a real answer.</strong> Where the data cannot settle whether a target is above or below
          the skyline, LunaScope leaves that time unknown. It does not count it as visible or as an outage.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">What LunaScope does about it</h2>
      <p className="mt-2 leading-7">
        It compares the Sun and Earth directions for a site and dates with the terrain skyline built from a pinned
        elevation model. It shows the local sky, the outages and the evidence behind every number, and it keeps the
        flat-horizon result beside the terrain result so the difference is visible.
      </p>

      <aside className="mt-6 rounded border border-border bg-surface p-4 text-sm leading-6">
        <p className="font-semibold">What this page is not</p>
        <p className="mt-1 text-muted">
          A short explanation for learners, not a result. The figures above are rounded textbook values and a worked
          example; the numbers for a particular site come from a run, and carry that run’s label. LunaScope is a
          screening and education tool, not a landing-safety, power, link or mission-feasibility assessment.
        </p>
      </aside>

      <h2 className="mt-8 text-xl font-semibold">Data behind the tool</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6">
        <li>Sun and Earth directions: JPL Horizons, checked against NAIF SPICE.</li>
        <li>Terrain: Lunar Orbiter Laser Altimeter (LOLA) elevation data from the LRO mission, via the NASA PDS.</li>
        <li>NASA’s LROC QuickMap and Moon Trek are used to look at the terrain; they are not numerical inputs.</li>
      </ul>

      <p className="mt-8 flex flex-wrap gap-6 text-sm">
        <Link href="/" className="font-medium text-accent underline underline-offset-4">Start the reference mission</Link>
        <Link href="/analyze" className="font-medium text-accent underline underline-offset-4">Set up your own analysis</Link>
      </p>
    </article>
  );
}
