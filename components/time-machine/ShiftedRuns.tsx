import type { VariantLink, VariantsResponse } from "@/lib/api/types";
import { utc } from "@/lib/format";
import { signedDays } from "./format";

/** The runs already made from this baseline; pick one to compare. */
export function ShiftedRuns({
  links,
  selected,
  onSelect,
}: {
  links: VariantsResponse;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const base = Date.parse(links.start_utc);
  return (
    <section aria-label="Shifted runs of this baseline" className="text-sm">
      <h2 className="font-semibold">Shifted runs of this baseline</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {links.children.map((c: VariantLink) => {
          const off = (Date.parse(c.start_utc) - base) / 1000;
          const on = c.child_run_id === selected;
          return (
            <li key={c.child_run_id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(c.child_run_id)}
                className={`rounded-md border px-3 py-1.5 ${on ? "border-primary bg-muted font-medium" : "border-border"}`}
              >
                {signedDays(off)} · starts {utc(c.start_utc)}
                <span className="sr-only">, {c.status}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
