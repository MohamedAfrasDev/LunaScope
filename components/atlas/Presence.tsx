"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const PresentContext = createContext(true);
/** False while the scene is on its way out, so it can play its own leaving move (a camera dive) while it fades. */
export const usePresent = (): boolean => useContext(PresentContext);

/**
 * Fades a full-screen scene in when `show` turns on and out when it turns off, so changing scale (Moon, System, Site sky) is a
 * connected move and not a cut. While it leaves, the last thing it showed stays drawn (the data that produced it may already be
 * gone) and it lets the pointer through to what is underneath. Under reduced motion the change is immediate.
 */
export function Presence({ show, children, ms = 600 }: { show: boolean; children: ReactNode; ms?: number }) {
  const [exiting, setExiting] = useState(false);
  const [entered, setEntered] = useState(false);
  const last = useRef<ReactNode>(children);
  if (show) last.current = children;

  useEffect(() => {
    if (show) {
      setExiting(false);
      let a = 0;
      let b = 0;
      a = requestAnimationFrame(() => {
        b = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(a);
        cancelAnimationFrame(b);
      };
    }
    setEntered(false);
    setExiting(true);
    const id = window.setTimeout(() => setExiting(false), ms);
    return () => window.clearTimeout(id);
  }, [show, ms]);

  if (!show && !exiting) return null;
  const on = show && entered;
  return (
    <div
      className={`absolute inset-0 transition-[opacity,transform] duration-[600ms] ease-out motion-reduce:transition-none ${on ? "scale-100 opacity-100" : "scale-[1.12] opacity-0"} ${show ? "" : "pointer-events-none"}`}
      data-state={on ? "in" : "out"}
    >
      <PresentContext.Provider value={show}>{show ? children : last.current}</PresentContext.Provider>
    </div>
  );
}
