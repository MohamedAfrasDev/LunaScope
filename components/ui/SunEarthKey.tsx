/** Legend for the two protagonists. Shape and word, not colour alone: a dot for the Sun, a diamond for Earth. */
export function SunEarthKey() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Key">
      <li className="flex items-center gap-1.5">
        <svg aria-hidden="true" viewBox="0 0 10 10" className="h-2.5 w-2.5">
          <circle cx="5" cy="5" r="4.5" fill="var(--sun)" />
        </svg>
        Sun
      </li>
      <li className="flex items-center gap-1.5">
        <svg aria-hidden="true" viewBox="0 0 10 10" className="h-2.5 w-2.5">
          <path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill="var(--earth)" />
        </svg>
        Earth
      </li>
    </ul>
  );
}
