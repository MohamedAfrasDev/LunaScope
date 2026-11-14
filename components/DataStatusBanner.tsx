"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getJson } from "@/lib/api/client";
import type { Health } from "@/lib/api/types";
import { TONE_BOX, type Tone } from "./ui/tone";

type State = { kind: "loading" } | { kind: "down" } | { kind: "ok"; h: Health };

const Ctx = createContext<State>({ kind: "loading" });

/**
 * Polls the service health once and shares it with the status pill and the unreachable banner,
 * so the page never asks twice. It reports what the service says, and says so plainly when it
 * cannot be reached.
 */
export function DataStatusProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const load = () =>
      getJson<Health>("health", ctl.signal)
        .then((h) => alive && setS({ kind: "ok", h }))
        .catch((e) => alive && !(e instanceof DOMException) && setS({ kind: "down" }));
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      ctl.abort();
      clearInterval(t);
    };
  }, []);

  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

const SYNTHETIC_TEXT = "Synthetic demonstration data: values are invented test fixtures, not lunar results.";
const REAL_TEXT =
  "Real data, unverified: no validation gate has closed. Screening and education only, not flight-qualified.";
const REPLAY_TEXT = "This is an offline copy: it shows saved runs only and cannot compute new ones.";

/**
 * Persistent data-status label (spec 7: stays until the real resources are verified). The state is
 * always visible in the header as icon + words; the full sentence is one click away.
 */
export function DataStatusPill() {
  const s = useContext(Ctx);
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  // Escape closes the panel and returns focus to the pill; a click elsewhere closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        ref.current?.removeAttribute("open");
        setOpen(false);
        ref.current?.querySelector("summary")?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        ref.current.removeAttribute("open");
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  if (s.kind === "down") return null; // the unreachable banner carries this state
  if (s.kind === "loading")
    return (
      <span role="status" className={`rounded-full border px-3 py-1 text-xs ${TONE_BOX.muted}`}>
        Checking the science service…
      </span>
    );

  const synthetic = s.h.stack === "synthetic";
  const tone: Tone = synthetic ? "warn" : "info";
  const icon = synthetic ? "◆" : "◇";
  const label = synthetic ? "Synthetic demonstration data" : "Real data, unverified";
  const replay = s.h.mode === "replay";

  return (
    <div role="status" className="sm:relative">
      <details
        ref={ref}
        className="group"
        onToggle={(e) => setOpen(e.currentTarget.open)}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !ref.current?.open) return;
          ref.current.removeAttribute("open");
          setOpen(false);
          ref.current.querySelector("summary")?.focus();
        }}
      >
        <summary
          className={`flex cursor-pointer list-none items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium [&::-webkit-details-marker]:hidden ${TONE_BOX[tone]}`}
        >
          <span aria-hidden="true">{icon}</span>
          <span>{label}</span>
          {replay && (
            <span className="rounded-full border border-current px-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide">
              Replay mode
            </span>
          )}
          <span className="sr-only">: show details</span>
          <svg aria-hidden="true" viewBox="0 0 10 6" className="h-1.5 w-2.5 transition-transform group-open:rotate-180">
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </summary>
        <div className="absolute inset-x-4 top-full z-50 mt-2 rounded-lg sm:inset-x-auto sm:right-0 sm:w-[26rem] border border-border bg-surface p-4 text-sm leading-6 shadow-lg">
          <p>
            <span className="font-medium">Data status: </span>
            {synthetic ? SYNTHETIC_TEXT : REAL_TEXT}
          </p>
          {replay && <p className="mt-2">{REPLAY_TEXT}</p>}
          <p className="mt-2 text-xs text-muted">
            Every result also carries its own label.
          </p>
        </div>
      </details>
    </div>
  );
}

/** The one state that must not be easy to miss: nothing can be computed or shown. */
export function DataStatusAlert() {
  const s = useContext(Ctx);
  if (s.kind !== "down") return null;
  return (
    <div role="status" className={`border-b px-4 py-2 text-center text-sm font-medium ${TONE_BOX.fail}`}>
      <span className="font-medium">Data status: </span>
      Science service not reachable. No results can be computed or shown right now.
    </div>
  );
}
