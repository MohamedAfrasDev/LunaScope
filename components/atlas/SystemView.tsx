"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";
import { EARTH_IMAGE } from "@/lib/atlas/sky-look";
import { earthCanvas, glowCanvas, regolithCanvas } from "@/lib/atlas/textures";
import {
  EARTH_RADIUS_KM,
  MOON_RADIUS_KM,
  OBLIQUITY_DEG,
  UNIT_KM,
  earthTurnDeg,
  moonPosition,
  orbitLoop,
  orbitSpan,
  sunDirection,
} from "@/lib/atlas/system";

/** The Earth and Moon are drawn this many times larger than true size so they can be seen at orbital distance. */
export const SYSTEM_SCALE_UP = 6;
const SUN_FAR = 90;
const RAD = Math.PI / 180;

type Live = { utcMs: number; paths: boolean };

function labelSprite(THREE: typeof THREE_NS, text: string, color: string, height: number): THREE_NS.Sprite {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d");
  if (g) {
    g.font = "600 44px ui-monospace, Menlo, Consolas, monospace";
    g.textBaseline = "middle";
    g.fillStyle = color;
    g.shadowColor = "rgba(0,0,0,0.9)";
    g.shadowBlur = 8;
    g.fillText(text, 8, 48);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(height * (512 / 96), height, 1);
  sp.center.set(0, 0.5);
  sp.renderOrder = 10;
  return sp;
}

/**
 * The System scale: the Earth and the Moon's full orbit seen from above, with the direction of the Sun and the Sun's light on both.
 * It follows the Atlas clock, so playing the time dock moves the Moon along its orbit and turns the Earth. Positions come from a
 * low-precision series (see lib/atlas/system.ts), so this is a display estimate, and the Earth and Moon are drawn at 6x size.
 * Drag to turn the view, scroll or pinch to zoom.
 */
export function SystemView({ startMs, totalS, utcMs }: { startMs: number; totalS: number; utcMs: number }) {
  const box = useRef<HTMLDivElement>(null);
  const live = useRef<Live>({ utcMs, paths: true });
  const redraw = useRef<(() => void) | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    live.current = { utcMs, paths: true };
    redraw.current?.();
  }, [utcMs]);

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
      const canvas = renderer.domElement;
      canvas.className = "block h-full w-full touch-none";
      canvas.tabIndex = 0;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "The Earth and the Moon's orbit, seen from above. Drag to turn the view; scroll to zoom.");
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#000000");
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
      const disposables: { dispose: () => void }[] = [];
      const track = <T extends { dispose: () => void }>(d: T): T => (disposables.push(d), d);

      // stars
      const starPos: number[] = [];
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 700; i++) {
        const u = rnd() * 2 - 1;
        const a = rnd() * Math.PI * 2;
        const r = 300 * Math.sqrt(1 - u * u);
        starPos.push(r * Math.cos(a), 300 * u, r * Math.sin(a));
      }
      const starGeo = track(new THREE.BufferGeometry());
      starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
      const starMat = track(new THREE.PointsMaterial({ color: "#ffffff", size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.7 }));
      scene.add(new THREE.Points(starGeo, starMat));

      // light from the Sun, and a little ambient so the night side is not pure black
      const sunLight = new THREE.DirectionalLight("#ffffff", 3.2);
      scene.add(sunLight, sunLight.target);
      scene.add(new THREE.AmbientLight("#8aa0c8", 0.12));

      // the Earth: its tilted axis, turned by the sidereal angle
      const earthTilt = new THREE.Group();
      earthTilt.rotation.x = -OBLIQUITY_DEG * RAD;
      scene.add(earthTilt);
      const earthR = (EARTH_RADIUS_KM / UNIT_KM) * SYSTEM_SCALE_UP;
      const earthGeo = track(new THREE.SphereGeometry(earthR, 64, 48));
      const earthTex = track(new THREE.CanvasTexture(earthCanvas(512, 256) ?? document.createElement("canvas")));
      earthTex.colorSpace = THREE.SRGBColorSpace;
      const earthMat = track(new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.9, metalness: 0 }));
      const earth = new THREE.Mesh(earthGeo, earthMat);
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
      const atmoTex = track(new THREE.CanvasTexture(glowCanvas(128, "rgba(120,170,255,0)", "rgba(110,170,255,0.30)") ?? document.createElement("canvas")));
      const atmo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: atmoTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
      atmo.scale.set(earthR * 3.4, earthR * 3.4, 1);
      scene.add(atmo);
      const earthLabel = labelSprite(THREE, "EARTH", "#7fb4ff", 3.2);
      earthLabel.position.set(earthR * 0.9, earthR * 0.9, 0);
      scene.add(earthLabel);

      // the Moon, at 6x
      const moonR = (MOON_RADIUS_KM / UNIT_KM) * SYSTEM_SCALE_UP;
      const moonGeo = track(new THREE.SphereGeometry(moonR, 40, 28));
      const regolith = regolithCanvas(256);
      const moonTex = regolith ? track(new THREE.CanvasTexture(regolith)) : null;
      if (moonTex) moonTex.colorSpace = THREE.SRGBColorSpace;
      const moonMat = track(new THREE.MeshStandardMaterial({ ...(moonTex ? { map: moonTex } : { color: "#bdb9b0" }), roughness: 1, metalness: 0 }));
      const moon = new THREE.Mesh(moonGeo, moonMat);
      scene.add(moon);
      const moonLabel = labelSprite(THREE, "MOON", "#ffffff", 3.2);
      scene.add(moonLabel);

      // the full orbit (one month), and the stretch the loaded run covers
      const toVec = (p: [number, number, number]) => new THREE.Vector3(p[0], p[1], p[2]);
      const loopGeo = track(new THREE.BufferGeometry().setFromPoints(orbitLoop(startMs).map(toVec)));
      const loopMat = track(new THREE.LineBasicMaterial({ color: "#6b7a99", transparent: true, opacity: 0.55 }));
      const loop = new THREE.Line(loopGeo, loopMat);
      scene.add(loop);
      const spanGeo = track(new THREE.BufferGeometry().setFromPoints(orbitSpan(startMs, startMs + totalS * 1000).map(toVec)));
      const spanMat = track(new THREE.LineBasicMaterial({ color: "#7fb4ff" }));
      const span = new THREE.Line(spanGeo, spanMat);
      scene.add(span);

      // the Sun: far off the frame, so only its direction is drawn
      const sunGroup = new THREE.Group();
      const sunTex = track(new THREE.CanvasTexture(glowCanvas(128, "rgba(255,250,235,1)", "rgba(255,196,110,0.5)") ?? document.createElement("canvas")));
      const sunSprite = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
      sunSprite.scale.set(7, 7, 1);
      sunGroup.add(sunSprite);
      const sunLabel = labelSprite(THREE, "TO THE SUN (OFF SCALE)", "#ffc46e", 3.4);
      sunLabel.position.set(4, 0, 0);
      sunGroup.add(sunLabel);
      scene.add(sunGroup);
      const rayGeo = track(new THREE.BufferGeometry());
      const rayMat = track(new THREE.LineBasicMaterial({ color: "#ffc46e", transparent: true, opacity: 0.35 }));
      const ray = new THREE.Line(rayGeo, rayMat);
      scene.add(ray);

      // view: yaw and pitch around the Earth, and a distance
      const view = { yaw: 0.6, pitch: 0.75, dist: 175 };
      let w = 1;
      let h = 1;
      const draw = () => {
        const { utcMs: now } = live.current;
        const m = moonPosition(now);
        moon.position.set(m[0], m[1], m[2]);
        moonLabel.position.set(m[0] + moonR * 1.2, m[1] + moonR * 1.2, m[2]);
        const sd = sunDirection(now);
        sunLight.position.set(sd[0] * SUN_FAR, sd[1] * SUN_FAR, sd[2] * SUN_FAR);
        sunGroup.position.set(sd[0] * SUN_FAR, sd[1] * SUN_FAR, sd[2] * SUN_FAR);
        rayGeo.setFromPoints([new THREE.Vector3(sd[0] * earthR * 1.6, sd[1] * earthR * 1.6, sd[2] * earthR * 1.6), sunGroup.position]);
        earth.rotation.y = earthTurnDeg(now) * RAD;
        // keep the moon looking the same face to the Earth
        moon.rotation.y = Math.atan2(-m[2], m[0]) + Math.PI;
        camera.aspect = w / h;
        camera.position.set(
          view.dist * Math.cos(view.pitch) * Math.cos(view.yaw),
          view.dist * Math.sin(view.pitch),
          view.dist * Math.cos(view.pitch) * Math.sin(view.yaw),
        );
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      redraw.current = draw;

      const resize = () => {
        w = Math.max(el.clientWidth, 1);
        h = Math.max(el.clientHeight, 1);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        draw();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();

      // drag to turn, wheel and pinch to zoom, arrow keys for the keyboard
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
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) view.dist = Math.min(Math.max(view.dist * (pinch / d), 40), 280);
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
        view.dist = Math.min(Math.max(view.dist * Math.exp(e.deltaY * 0.001), 40), 280);
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
        redraw.current = null;
        ro.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        canvas.removeEventListener("pointercancel", up);
        canvas.removeEventListener("wheel", wheel);
        canvas.removeEventListener("keydown", key);
        for (const d of disposables) d.dispose();
        for (const l of [earthLabel, moonLabel, sunLabel]) {
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
    <div className="atlas-fade-in absolute inset-0 bg-black" data-testid="system-view">
      <div ref={box} className="absolute inset-0" />
      {ok === false && (
        <p role="alert" className="atlas-panel atlas-prose absolute left-1/2 top-1/2 max-w-md -translate-x-1/2 -translate-y-1/2 px-4 py-3 text-sm text-[var(--ink)]">
          This browser cannot draw 3D graphics, so the Earth-Moon system is not drawn.
        </p>
      )}
    </div>
  );
}
