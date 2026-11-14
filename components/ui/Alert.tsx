import type { HTMLAttributes } from "react";
import { TONE_BOX, type Tone } from "./tone";

/**
 * A message that must be seen. Announced to assistive technology (role="alert") unless a caller
 * passes another role, for example "status" for non-urgent notes.
 */
export function Alert({
  tone = "fail",
  size = "inline",
  className = "",
  role = "alert",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: Exclude<Tone, "ok" | "muted">; size?: "inline" | "block" }) {
  const pad = size === "block" ? "rounded-lg p-4" : "rounded-md px-3 py-2";
  return <div role={role} className={`border ${pad} ${TONE_BOX[tone]} ${className}`.trim()} {...rest} />;
}
