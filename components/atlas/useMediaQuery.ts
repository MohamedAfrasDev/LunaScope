"use client";

import { useSyncExternalStore } from "react";

/** Whether a media query matches, kept live. The server and the first paint say no, so the desktop layout is the default. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia?.(query);
      mql?.addEventListener?.("change", cb);
      return () => mql?.removeEventListener?.("change", cb);
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

/** Phone-sized windows: panels become one bottom sheet at a time, and the bar and the dock fold their extras away. */
export const PHONE_QUERY = "(max-width: 767px)";
