import { GLOSSARY } from "@/lib/glossary";
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

      <div>
        <h3 className="atlas-label mb-2 text-[var(--ink-dim)]">Why the south pole is hard</h3>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>The Sun barely clears the horizon.</strong> The Moon&rsquo;s spin axis is tilted only about 1.5°, so at the pole the
            Sun circles the horizon within a degree or two of it. Sunlight here is grazing light.
          </li>
          <li>
            <strong>So the ground around you decides.</strong> A ridge 300 m higher than you and 5 km away stands about 3.4° above a
            level horizon, more than the Sun ever climbs. A site can have the Sun &ldquo;above the horizon&rdquo; on paper and still be
            in shadow.
          </li>
          <li>
            <strong>Earth is near the horizon too.</strong> It drifts by a few degrees as the Moon librates, so a direct line to Earth
            is a matter of the same few degrees.
          </li>
        </ol>
        <p className="mt-3 text-[var(--ink-dim)]">
          A flat horizon overestimates. Dates matter. Small errors matter. And &ldquo;not sure&rdquo; is a real answer: where the data cannot
          settle it, LunaScope leaves the time unknown. Figures here are rounded textbook values, not a result.
        </p>
      </div>

      <div>
        <h3 id="key-terms" className="atlas-label mb-2 text-[var(--ink-dim)]">Key terms</h3>
        <dl className="grid gap-3 text-sm leading-6">
          {GLOSSARY.map((g) => (
            <div key={g.id}>
              <dt className="font-medium">{g.term}</dt>
              <dd className="text-[var(--ink-dim)]">{g.text}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h3 className="atlas-label mb-2 text-[var(--ink-dim)]">Data behind the tool</h3>
        <ul className="list-disc space-y-1 pl-5 text-[var(--ink-dim)]">
          <li>Sun and Earth directions: JPL Horizons, checked against NAIF SPICE.</li>
          <li>Terrain: Lunar Orbiter Laser Altimeter (LOLA) elevation data from the LRO mission, via the NASA PDS.</li>
          <li>NASA&rsquo;s LROC QuickMap and Moon Trek are used to look at the terrain; they are not numerical inputs.</li>
        </ul>
      </div>
    </Panel>
  );
}
