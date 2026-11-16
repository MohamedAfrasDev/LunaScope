"use client";

import { useEffect, useRef } from "react";
import { moonPosition, sunDirection } from "@/lib/atlas/system";

const RAD = Math.PI / 180;
const SIZE = 240;
const C = SIZE / 2;
const R_EARTH = 58;
const R_SUN = 100;
const TRAIL_DEG = 70;

/** Longitude along the ecliptic (degrees) of a direction in the frame lib/atlas/system.ts uses. */
const lon = (v: [number, number, number]): number => Math.atan2(-v[2], v[0]) / RAD;

const at = (deg: number, r: number) => ({ x: C + r * Math.cos(deg * RAD), y: C - r * Math.sin(deg * RAD) });

/** Where the Earth and the Sun are, from the Moon, as angles round it (degrees). The rings are schematic; only the directions are real. */
function angles(utcMs: number) {
  const earth = lon(moonPosition(utcMs)) + 180; // from the Moon, the Earth is opposite the Moon's own direction from the Earth
  const sun = lon(sunDirection(utcMs));
  return { earth, sun };
}

const trailPath = (deg: number, r: number): string => {
  const pts: string[] = [];
  for (let i = 0; i <= 18; i++) {
    const p = at(deg - TRAIL_DEG * (1 - i / 18), r); // from TRAIL_DEG behind the body up to the body
    pts.push(`${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  return pts.join(" ");
};

/**
 * The Moon scale's companion picture: the Moon at the centre, with the Earth and the Sun going round it as they appear from the Moon
 * (seen from above the ecliptic). It follows the Atlas clock and, while time plays, draws every frame from the clock's own rate, so the
 * Earth and Sun glide round instead of stepping. Rings are schematic; the directions are real (a low-precision series, a display estimate).
 */
export function MoonOrbitHud({ utcMs, playing = false, rate = 0, lo, hi }: { utcMs: number; playing?: boolean; rate?: number; lo: number; hi: number }) {
  const live = useRef({ utcMs, at: 0, playing, rate, lo, hi });
  const earthDot = useRef<SVGCircleElement>(null);
  const sunDot = useRef<SVGCircleElement>(null);
  const earthText = useRef<SVGTextElement>(null);
  const sunText = useRef<SVGTextElement>(null);
  const ray = useRef<SVGLineElement>(null);
  const earthTrail = useRef<SVGPathElement>(null);
  const sunTrail = useRef<SVGPathElement>(null);
  const frame = useRef(0);

  const place = useRef(() => {});
  place.current = () => {
    const l = live.current;
    const now = l.playing ? Math.min(Math.max(l.utcMs + (performance.now() - l.at) * l.rate, l.lo), l.hi) : l.utcMs;
    const a = angles(now);
    const e = at(a.earth, R_EARTH);
    const s = at(a.sun, R_SUN);
    const el = at(a.earth, R_EARTH + 17);
    const sl = at(a.sun, R_SUN + 15);
    earthDot.current?.setAttribute("cx", String(e.x));
    earthDot.current?.setAttribute("cy", String(e.y));
    sunDot.current?.setAttribute("cx", String(s.x));
    sunDot.current?.setAttribute("cy", String(s.y));
    earthText.current?.setAttribute("x", String(el.x));
    earthText.current?.setAttribute("y", String(el.y + 3));
    sunText.current?.setAttribute("x", String(sl.x));
    sunText.current?.setAttribute("y", String(sl.y + 3));
    ray.current?.setAttribute("x2", String(s.x));
    ray.current?.setAttribute("y2", String(s.y));
    earthTrail.current?.setAttribute("d", trailPath(a.earth, R_EARTH));
    sunTrail.current?.setAttribute("d", trailPath(a.sun, R_SUN));
  };

  useEffect(() => {
    // keep our own steady time while playing; re-sync only when something real changed (see SystemView)
    const l = live.current;
    const cur = l.playing ? Math.min(Math.max(l.utcMs + (performance.now() - l.at) * l.rate, l.lo), l.hi) : l.utcMs;
    const changed = l.playing !== playing || l.rate !== rate || l.lo !== lo;
    const drifted = Math.abs(utcMs - cur) > Math.max(600 * Math.abs(rate), 1000);
    if (changed || drifted || !playing) live.current = { utcMs, at: performance.now(), playing, rate, lo, hi };
    else live.current.hi = hi;
    place.current();
    if (!playing) return;
    const loop = () => {
      place.current();
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame.current);
  }, [utcMs, playing, rate, lo, hi]);

  return (
    <figure
      className="atlas-panel pointer-events-none absolute bottom-[9.5rem] right-3 z-10 m-0 hidden p-2 md:block"
      data-testid="moon-orbit-hud"
      aria-label="The Earth and the Sun going round the Moon, as seen from the Moon"
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-hidden="true">
        <circle cx={C} cy={C} r={R_EARTH} fill="none" stroke="#5d7fb5" strokeOpacity="0.7" strokeDasharray="3 4" />
        <circle cx={C} cy={C} r={R_SUN} fill="none" stroke="#c9a24d" strokeOpacity="0.6" strokeDasharray="3 4" />
        <path ref={earthTrail} fill="none" stroke="#4f8de6" strokeWidth="2.5" strokeOpacity="0.55" strokeLinecap="round" />
        <path ref={sunTrail} fill="none" stroke="#ffc46e" strokeWidth="2.5" strokeOpacity="0.55" strokeLinecap="round" />
        <line ref={ray} x1={C} y1={C} x2={C} y2={C} stroke="#ffc46e" strokeOpacity="0.3" />
        <circle cx={C} cy={C} r={12} fill="#cfcbc2" />
        <circle cx={C - 3} cy={C - 3} r={3} fill="#9a968d" />
        <text x={C} y={C + 26} fontSize="10" fill="#ffffff" textAnchor="middle" fontFamily="monospace">MOON</text>
        <circle ref={earthDot} r={8} fill="#4f8de6" stroke="#bfe0ff" strokeWidth="1.5" />
        <circle ref={sunDot} r={9} fill="#ffc46e" stroke="#fff3d0" strokeWidth="1.5" />
        <text ref={earthText} fontSize="10" fill="#7fb4ff" textAnchor="middle" fontFamily="monospace">EARTH</text>
        <text ref={sunText} fontSize="10" fill="#ffc46e" textAnchor="middle" fontFamily="monospace">SUN</text>
      </svg>
      <figcaption className="atlas-label text-center text-[var(--ink-dim)]">As seen from the Moon</figcaption>
    </figure>
  );
}
