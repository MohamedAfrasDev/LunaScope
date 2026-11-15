import Link from "next/link";
import { Panel } from "@/components/atlas/Panel";

/** Learn (spec 6.14): the idea, the three rules and what the tool is not. The same wording as the Home page and the user guide. */
export function LearnPanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="Learn" onClose={onClose} focused className="max-h-full" bodyClassName="atlas-prose space-y-4">
      <p>
        Near the lunar south pole the Sun and Earth stay within a few degrees of the horizon, so <strong>the ground around you decides
        everything</strong>. A ridge a few kilometres away can hide a Sun that is above the horizon on paper.
      </p>
      <p>
        LunaScope compares candidate sites for sunlight and a direct line to Earth, using the real terrain skyline instead of a flat
        horizon, over dates you choose.
      </p>

      <div>
        <h3 className="atlas-label mb-2 text-[var(--ink-dim)]">Three rules this tool does not break</h3>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>No placeholder is shown as science.</strong> Synthetic or unverified values always carry a label.
          </li>
          <li>
            <strong>Unknown is not &ldquo;not visible&rdquo;.</strong> Missing data stays unknown and is never counted as an outage.
          </li>
          <li>
            <strong>No hidden score.</strong> Sunlight and Earth visibility are judged separately and the trade-offs are shown.
          </li>
        </ol>
      </div>

      <div>
        <h3 className="atlas-label mb-2 text-[var(--ink-dim)]">What it is not</h3>
        <p className="text-[var(--ink-dim)]">
          Not a landing-safety, power, link-budget or mission-feasibility assessment. Sunlight percentage is geometric illumination, and
          Earth visibility is a line of sight, not a communications guarantee. Not flight-qualified. Not endorsed by NASA.
        </p>
      </div>

      <p>
        <Link href="/why-the-south-pole-is-hard" className="text-[var(--ink)] underline underline-offset-4">
          Why the south pole is hard
        </Link>
      </p>
    </Panel>
  );
}
