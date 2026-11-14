import Link from "next/link";
import { ReferenceMissionButton } from "@/components/ReferenceMissionButton";

export default function Home() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <section>
        <p className="eyebrow">Lunar south pole · screening tool</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl sm:leading-[1.15]">
          Is the Sun or Earth above the terrain, at this site, on these dates?
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
          LunaScope compares candidate sites near the lunar south pole for sunlight and a direct line to Earth. A
          flat horizon can overestimate both: ridges and crater walls hide a target whose geometric elevation is
          above zero. LunaScope shows the local sky against the terrain skyline, the outages, and the evidence
          behind each number.
        </p>
        <div className="surface-card mt-8 p-5 sm:p-6">
          <ReferenceMissionButton />
        </div>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/analyze" className="text-accent underline underline-offset-4">
            Or set up your own analysis
          </Link>
          <Link href="/why-the-south-pole-is-hard" className="text-accent underline underline-offset-4">
            Why the south pole is hard
          </Link>
        </p>
      </section>

      <aside aria-labelledby="rules" className="surface-card p-5 sm:p-6">
        <h2 id="rules" className="text-base font-semibold">
          Three rules this tool does not break
        </h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 marker:font-semibold marker:text-muted">
          <li>
            <strong>No placeholder is shown as science.</strong> Synthetic or unverified values always carry a label.
          </li>
          <li>
            <strong>Unknown is not “not visible”.</strong> Missing data stays unknown and is never counted as an
            outage.
          </li>
          <li>
            <strong>No hidden score.</strong> Sunlight and Earth visibility are judged separately and the
            trade-offs are shown.
          </li>
        </ol>
        <hr className="my-5 border-border" />
        <h2 className="text-base font-semibold">What it is not</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Not a landing-safety, power, link-budget or mission-feasibility assessment. Sunlight percentage is
          geometric illumination, and Earth visibility is a line of sight, not a communications guarantee.
        </p>
      </aside>
    </div>
  );
}
