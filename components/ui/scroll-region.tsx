"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A box that scrolls sideways (a wide table on a phone). When, and only when, it really overflows, it becomes a named
 * region the keyboard can reach, so someone without a pointer can scroll it with the arrow keys (WCAG 2.1.1). When
 * everything fits it adds no tab stop and no landmark.
 */
export function ScrollRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      const scrollable = el.scrollWidth > el.clientWidth + 1;
      if (scrollable) {
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "region");
        el.setAttribute("aria-label", label);
      } else {
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
        el.removeAttribute("aria-label");
      }
    };
    sync();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => ro?.disconnect();
  }, [label]);

  return (
    <div ref={ref} className={cn("overflow-x-auto", className)}>
      {children}
    </div>
  );
}
