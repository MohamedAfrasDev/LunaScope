import type { ButtonHTMLAttributes } from "react";

/** Primary is the one action on a surface; secondary is everything else. */
export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const look =
    variant === "primary"
      ? "btn-primary btn-sm"
      : "rounded-md border border-border bg-card px-3 py-2 text-sm font-medium disabled:opacity-50";
  return <button type={type} className={`${look} ${className}`.trim()} {...rest} />;
}
