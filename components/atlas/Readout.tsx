import type { ReactNode } from "react";
import { Tag, type TagKind } from "@/components/atlas/Tag";

/** One corner readout (spec 4): a label, where the value comes from, and the value. */
export function ReadoutRow({ label, tag, children }: { label: string; tag?: TagKind; children: ReactNode }) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-2">
        <span className="atlas-label text-[var(--ink-dim)]">{label}</span>
        {tag && <Tag kind={tag} />}
      </div>
      <div className="atlas-number text-lg tracking-wide text-[var(--ink)]">{children}</div>
    </div>
  );
}

export type ExtraRow = { label: string; tag?: TagKind; value: string };

export function Readout({ scaleLabel, timeLabel, extra = [] }: { scaleLabel: string; timeLabel: string; extra?: ExtraRow[] }) {
  return (
    <div className="pointer-events-none flex flex-col items-end gap-2 [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]" data-testid="atlas-readout">
      <ReadoutRow label="Time">{timeLabel}</ReadoutRow>
      {extra.map((r) => (
        <ReadoutRow key={r.label} label={r.label} tag={r.tag}>
          {r.value}
        </ReadoutRow>
      ))}
      <ReadoutRow label="Scale">{scaleLabel}</ReadoutRow>
    </div>
  );
}
