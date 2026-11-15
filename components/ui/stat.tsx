import type { ReactNode } from "react";

/** A labelled measured value. The value is a readout; an optional hint sits underneath. */
export function Stat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1">
        <span className="readout readout-lg">{value}</span>
        {unit && <span className="readout-unit">{unit}</span>}
        {hint && <span className="type-caption mt-0.5 block">{hint}</span>}
      </dd>
    </div>
  );
}
