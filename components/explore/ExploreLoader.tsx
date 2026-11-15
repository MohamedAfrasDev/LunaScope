"use client";

import dynamic from "next/dynamic";

/** The viewer is client-only and loads on demand, so no other page pays for it. */
const ExploreViewer = dynamic(() => import("./ExploreViewer").then((m) => m.ExploreViewer), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="grid h-[min(72svh,720px)] min-h-[420px] place-items-center rounded-xl border border-border bg-card text-sm text-muted-foreground"
    >
      Loading the Moon…
    </div>
  ),
});

export function ExploreLoader() {
  return <ExploreViewer />;
}
