import type { ReactNode } from "react";

/**
 * Secondary detail that stays one click away. Built on the native <details>, so it is keyboard
 * operable and announced correctly with no script.
 */
export function Disclosure({
  summary,
  children,
  open,
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <details open={open} className={`rounded-md border border-border ${className}`.trim()}>
      <summary className="px-3 py-2 text-sm font-medium">{summary}</summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
