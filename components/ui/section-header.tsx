import type { ReactNode } from "react";

/** Heading for a section: optional eyebrow above, optional description and action beside it. */
export function SectionHeader({
  title,
  eyebrow,
  description,
  action,
  as: Heading = "h2",
  id,
}: {
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <Heading id={id} className={Heading === "h1" ? "type-title" : "type-section"}>
          {title}
        </Heading>
        {description && <p className="type-caption mt-1 max-w-3xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}
