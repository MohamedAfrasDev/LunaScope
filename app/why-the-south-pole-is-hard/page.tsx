import type { Metadata } from "next";
import Link from "next/link";
import { SkylineFigure } from "@/components/HeroSkyline";

export const metadata: Metadata = {
  title: "Why the south pole is hard",
  description: "Why sunlight and a line of sight to Earth are hard to predict near the lunar south pole.",
};

/**
 * The same picture as the home hero, without Earth: the Sun is above a flat horizon and the ridge
 * hides it. Schematic only: drawn to explain the idea, not to any scale, and not derived from any data.
 */
function Schematic() {
  return (
    <div className="my-6 max-w-xl">
      <SkylineFigure
        titleId="sch-t"
        descId="sch-d"
        title="Schematic: the Sun is above a flat horizon but hidden behind a ridge"
        desc={
          "A viewer stands on low ground on the left. A dashed horizontal line shows the flat horizon. The Sun sits " +
          "just above that line. A ridge to the right rises above the dashed line and blocks the straight line from the " +
          "viewer to the Sun, so the Sun is not visible even though it is above the flat horizon. Not to scale."
        }
        caption={
          "Schematic, not to scale and not computed from data. A flat-horizon estimate counts the Sun as up; the ridge " +
          "decides that it is not visible."
        }
        withEarth={false}
        sunLabel="Sun, about 1° up"
      />
    </div>
  );
}

const H2 = "type-section mt-10";
const P = "mt-2 leading-7";

export default function WhySouthPoleIsHard() {
  return (
    <article className="mx-auto max-w-3xl">
      <p className="eyebrow">Background</p>
      <h1 className="type-title mt-2">Why the south pole is hard</h1>
      <p className="mt-3 text-lg leading-8 text-muted">
        Near the Moon’s south pole, whether a spot gets sunlight, or can see Earth, is decided by a few degrees of sky
        and by the shape of the ground around it. A simple estimate gets that wrong in a predictable way.
      </p>

      <h2 className={H2}>1. The Sun barely clears the horizon</h2>
      <p className={P}>
        The Moon’s spin axis is tilted only about 1.5° away from the plane it orbits the Sun in. Standing at the pole,
        the Sun therefore circles the horizon instead of climbing and setting the way it does at home. Its centre stays
        within roughly a degree or two of the horizon (and the Sun’s disc is about half a degree wide). Sunlight here is
        a grazing light.
      </p>

      <h2 className={H2}>2. So the ground around you decides</h2>
      <p className={P}>
        When the Sun is only a degree or two up, almost any rise in the ground blocks it. As an illustration of the
        arithmetic: a ridge 300 m higher than you and 5 km away stands about 3.4° above a level horizon, which is more
        than the Sun ever climbs. The polar region has crater rims and ridges that rise by hundreds of metres or more,
        so a site can have the Sun “above the horizon” on paper and still be in shadow.
      </p>
      <Schematic />

      <h2 className={H2}>3. Earth is near the horizon too</h2>
      <p className={P}>
        Seen from a polar site, Earth also sits close to the horizon. It drifts by a few degrees because the Moon
        slowly wobbles as it orbits (libration). Depending on the site and the date, Earth can be a little above the
        local skyline, a little below it, or hidden behind terrain. A direct line to Earth is a matter of the same few
        degrees.
      </p>

      <h2 className={H2}>4. What follows</h2>
      <ul className="mt-2 list-disc space-y-2 pl-6 leading-7 marker:text-muted">
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

      <h2 className={H2}>What LunaScope does about it</h2>
      <p className={P}>
        It compares the Sun and Earth directions for a site and dates with the terrain skyline built from a pinned
        elevation model. It shows the local sky, the outages and the evidence behind every number, and it keeps the
        flat-horizon result beside the terrain result so the difference is visible.
      </p>

      <aside className="surface-card mt-8 p-4 text-sm leading-6">
        <p className="font-semibold">What this page is not</p>
        <p className="mt-1 text-muted">
          A short explanation for learners, not a result. The figures above are rounded textbook values and a worked
          example; the numbers for a particular site come from a run, and carry that run’s label. LunaScope is a
          screening and education tool, not a landing-safety, power, link or mission-feasibility assessment.
        </p>
      </aside>

      <h2 className={H2}>Data behind the tool</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 marker:text-muted">
        <li>Sun and Earth directions: JPL Horizons, checked against NAIF SPICE.</li>
        <li>Terrain: Lunar Orbiter Laser Altimeter (LOLA) elevation data from the LRO mission, via the NASA PDS.</li>
        <li>NASA’s LROC QuickMap and Moon Trek are used to look at the terrain; they are not numerical inputs.</li>
      </ul>

      <p className="mt-10 flex flex-wrap gap-6 text-sm">
        <Link href="/" className="font-medium text-accent underline underline-offset-4">Start the reference mission</Link>
        <Link href="/analyze" className="font-medium text-accent underline underline-offset-4">Set up your own analysis</Link>
      </p>
    </article>
  );
}
