"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";
import { usePresent } from "@/components/atlas/Presence";
import { EARTH_IMAGE } from "@/lib/atlas/sky-look";
import { FALLBACK_TEXTURE as MOON_IMAGE } from "@/lib/explore/geometry";
import { cloudCanvas, earthCanvas } from "@/lib/atlas/textures";
import { EARTH_RADIUS_KM, MOON_RADIUS_KM, OBLIQUITY_DEG, UNIT_KM, earthTurnDeg, moonPosition, orbitLoop, orbitSpan, sunDirection } from "@/lib/atlas/system";

/** The Earth and Moon are drawn this many times larger than true size, so they can be seen. */
export const SYSTEM_SCALE_UP = 6;
/** Picture scales: the Sun-Earth distance, the Sun's size and the Moon's orbit are all schematic (the real ones cannot share one frame). */
const EARTH_ORBIT = 130;
const SUN_RADIUS = 11;
const MOON_ORBIT_K = 0.5;
const RAD = Math.PI / 180;

export type Focus = "sun" | "earth" | "moon";
const FOCUS_VIEW: Record<Focus, { dist: number; label: string }> = {
  sun: { dist: 270, label: "Whole system" },
  earth: { dist: 40, label: "Earth" },
  moon: { dist: 8, label: "Moon" },
};

function labelSprite(THREE: typeof THREE_NS, text: string, color: string): THREE_NS.Sprite {
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 72;
  const g = c.getContext("2d");
  if (g) {
    g.font = "600 40px ui-monospace, Menlo, Consolas, monospace";
    g.textBaseline = "middle";
    g.fillStyle = color;
    g.shadowColor = "rgba(0,0,0,0.9)";
    g.shadowBlur = 8;
    g.fillText(text, 8, 36);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.center.set(0, 0.5);
  sp.renderOrder = 10;
  return sp;
}

function ringTexture(THREE: typeof THREE_NS, color: string): THREE_NS.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d");
  if (g) {
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(48, 48, 30, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2;
    g.globalAlpha = 0.6;
    g.beginPath();
    g.arc(48, 48, 40, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = 3;
    for (const [x1, y1, x2, y2] of [[48, 2, 48, 14], [48, 82, 48, 94], [2, 48, 14, 48], [82, 48, 94, 48]]) {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    }
    g.beginPath();
    g.arc(48, 48, 4, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

/**
 * The System scale: the Sun, the Earth and the Moon, all moving. The Earth goes round the Sun and the Moon round the Earth, with the
 * Sun's light on both, driven by the Atlas clock (it plays on its own when you arrive). Where the Sun is and which way each body points
 * are real (a low-precision series, see lib/atlas/system.ts); the sizes and the distances are NOT to scale, and the scene says so.
 * Buttons fly the camera between the whole system, the Earth and the Moon. Drag to turn, scroll or pinch to zoom.
 */
export function SystemView({ startMs, totalS, utcMs, playing = false, rate = 0 }: { startMs: number; totalS: number; utcMs: number; playing?: boolean; rate?: number }) {
  const box = useRef<HTMLDivElement>(null);
  // The clock commits to React about ten times a second, which would draw the scene at ten frames a second. Between commits the scene runs
  // its own frame loop and carries the time forward at the clock's rate (sim ms per real ms, negative in reverse), so playing is smooth.
  const live = useRef({ utcMs, at: 0, playing: false, rate: 0, lo: startMs, hi: startMs + totalS * 1000 });
  const nowMs = () => {
    const l = live.current;
    if (!l.playing) return l.utcMs;
    return Math.min(Math.max(l.utcMs + (performance.now() - l.at) * l.rate, l.lo), l.hi);
  };
  const redraw = useRef<(() => void) | null>(null);
  const flyRef = useRef<((f: Focus, ms?: number) => void) | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [focus, setFocus] = useState<Focus>("sun");
  const present = usePresent();
  const leave = useRef<((leaving: boolean) => void) | null>(null);
  useEffect(() => {
    leave.current?.(!present);
  }, [present]);

  useEffect(() => {
    // While time plays the scene keeps its own steady time and only re-syncs to the clock when something real changed (play, pause, speed,
    // a jump or a loop). Taking every commit would pull the time back a few milliseconds each time, which shows as stutter.
    const l = live.current;
    const cur = nowMs();
    const changed = l.playing !== playing || l.rate !== rate || l.lo !== startMs;
    const drifted = Math.abs(utcMs - cur) > Math.max(600 * Math.abs(rate), 1000);
    if (changed || drifted || !playing) live.current = { utcMs, at: performance.now(), playing, rate, lo: startMs, hi: startMs + totalS * 1000 };
    else live.current.hi = startMs + totalS * 1000;
    if (!playing) redraw.current?.();
  }, [utcMs, playing, rate, startMs, totalS]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = (await import("three")) as typeof THREE_NS;
      if (cancelled) return;
      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch {
        setOk(false);
        return;
      }
      setOk(true);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      const canvas = renderer.domElement;
      canvas.className = "block h-full w-full touch-none";
      canvas.tabIndex = 0;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "The Sun, the Earth and the Moon, moving along their orbits. Drag to turn the view; scroll to zoom.");
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#000000");
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 4000);
      const disposables: { dispose: () => void }[] = [];
      const track = <T extends { dispose: () => void }>(d: T): T => (disposables.push(d), d);

      // stars
      const starPos: number[] = [];
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 900; i++) {
        const u = rnd() * 2 - 1;
        const a = rnd() * Math.PI * 2;
        const r = 1800 * Math.sqrt(1 - u * u);
        starPos.push(r * Math.cos(a), 1800 * u, r * Math.sin(a));
      }
      const starGeo = track(new THREE.BufferGeometry());
      starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(starGeo, track(new THREE.PointsMaterial({ color: "#ffffff", size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.7 }))));

      // the Sun, at the centre, lighting everything: a white-hot core in layered warm bloom
      const sunLight = new THREE.PointLight("#fff4e0", 11, 0, 0);
      scene.add(sunLight, new THREE.AmbientLight("#9db4dc", 0.16));
      const bloom = (size: number, stops: [number, string][]) => {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const g = c.getContext("2d");
        if (g) {
          const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
          for (const [at, col] of stops) grad.addColorStop(at, col);
          g.fillStyle = grad;
          g.fillRect(0, 0, size, size);
        }
        return track(new THREE.CanvasTexture(c));
      };
      const sunLayers: [number, THREE_NS.CanvasTexture][] = [
        [SUN_RADIUS * 22, bloom(256, [[0, "rgba(255,214,150,0.30)"], [0.25, "rgba(255,170,90,0.12)"], [1, "rgba(255,140,60,0)"]])],
        [SUN_RADIUS * 9, bloom(256, [[0, "rgba(255,250,235,0.95)"], [0.2, "rgba(255,226,170,0.55)"], [0.55, "rgba(255,180,100,0.16)"], [1, "rgba(255,150,70,0)"]])],
        [SUN_RADIUS * 3.6, bloom(256, [[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,248,225,0.95)"], [0.7, "rgba(255,225,170,0.4)"], [1, "rgba(255,210,150,0)"]])],
      ];
      for (const [size, tex] of sunLayers) {
        const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })));
        sp.scale.set(size, size, 1);
        scene.add(sp);
      }
      scene.add(new THREE.Mesh(track(new THREE.SphereGeometry(SUN_RADIUS * 0.55, 32, 24)), track(new THREE.MeshBasicMaterial({ color: "#fffaf0", toneMapped: false }))));

      // the Earth's path round the Sun
      const ringPts: THREE_NS.Vector3[] = [];
      for (let i = 0; i <= 256; i++) ringPts.push(new THREE.Vector3(EARTH_ORBIT * Math.cos((i / 256) * Math.PI * 2), 0, EARTH_ORBIT * Math.sin((i / 256) * Math.PI * 2)));
      const earthRingGeo = track(new THREE.BufferGeometry().setFromPoints(ringPts));
      const earthRing = new THREE.Line(earthRingGeo, track(new THREE.LineDashedMaterial({ color: "#6f93cc", dashSize: 3, gapSize: 3, transparent: true, opacity: 0.7 })));
      earthRing.computeLineDistances();
      scene.add(earthRing);

      // the Earth, tilted, turning
      const earthR = (EARTH_RADIUS_KM / UNIT_KM) * SYSTEM_SCALE_UP;
      const earthGroup = new THREE.Group();
      scene.add(earthGroup);
      const earthTilt = new THREE.Group();
      earthTilt.rotation.x = -OBLIQUITY_DEG * RAD;
      earthGroup.add(earthTilt);
      const earthTex = track(new THREE.CanvasTexture(earthCanvas(512, 256) ?? document.createElement("canvas")));
      earthTex.colorSpace = THREE.SRGBColorSpace;
      const earthMat = track(new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.55, metalness: 0.05 }));
      const earth = new THREE.Mesh(track(new THREE.SphereGeometry(earthR, 64, 48)), earthMat);
      earthTilt.add(earth);
      new THREE.TextureLoader().load(EARTH_IMAGE, (tex) => {
        if (cancelled) return tex.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        earthMat.map = tex;
        earthMat.needsUpdate = true;
        disposables.push(tex);
        redraw.current?.();
      });
      // clouds, a little above the ground, drifting slower than the ground turns
      const cloudTex = track(new THREE.CanvasTexture(cloudCanvas(1024, 512) ?? document.createElement("canvas")));
      cloudTex.colorSpace = THREE.SRGBColorSpace;
      const clouds = new THREE.Mesh(
        track(new THREE.SphereGeometry(earthR * 1.012, 64, 48)),
        track(new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, depthWrite: false, roughness: 1, metalness: 0 })),
      );
      earthTilt.add(clouds);
      // the blue rim of the atmosphere, brightest at the edge
      const atmo = new THREE.Mesh(
        track(new THREE.SphereGeometry(earthR * 1.14, 64, 48)),
        track(
          new THREE.ShaderMaterial({
            vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
            fragmentShader: "varying vec3 vN; void main(){ float i = pow(max(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 0.0), 3.0); gl_FragColor = vec4(0.32, 0.6, 1.0, 1.0) * i * 1.15; }",
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
          }),
        ),
      );
      earthGroup.add(atmo);

      // the Moon's path round the Earth (follows the Earth), and the stretch the clock window covers
      const toVec = (p: [number, number, number]) => new THREE.Vector3(p[0] * MOON_ORBIT_K, p[1] * MOON_ORBIT_K, p[2] * MOON_ORBIT_K);
      const loopGeo = track(new THREE.BufferGeometry().setFromPoints(orbitLoop(startMs).map(toVec)));
      const moonLoop = new THREE.Line(loopGeo, track(new THREE.LineDashedMaterial({ color: "#aab4cc", dashSize: 0.9, gapSize: 0.9, transparent: true, opacity: 0.75 })));
      moonLoop.computeLineDistances();
      earthGroup.add(moonLoop);
      const spanGeo = track(new THREE.BufferGeometry().setFromPoints(orbitSpan(startMs, startMs + totalS * 1000).map(toVec)));
      earthGroup.add(new THREE.Line(spanGeo, track(new THREE.LineBasicMaterial({ color: "#7fb4ff" }))));

      // the Moon
      const moonR = (MOON_RADIUS_KM / UNIT_KM) * SYSTEM_SCALE_UP;
      const moonMat = track(new THREE.MeshStandardMaterial({ color: "#c9c6bf", roughness: 1, metalness: 0 }));
      const moon = new THREE.Mesh(track(new THREE.SphereGeometry(moonR, 64, 48)), moonMat);
      // the real Moon: NASA's LRO picture (bundled with the Explore view) replaces the plain grey once it has loaded
      new THREE.TextureLoader().load(MOON_IMAGE, (tex) => {
        if (cancelled) return tex.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        moonMat.map = tex;
        moonMat.color.set("#ffffff");
        moonMat.needsUpdate = true;
        disposables.push(tex);
        redraw.current?.();
      });
      scene.add(moon);

      // labels and target rings, kept the same size on screen wherever the camera is
      const sunLabel = labelSprite(THREE, "SUN", "#ffc46e");
      const earthLabel = labelSprite(THREE, "EARTH", "#7fb4ff");
      const moonLabel = labelSprite(THREE, "MOON", "#ffffff");
      scene.add(sunLabel, earthLabel, moonLabel);
      const mkRing = (color: string) => {
        const tex = track(ringTexture(THREE, color));
        const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
        s.renderOrder = 9;
        scene.add(s);
        return s;
      };
      const earthMark = mkRing("#7fb4ff");
      const moonMark = mkRing("#ffffff");

      // positions at a time, in scene units: the Sun at the origin, the Earth opposite the Sun's direction, the Moon round the Earth
      const bodies = (now: number) => {
        const sd = sunDirection(now);
        const e = new THREE.Vector3(-sd[0] * EARTH_ORBIT, -sd[1] * EARTH_ORBIT, -sd[2] * EARTH_ORBIT);
        const m0 = moonPosition(now);
        const m = e.clone().add(new THREE.Vector3(m0[0] * MOON_ORBIT_K, m0[1] * MOON_ORBIT_K, m0[2] * MOON_ORBIT_K));
        return { sun: new THREE.Vector3(0, 0, 0), earth: e, moon: m };
      };

      // camera: orbits a target that glides between the Sun, the Earth and the Moon (Google Earth style moves, with real bodies moving)
      const view = { yaw: 0.6, pitch: 0.7, dist: FOCUS_VIEW.sun.dist, focus: "sun" as Focus, from: new THREE.Vector3(), k: 1 };
      const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      let raf = 0;
      let w = 1;
      let h = 1;
      const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      const target = (b: ReturnType<typeof bodies>) => view.from.clone().lerp(b[view.focus], view.k);

      const draw = () => {
        const now = nowMs();
        const b = bodies(now);
        sunLight.position.set(0, 0, 0);
        earthGroup.position.copy(b.earth);
        earth.rotation.y = earthTurnDeg(now) * RAD;
        moon.position.copy(b.moon);
        moon.rotation.y = Math.atan2(-(b.earth.z - b.moon.z), b.earth.x - b.moon.x); // the near side (longitude 0) faces the Earth
        clouds.rotation.y = -1.5 * RAD * ((now / 86400000) % 240); // the cloud deck drifts against the ground
        const tg = target(b);
        camera.aspect = w / h;
        camera.position.set(view.dist * Math.cos(view.pitch) * Math.cos(view.yaw), view.dist * Math.sin(view.pitch), view.dist * Math.cos(view.pitch) * Math.sin(view.yaw)).add(tg);
        camera.lookAt(tg);
        camera.updateProjectionMatrix();
        // screen-constant sizes
        const px = (view.dist * 2 * Math.tan(20 * RAD)) / h; // world units per pixel at the target
        const lab = 17 * px;
        for (const [l, p] of [[sunLabel, b.sun], [earthLabel, b.earth], [moonLabel, b.moon]] as const) {
          l.scale.set(lab * 5.33, lab, 1);
          l.position.copy(p).add(new THREE.Vector3(px * 16, px * 16, 0));
        }
        sunLabel.position.x += SUN_RADIUS;
        earthMark.scale.set(px * 34, px * 34, 1);
        earthMark.position.copy(b.earth);
        moonMark.scale.set(px * 26, px * 26, 1);
        moonMark.position.copy(b.moon);
        renderer.render(scene, camera);
      };
      redraw.current = draw;

      const fly = (f: Focus, ms = 2200) => {
        cancelAnimationFrame(raf);
        const b = bodies(nowMs());
        const goalDist = FOCUS_VIEW[f].dist;
        const from = target(b);
        const d0 = view.dist;
        const yaw0 = view.yaw;
        const pitch0 = view.pitch;
        // close to a planet the camera comes round to the Sun's side, so the lit face is the one you see
        let yawGoal = yaw0;
        let pitchGoal = f === "sun" ? Math.max(pitch0, 0.7) : 0.35;
        if (f !== "sun") {
          const body = b[f];
          yawGoal = Math.atan2(-body.z, -body.x) + 0.3;
          yawGoal = yaw0 + ((((yawGoal - yaw0) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; // the short way round
        }
        view.from = from;
        view.focus = f;
        view.k = 0;
        setFocus(f);
        if (reduce) {
          view.k = 1;
          view.dist = goalDist;
          view.yaw = yawGoal;
          view.pitch = pitchGoal;
          draw();
          return;
        }
        const t0 = performance.now();
        const step = (now: number) => {
          const k = ease(Math.min((now - t0) / ms, 1));
          view.k = k;
          // the distance moves on a log scale, so the zoom feels even from close in to far out
          view.dist = Math.exp(Math.log(d0) + (Math.log(goalDist) - Math.log(d0)) * k);
          view.yaw = yaw0 + (yawGoal - yaw0) * k;
          view.pitch = pitch0 + (pitchGoal - pitch0) * k;
          draw();
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      };
      flyRef.current = (f, ms) => fly(f, ms);
      leave.current = (leaving) => (leaving ? fly("moon", 700) : fly("sun", 2200));

      let frame = 0;
      const loop = () => {
        if (live.current.playing) draw();
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);

      const resize = () => {
        w = Math.max(el.clientWidth, 1);
        h = Math.max(el.clientHeight, 1);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(w, h, false);
        draw();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();

      // arrive close to the Earth and the Moon, then pull out to see the whole system moving
      view.focus = "earth";
      view.dist = 30;
      view.from = bodies(nowMs()).earth;
      view.k = 1;
      draw();
      fly("sun", 3200);

      // drag to turn, wheel and pinch to zoom, arrow keys for the keyboard
      const clampDist = (d: number) => Math.min(Math.max(d, 4), 1300);
      const pointers = new Map<number, { x: number; y: number }>();
      let pinch = 0;
      const down = (e: PointerEvent) => {
        canvas.setPointerCapture?.(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        pinch = 0;
      };
      const move = (e: PointerEvent) => {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        if (pointers.size === 2) {
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const [a, c] = [...pointers.values()];
          const d = Math.hypot(a.x - c.x, a.y - c.y);
          if (pinch) view.dist = clampDist(view.dist * (pinch / d));
          pinch = d;
        } else {
          view.yaw -= (e.clientX - p.x) * 0.006;
          view.pitch = Math.min(Math.max(view.pitch + (e.clientY - p.y) * 0.006, -1.45), 1.45);
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        draw();
      };
      const up = (e: PointerEvent) => {
        pointers.delete(e.pointerId);
        pinch = 0;
      };
      const wheel = (e: WheelEvent) => {
        e.preventDefault();
        view.dist = clampDist(view.dist * Math.exp(e.deltaY * 0.001));
        draw();
      };
      const key = (e: KeyboardEvent) => {
        const step = 0.08;
        if (e.key === "ArrowLeft") view.yaw += step;
        else if (e.key === "ArrowRight") view.yaw -= step;
        else if (e.key === "ArrowUp") view.pitch = Math.min(view.pitch + step, 1.45);
        else if (e.key === "ArrowDown") view.pitch = Math.max(view.pitch - step, -1.45);
        else return;
        e.preventDefault();
        draw();
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      canvas.addEventListener("wheel", wheel, { passive: false });
      canvas.addEventListener("keydown", key);

      cleanup = () => {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(raf);
        leave.current = null;
        flyRef.current = null;
        redraw.current = null;
        ro.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        canvas.removeEventListener("pointercancel", up);
        canvas.removeEventListener("wheel", wheel);
        canvas.removeEventListener("keydown", key);
        for (const d of disposables) d.dispose();
        for (const l of [sunLabel, earthLabel, moonLabel]) {
          (l.material.map as THREE_NS.Texture | null)?.dispose();
          l.material.dispose();
        }
        renderer.dispose();
        canvas.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [startMs, totalS]);

  return (
    <div className="absolute inset-0 bg-black" data-testid="system-view">
      <div ref={box} className="absolute inset-0" />
      <div role="group" aria-label="Camera" className="pointer-events-auto absolute bottom-[9.5rem] left-1/2 z-10 flex -translate-x-1/2 gap-1">
        {(Object.keys(FOCUS_VIEW) as Focus[]).map((f) => (
          <button key={f} type="button" className="atlas-key atlas-label" aria-pressed={focus === f} onClick={() => flyRef.current?.(f)}>
            {FOCUS_VIEW[f].label}
          </button>
        ))}
      </div>
      {ok === false && (
        <p role="alert" className="atlas-panel atlas-prose absolute left-1/2 top-1/2 max-w-md -translate-x-1/2 -translate-y-1/2 px-4 py-3 text-sm text-[var(--ink)]">
          This browser cannot draw 3D graphics, so the Sun, Earth and Moon are not drawn.
        </p>
      )}
    </div>
  );
}
