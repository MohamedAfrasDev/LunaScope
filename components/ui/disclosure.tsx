import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Secondary detail that stays one click away. Built on the native <details>, so it is keyboard
 * operable (Enter and Space), findable in the page and announced correctly with no script. The look
 * follows the rest of the shadcn components: a soft border, a thin chevron that turns when open.
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
    <details open={open} className={cn("group rounded-lg border border-border bg-muted/30", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        {summary}
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
