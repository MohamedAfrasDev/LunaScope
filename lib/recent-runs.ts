"use client";

import { useSyncExternalStore } from "react";

/**
 * Recent runs, kept only in this browser (galaxy D5): the run id, when it was opened, and a label built from the
 * site names the service itself returned for that run. Nothing is invented, nothing is sent anywhere, and the
 * list can be cleared. Every storage access is guarded: with storage blocked the list is simply empty.
 */
export type RecentRun = { id: string; label: string; state?: string; openedAt: number };

const KEY = "lunascope.recent-runs";
const MAX = 8;
const RUN_ID = /^[0-9a-f]{64}$/;
const listeners = new Set<() => void>();
const EMPTY: RecentRun[] = [];

let raw: string | null | undefined; // the last string we parsed, so the snapshot is referentially stable
let parsed: RecentRun[] = EMPTY;
let memory: RecentRun[] | null = null; // when storage is blocked the list still holds for this page

function valid(x: unknown): x is RecentRun {
  const r = x as RecentRun;
  return !!r && typeof r.id === "string" && RUN_ID.test(r.id) && typeof r.label === "string" && typeof r.openedAt === "number";
}

function snapshot(): RecentRun[] {
  if (memory) return memory;
  let s: string | null = null;
  try {
    s = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (s === raw) return parsed;
  raw = s;
  try {
    const v: unknown = s ? JSON.parse(s) : [];
    parsed = Array.isArray(v) ? v.filter(valid).slice(0, MAX) : EMPTY;
  } catch {
    parsed = EMPTY;
  }
  return parsed;
}

function write(list: RecentRun[]) {
  memory = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    memory = null;
  } catch {
    /* storage unavailable: the in-memory list stands */
  }
  listeners.forEach((l) => l());
}

/** Put (or move) a run to the top. Calling it again for the same run only refreshes its label and time. */
export function rememberRun(run: Omit<RecentRun, "openedAt">): void {
  if (!RUN_ID.test(run.id)) return;
  const cur = snapshot();
  const prev = cur[0];
  if (prev && prev.id === run.id && prev.label === run.label && prev.state === run.state) return; // already on top: no churn
  write([{ ...run, openedAt: Date.now() }, ...cur.filter((r) => r.id !== run.id)].slice(0, MAX));
}

export function clearRecentRuns(): void {
  write([]);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      memory = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** The server render and the first client render both see an empty list, so they agree. */
export function useRecentRuns(): RecentRun[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** For tests only: forget everything cached in memory. */
export function resetRecentRunsForTests(): void {
  raw = undefined;
  parsed = EMPTY;
  memory = null;
}
