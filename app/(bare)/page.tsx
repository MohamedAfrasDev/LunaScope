import Link from "next/link";
import { HeroSkyline } from "@/components/HeroSkyline";
import { LandingHero } from "@/components/landing/LandingHero";
import { ReferenceMissionButton } from "@/components/ReferenceMissionButton";
import { ReferenceRunCard } from "@/components/ReferenceRunCard";

const linkClass = "tap inline-flex items-center text-[var(--ink)] underline underline-offset-4 hover:text-[var(--ink-dim)]";

/**
 * The landing (docs/redesign/LAYOUT-SPEC.md, 6.1): the Moon, a wordmark and one button on the first screen; the idea, the
 * three rules and the limits below it. Saved runs stay reachable from here until the Atlas run menu replaces them (phase G).
 */
export default function Home() {
  return (
    <div className="atlas min-h-svh">
      <LandingHero />

      <div className="mx-auto grid max-w-6xl gap-20 px-6 py-20 sm:px-10">
        <section id="idea" aria-labelledby="idea-h" className="grid scroll-mt-8 gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p className="atlas-label text-[var(--ink-dim)]">Lunar south pole · screening tool</p>
            <h2 id="idea-h" className="mt-3 text-balance text-3xl font-light leading-tight tracking-tight sm:text-4xl">
              Is the Sun or Earth above the terrain, at this site, on these dates?
            </h2>
            <p className="atlas-prose mt-5 max-w-xl text-base text-[var(--ink-dim)]">
              LunaScope compares candidate sites near the lunar south pole for sunlight and a direct line to Earth. A flat horizon
              can overestimate both: ridges and crater walls hide a target whose geometric elevation is above zero.
            </p>
            <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Link href="/atlas" className={linkClass}>
                Open the Atlas
              </Link>
            </p>
          </div>
          <div>
            <HeroSkyline />
            <p className="atlas-prose mt-4 text-sm text-[var(--ink-dim)]">
              LunaScope shows the local sky against the terrain skyline, the outages, and the evidence behind each number.
            </p>
          </div>
        </section>

        <aside aria-labelledby="rules" className="atlas-panel p-6 sm:p-8">
          <h2 id="rules" className="atlas-label-lg">
            Three rules this tool does not break
          </h2>
          <ol role="list" className="atlas-prose mt-5 grid list-none gap-6 p-0 md:grid-cols-3">
            <li>
              <span className="atlas-label text-[var(--ink-dim)]">Rule 1</span>
              <p className="mt-1">
                <strong>No placeholder is shown as science.</strong> Synthetic or unverified values always carry a label.
              </p>
            </li>
            <li>
              <span className="atlas-label text-[var(--ink-dim)]">Rule 2</span>
              <p className="mt-1">
                <strong>Unknown is not &ldquo;not visible&rdquo;.</strong> Missing data stays unknown and is never counted as an
                outage.
              </p>
            </li>
            <li>
              <span className="atlas-label text-[var(--ink-dim)]">Rule 3</span>
              <p className="mt-1">
                <strong>No hidden score.</strong> Sunlight and Earth visibility are judged separately and the trade-offs are shown.
              </p>
            </li>
          </ol>
          <h3 className="atlas-label-lg mt-8">What it is not</h3>
          <p className="atlas-prose mt-2 max-w-3xl text-[var(--ink-dim)]">
            Not a landing-safety, power, link-budget or mission-feasibility assessment. Sunlight percentage is geometric
            illumination, and Earth visibility is a line of sight, not a communications guarantee.
          </p>
        </aside>

        <section aria-labelledby="saved" className="grid gap-5">
          <div>
            <h2 id="saved" className="atlas-label-lg">
              Open a saved run
            </h2>
            <p className="atlas-prose mt-2 max-w-3xl text-sm text-[var(--ink-dim)]">
              The reference mission is a frozen scenario; the two comparisons use named places from the IAU&rsquo;s official list over
              the same week and requirements. These are named features, not landing recommendations.
            </p>
          </div>
          <div className="surface-card p-5 sm:p-6">
            <ReferenceMissionButton />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ReferenceRunCard refId="GR-002" buttonLabel="Compare the Artemis III features" />
            <ReferenceRunCard refId="GR-003" buttonLabel="Compare the well-known craters" />
          </div>
        </section>

        <footer className="atlas-prose border-t border-[var(--panel-edge)] pt-6 text-center text-xs text-[var(--ink-dim)]">
          <p className="mx-auto max-w-3xl">
            Not flight-qualified. Does not certify landing safety, electrical power, link performance or mission feasibility. Not
            endorsed by NASA. Data: JPL Horizons, LRO LOLA, NAIF SPICE.
          </p>
        </footer>
      </div>
    </div>
  );
}
