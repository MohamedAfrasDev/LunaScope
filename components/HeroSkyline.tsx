/**
 * Home hero: one picture of the product's whole idea. A low site, a ridge, a flat 0° horizon, a Sun
 * that is "above the horizon" and still hidden, and an Earth that is clear. Judged separately, as the
 * tool does. Drawn only from design tokens, so it follows both themes.
 *
 * Honesty: this is a sketch, not to scale and not derived from any data; the figure caption says so
 * (in different words from the explainer's schematic, so the two never match the same text). Nothing here is a result.
 */
export function HeroSkyline() {
  return (
    <figure className="m-0">
      <svg
        viewBox="0 0 480 320"
        role="img"
        aria-labelledby="hero-t"
        aria-describedby="hero-d"
        className="hero-sketch h-auto w-full rounded-lg border border-border bg-surface"
      >
        <title id="hero-t">Sketch: a ridge hides the Sun from a low site, while Earth is clear</title>
        <desc id="hero-d">
          A site stands on low ground at the left. A dashed horizontal line marks the flat horizon. The Sun sits just
          above that line on the right, but a ridge between the site and the Sun rises higher, so the straight line to
          the Sun is blocked. Earth sits higher on the left, above the ridge line, with a clear line of sight. Drawn
          for illustration only: not to scale, and not taken from any data.
        </desc>

        {/* a few faint stars: decoration only */}
        <g style={{ fill: "var(--muted)" }} opacity="0.55" aria-hidden="true">
          <circle cx="36" cy="40" r="1.2" />
          <circle cx="92" cy="104" r="1" />
          <circle cx="212" cy="46" r="1.2" />
          <circle cx="300" cy="86" r="1" />
          <circle cx="372" cy="38" r="1.2" />
          <circle cx="440" cy="116" r="1" />
          <circle cx="260" cy="130" r="1" />
        </g>

        {/* ground */}
        <path
          d="M0 270 L60 268 L120 262 L170 240 L215 190 L245 150 L275 195 L330 252 L400 262 L480 258 L480 320 L0 320 Z"
          style={{ fill: "var(--surface-2)", stroke: "var(--border-strong)" }}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* flat horizon */}
        <line x1="60" y1="262" x2="480" y2="262" strokeDasharray="6 5" strokeWidth="1.2" style={{ stroke: "var(--muted)" }} />
        <text x="476" y="282" textAnchor="end" fontSize="15" style={{ fill: "var(--muted)" }}>
          flat horizon (0°)
        </text>

        {/* skyline: the ray from the site to the top of the ridge */}
        <line x1="60" y1="262" x2="245" y2="150" strokeWidth="1.5" style={{ stroke: "var(--foreground)" }} className="hero-in hero-d1" />
        <text x="256" y="146" fontSize="15" textAnchor="start" style={{ fill: "var(--foreground)" }}>
          skyline
        </text>

        {/* Sun: above the flat horizon, line of sight blocked */}
        <line x1="60" y1="262" x2="404" y2="246" strokeWidth="1.8" strokeDasharray="5 4" style={{ stroke: "var(--fail)" }} className="hero-in hero-d2" />
        <circle cx="414" cy="244" r="13" style={{ fill: "var(--sun)" }} className="hero-in hero-d2" />
        <text x="414" y="220" textAnchor="middle" fontSize="15" style={{ fill: "var(--sun)" }} className="hero-in hero-d2">
          Sun
        </text>
        <text x="296" y="240" textAnchor="middle" fontSize="14" style={{ fill: "var(--fail)" }} className="hero-in hero-d2">
          blocked
        </text>

        {/* Earth: clear line of sight */}
        <line x1="60" y1="262" x2="118" y2="168" strokeWidth="1.8" style={{ stroke: "var(--earth)" }} className="hero-in hero-d3" />
        <path d="M122 160 L132 172 L122 184 L112 172Z" style={{ fill: "var(--earth)" }} className="hero-in hero-d3" />
        <text x="144" y="150" fontSize="15" style={{ fill: "var(--earth)" }} className="hero-in hero-d3">
          Earth
        </text>

        {/* the site */}
        <circle cx="60" cy="264" r="4.5" style={{ fill: "var(--foreground)" }} />
        <text x="20" y="250" fontSize="15" style={{ fill: "var(--foreground)" }}>
          site
        </text>
      </svg>
      <figcaption className="type-caption mt-2">
        Illustration only: not to scale, and not taken from any data. The Sun is above a flat horizon but hidden by the ridge; Earth
        is clear. LunaScope judges each separately.
      </figcaption>
    </figure>
  );
}
