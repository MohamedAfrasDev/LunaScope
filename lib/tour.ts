"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the page tour has been offered and answered (started or dismissed). Per browser, guarded, and the tour never
 * reopens by itself: after the first answer it is only available when asked for (the palette, or the offer's own link).
 */
const KEY = "lunascope.tour";
const OPEN = "lunascope:tour";
const listeners = new Set<() => void>();
let memory = false;

function read(): boolean {
  if (memory) return true;
  try {
    return localStorage.getItem(KEY) === "seen";
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  memory = true;
  try {
    localStorage.setItem(KEY, "seen");
  } catch {
    /* storage unavailable: it holds for this page only */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** The server render and first paint assume "seen", so the offer never flashes in for someone who already answered. */
export function useTourSeen(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}

/** Ask the tour on the current page to start (the palette uses this). Does nothing where there is no tour. */
export function startTour(): void {
  window.dispatchEvent(new Event(OPEN));
}
export const TOUR_EVENT = OPEN;

/** For tests only. */
export function resetTourForTests(): void {
  memory = false;
}
