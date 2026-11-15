"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { markTourSeen, TOUR_EVENT, useTourSeen } from "@/lib/tour";

type Step = { selector: string; title: string; text: string };

/** The five things worth knowing on a run page. The wording follows the user guide; a step whose target is absent is skipped. */
export const TOUR_STEPS: Step[] = [
  {
    selector: '[data-tour="verdict"]',
    title: "The verdict, by requirement",
    text: "For the Sun and for Earth, whether even the lowest estimate meets the requirement. Time that cannot be confirmed either way is kept as unknown. It is never counted as an outage.",
  },
  {
    selector: '[data-tour="cards"]',
    title: "One card per site",
    text: "Each card shows the terrain-aware result that counts, the availability range, and what a flat horizon would have said, for comparison only.",
  },
  {
    selector: 'nav[aria-label="Analysis views"]',
    title: "Views of this analysis",
    text: "The matrix, timeline, sky, comparison, Time Machine and evidence are all tabs of the same run.",
  },
  {
    selector: "main details",
    title: "Detail stays one click away",
    text: "The full comparison table and the other detail are folded. Open them when you want the numbers.",
  },
  {
    selector: 'header [role="status"]',
    title: "The data label",
    text: "Always in view: it says whether the results are synthetic demonstration data or real data that has not been verified.",
  },
];

/**
 * A short, skippable tour of a finished run (galaxy D8). It is offered once, as a quiet line above the results; it never
 * opens by itself, never traps focus, and can be started again from the command palette. Each step outlines the part of
 * the page it talks about.
 */
export function RunTour() {
  const seen = useTourSeen();
  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const start = useCallback(() => {
    const present = TOUR_STEPS.filter((s) => document.querySelector(s.selector));
    if (present.length === 0) return;
    markTourSeen();
    setSteps(present);
    setI(0);
  }, []);
  const end = useCallback(() => {
    markTourSeen();
    setI(null);
  }, []);

  useEffect(() => {
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, [start]);

  // outline the step's target, bring it into view, and move focus to the step so a keyboard or screen-reader user follows
  useEffect(() => {
    if (i === null) return;
    const el = document.querySelector(steps[i].selector);
    el?.setAttribute("data-tour-active", "true");
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView?.({ block: "center", behavior: calm ? "auto" : "smooth" });
    heading.current?.focus({ preventScroll: true });
    return () => el?.removeAttribute("data-tour-active");
  }, [i, steps]);

  useEffect(() => {
    if (i === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [i, end]);

  if (i === null) {
    if (seen) return null;
    return (
      <div role="region" aria-label="Page tour offer" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        <span>New here? A one-minute tour shows what is on this page.</span>
        <Button type="button" size="sm" onClick={start}>
          Take the tour
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={end}>
          No thanks
        </Button>
      </div>
    );
  }

  const s = steps[i];
  const last = i === steps.length - 1;
  return (
    <section
      aria-label="Page tour"
      className="chrome-glass fixed bottom-4 left-1/2 z-40 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-border bg-popover p-4 shadow-lg"
    >
      <p className="text-xs text-muted-foreground">
        Step {i + 1} of {steps.length}
      </p>
      <h2 ref={heading} tabIndex={-1} className="mt-0.5 text-base font-semibold outline-none">
        {s.title}
      </h2>
      <p aria-live="polite" className="mt-1 text-sm leading-6 text-muted-foreground">
        {s.text}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={end}>
          End tour
        </Button>
        <span className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>
            Back
          </Button>
          <Button type="button" size="sm" onClick={() => (last ? end() : setI(i + 1))}>
            {last ? "Done" : "Next"}
          </Button>
        </span>
      </div>
    </section>
  );
}
