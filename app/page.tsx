import Link from "next/link";
import { HeroSkyline } from "@/components/HeroSkyline";
import { HeroStage } from "@/components/HeroStage";
import { ReferenceMissionButton } from "@/components/ReferenceMissionButton";
import { ReferenceRunCard } from "@/components/ReferenceRunCard";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <div className="grid gap-14 sm:gap-16">
      <HeroStage>
      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
        <section>
          <p className="eyebrow">Lunar south pole · screening tool</p>
          <h1 className="type-display mt-3 text-balance">
            Is the Sun or Earth above the terrain, at this site, on these dates?
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            LunaScope compares candidate sites near the lunar south pole for sunlight and a direct line to Earth. A
            flat horizon can overestimate both: ridges and crater walls hide a target whose geometric elevation is
            above zero.
          </p>
          <div className="surface-card mt-7 p-5 sm:p-6">
            <ReferenceMissionButton />
          </div>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/analyze" className="tap text-primary underline underline-offset-4">
              Or set up your own analysis
            </Link>
            <Link href="/why-the-south-pole-is-hard" className="tap text-primary underline underline-offset-4">
              Why the south pole is hard
            </Link>
          </p>
        </section>

        <div>
          <HeroSkyline />
          <p className="mt-4 text-sm leading-6 text-foreground">
            LunaScope shows the local sky against the terrain skyline, the outages, and the evidence behind each
            number.
          </p>
        </div>
      </div>
      </HeroStage>

      <section aria-labelledby="notable">
        <h2 id="notable" className="type-section">
          Compare notable south-polar places
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Named places from the IAU&rsquo;s official list, over the same week and requirements as the reference mission.
          Each set opens a saved comparison; or pick any of them (and your own coordinates) in{" "}
          <Link href="/analyze" className="text-primary underline underline-offset-4">
            your own analysis
          </Link>
          . These are named features, not landing recommendations.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ReferenceRunCard refId="GR-002" buttonLabel="Compare the Artemis III features" />
          <ReferenceRunCard refId="GR-003" buttonLabel="Compare the well-known craters" />
        </div>
      </section>

      <aside aria-labelledby="rules" className="surface-card p-5 sm:p-6">
        <h2 id="rules" className="type-section">
          Three rules this tool does not break
        </h2>
        <ol role="list" className="mt-4 grid list-none gap-5 p-0 text-sm leading-6 md:grid-cols-3">
          <li>
            <span className="eyebrow">Rule 1</span>
            <p className="mt-1">
              <strong>No placeholder is shown as science.</strong> Synthetic or unverified values always carry a
              label.
            </p>
          </li>
          <li>
            <span className="eyebrow">Rule 2</span>
            <p className="mt-1">
              <strong>Unknown is not “not visible”.</strong> Missing data stays unknown and is never counted as an
              outage.
            </p>
          </li>
          <li>
            <span className="eyebrow">Rule 3</span>
            <p className="mt-1">
              <strong>No hidden score.</strong> Sunlight and Earth visibility are judged separately and the
              trade-offs are shown.
            </p>
          </li>
        </ol>
        <Separator className="my-5" />
        <h2 className="text-base font-semibold">What it is not</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Not a landing-safety, power, link-budget or mission-feasibility assessment. Sunlight percentage is
          geometric illumination, and Earth visibility is a line of sight, not a communications guarantee.
        </p>
      </aside>
    </div>
  );
}
