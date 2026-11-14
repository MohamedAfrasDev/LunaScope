import type { HTMLAttributes } from "react";

/**
 * A bounded group of content.
 * "panel" is a top-level surface; "inset" is a quieter box nested inside one.
 */
export function Card({
  variant = "panel",
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { variant?: "panel" | "inset" }) {
  const base = variant === "panel" ? "surface-card p-4" : "rounded-md border border-border p-3 text-sm";
  return <div className={`${base} ${className}`.trim()} {...rest} />;
}
