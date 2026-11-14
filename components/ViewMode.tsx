"use client";

import { useSyncExternalStore } from "react";

/**
 * Guided / Technical view (FR-14). Guided adds plain-language sentences built from fixed templates;
 * Technical shows the service's own wording and numbers. Both are always available. The choice is a
 * per-browser convenience, so every storage access is guarded and the app works without it.
 */
export type ViewMode = "guided" | "technical";
const KEY = "lunascope.view-mode";
const listeners = new Set<() => void>();

function read(): ViewMode {
  try {
    return localStorage.getItem(KEY) === "technical" ? "technical" : "guided";
  } catch {
    return "guided";
  }
}

let memory: ViewMode | null = null; // when storage is blocked, the choice still holds for this page

function snapshot(): ViewMode {
  return memory ?? read();
}

export function setViewMode(m: ViewMode): void {
  memory = m;
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* storage unavailable: the in-memory choice stands */
  }
  listeners.forEach((l) => l());
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

/** The server render and the first client render both use "guided", so they agree. */
export function useViewMode(): ViewMode {
  return useSyncExternalStore(subscribe, snapshot, () => "guided");
}

export function ViewModeToggle() {
  const mode = useViewMode();
  return (
    <div role="group" aria-label="Explanation style" className="flex items-center gap-1 text-xs">
      {(["guided", "technical"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setViewMode(m)}
          className={`rounded border px-2 py-1 ${mode === m ? "border-accent bg-surface-2 font-semibold" : "border-border text-muted"}`}
        >
          {m === "guided" ? "Guided" : "Technical"}
        </button>
      ))}
    </div>
  );
}
