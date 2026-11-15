import { Suspense } from "react";
import { RunNav } from "@/components/RunNav";

/**
 * Shared frame for every view of one analysis. It reads no request data itself: the nav is a client
 * component that takes the run id from the URL, inside Suspense, so the page shell stays static.
 */
export default function RunLayout({ children }: LayoutProps<"/runs/[runId]">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<div className="h-10 border-b border-border" aria-hidden="true" />}>
        <RunNav />
      </Suspense>
      {children}
    </div>
  );
}
