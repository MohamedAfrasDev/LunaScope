import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * A calm loading state (galaxy D7): the words say what is loading (read out as a status), and a few soft blocks show the
 * shape of what is coming. The blocks are decoration only. Their slow pulse stops under reduced motion.
 */
export function LoadingState({
  label,
  kind = "panel",
  className,
}: {
  label: string;
  kind?: "page" | "panel";
  className?: string;
}) {
  return (
    <div role="status" className={cn("grid gap-3", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div aria-hidden="true" className="grid gap-3">
        {kind === "page" ? (
          <>
            <Skeleton className="h-7 w-2/5" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </>
        )}
      </div>
    </div>
  );
}
