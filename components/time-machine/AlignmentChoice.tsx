import { useId } from "react";
import type { Alignment } from "@/lib/api/types";

const ALIGNMENTS: { value: Alignment; label: string; help: string }[] = [
  {
    value: "elapsed",
    label: "Elapsed time",
    help: "Each run keeps its own UTC. Day 1 of the baseline is compared with day 1 of the shifted run.",
  },
  {
    value: "calendar",
    label: "Calendar time",
    help: "One shared UTC axis. Only the dates both runs cover are compared; time outside a run's own window is never counted.",
  },
];

/** How the two runs line up in time. Two radios in one group, so the arrow keys move between them. */
export function AlignmentChoice({ value, onChange }: { value: Alignment; onChange: (a: Alignment) => void }) {
  const uid = useId();
  return (
    <fieldset id="time-alignment" className="surface-card p-4">
      <legend className="px-1 text-base font-semibold">Time alignment</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {ALIGNMENTS.map((a) => (
          <label key={a.value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={`${uid}-align`}
              value={a.value}
              checked={value === a.value}
              onChange={() => onChange(a.value)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{a.label}</span>
              <span className="block text-muted">{a.help}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
