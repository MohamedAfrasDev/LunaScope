"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE_NS from "three";
import type { HorizonProfileResponse, IntervalClass } from "@/lib/api/types";
import { classAt, interpAzEl } from "@/lib/sky";
import {
  COMPASS,
  STATE_WORDS,
  clampFov,
  clampPitch,
  describeScene,
  dirFromAzEl,
  elevationRing,
  exaggerate,
  skylineRuns,
  skylineWall,
  skylineWallUv,
  trackRuns,
} from "@/lib/sky3d";
import type { Track } from "./SkyPlots";

export type Track3D = Pick<Track, "target" | "series" | "intervals">;
import { targetLabel } from "@/lib/format";
import { readSkyPalette, useColorScheme } from "@/lib/sky-palette";
import { PHOTO_LOOK } from "@/lib/atlas/sky-look";
import { earthCanvas, glowCanvas, regolithCanvas } from "@/lib/atlas/textures";

/**
 * A 3D look at the same sky: the terrain skyline as a wall around the observer, the Sun's and Earth's paths over it,
 * and where each is right now. Display only: the geometry comes from the service's skyline and series, hidden or
 * visible is read from the service's classified intervals, and the wall hides a target only because the data put
 * the target behind it. The three.js library is loaded on demand, so the other views never pay for it.
 */

const R_WALL = 10; // the terrain wall
const R_SKY = 11; // targets sit a little beyond the wall, so terrain in front of them hides them (depth test)
const FLOOR_EL = -8;

type Mode = "look" | "orbit";

interface Handles {
  render: () => void;
  setView: (yaw: number, pitch: number) => void;
}

/** What a host (the Atlas) can ask of the view. */
export type Sky3DHandle = { faceTarget: (target: string) => void; face: (yawDeg: number, pitchDeg?: number) => void };

export function Sky3D({ profile, tracks, t, siteName, clock, bleed = false, mode: modeProp, exaggeration, showPaths, showLander = true, onReady, onView }: {
  profile: HorizonProfileResponse;
  tracks: Track3D[]; // keep this array stable: the scene is rebuilt when it changes
  t: number;
  siteName: string;
  clock: string;
  /** Fill the parent and draw no controls or text of its own: the host supplies them (Atlas Site sky). */
  bleed?: boolean;
  /** Host-controlled look mode, exaggeration and path visibility. When omitted the view keeps its own controls. */
  mode?: Mode;
  exaggeration?: number;
  showPaths?: Partial<Record<string, boolean>>;
  /** Atlas only: the generic lander model (an illustration). */
  showLander?: boolean;
  onReady?: (h: Sky3DHandle) => void;
  /** Where the view is looking (degrees), on every drawn frame. */
  onView?: (yawDeg: number, pitchDeg: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [modeState, setMode] = useState<Mode>("look");
  const [kState, setK] = useState(1);
  const mode = modeProp ?? modeState;
  const k = exaggeration ?? kState;
  const sunPath = showPaths?.sun_center !== false;
  const earthPath = showPaths?.earth_center !== false;
  const onViewRef = useRef(onView);
  useEffect(() => {
    onViewRef.current = onView;
  }, [onView]);
  const [ok, setOk] = useState<boolean | null>(null);
  const scheme = useColorScheme(); // rebuild the scene when the system theme changes
  const handles = useRef<Handles | null>(null);
  const view = useRef({ yaw: 0, pitch: 4, fov: 70, dist: 30 });
  const live = useRef({ tracks, t, k, mode, lander: showLander, paths: { sun_center: sunPath, earth_center: earthPath } as Record<string, boolean> });

  const cursor = useMemo(() => tracks.map((x) => ({ target: x.target, ...interpAzEl(x.series, t), cls: (classAt(x.intervals, t) ?? "none") as IntervalClass | "none" })), [tracks, t]);
  const label = describeScene({
    site: siteName, clock, exaggeration: k,
    targets: cursor.map((c) => ({ label: targetLabel(c.target), az: c.az, el: c.el, cls: c.cls })),
  });

  // The scene reads the latest props through this ref; it is updated in an effect, before any frame is drawn.
  useEffect(() => {
    live.current = { tracks, t, k, mode, lander: showLander, paths: { sun_center: sunPath, earth_center: earthPath } };
    handles.current?.render();
  }, [tracks, t, k, mode, sunPath, earthPath, showLander]);

  const faceTarget = useCallback((target: string) => {
    const c = live.current.tracks.find((x) => x.target === target);
    if (!c) return;
    const p = interpAzEl(c.series, live.current.t);
    view.current.yaw = p.az;
    view.current.pitch = clampPitch(p.el * live.current.k);
    handles.current?.render();
  }, []);

  const face = useCallback((yaw: number, pitch = 4) => {
    view.current.yaw = yaw;
    view.current.pitch = pitch;
    handles.current?.render();
  }, []);

  useEffect(() => {
    onReady?.({ faceTarget, face });
  }, [onReady, faceTarget, face]);

  // The scene: rebuilt when the data, the exaggeration or the mode changes; markers move on t without a rebuild.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = (await import("three")) as typeof THREE_NS;
      if (cancelled) return;
      const pal = readSkyPalette(el); // the theme's colours, read now (from the scope the view sits in)
      const COLORS: Record<string, string> = { sun_center: pal.sun, earth_center: pal.earth };
      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch {
        setOk(false);
        return;
      }
      setOk(true);
      const canvas = renderer.domElement;
      canvas.className = bleed ? "block h-full w-full touch-none" : "block h-full w-full touch-none rounded-md";
      canvas.tabIndex = 0;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "3D sky. Drag to look around; arrow keys also turn the view.");
      el.querySelector("[data-canvas-slot]")?.appendChild(canvas);

      const scene = new THREE.Scene();
      // the Atlas draws a lit surface, a glowing Sun, a phased Earth and a lander; the run pages keep the diagram look
      const photo = bleed;
      scene.background = new THREE.Color(photo ? PHOTO_LOOK.sky : pal.background);
      const camera = new THREE.PerspectiveCamera(view.current.fov, 1, photo ? 0.004 : 0.05, 200);
      const disposables: { dispose: () => void }[] = [];
      const add = <T extends THREE_NS.Object3D>(o: T) => (scene.add(o), o);

      // ground disc, wall, ridge line
      const regolith = photo ? regolithCanvas(512) : null;
      const regTex = regolith ? new THREE.CanvasTexture(regolith) : null;
      if (regTex) {
        regTex.wrapS = regTex.wrapT = THREE.RepeatWrapping;
        regTex.colorSpace = THREE.SRGBColorSpace;
        regTex.anisotropy = 8;
        disposables.push(regTex);
      }
      const ground = new THREE.CircleGeometry(R_WALL, 96);
      ground.rotateX(-Math.PI / 2);
      if (regTex) {
        // planar texture coordinates: the picture repeats every 6 units
        const gp = ground.getAttribute("position");
        const uv = new Float32Array(gp.count * 2);
        for (let q = 0; q < gp.count; q++) {
          uv[q * 2] = gp.getX(q) / 6;
          uv[q * 2 + 1] = gp.getZ(q) / 6;
        }
        ground.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      }
      const groundMat = new THREE.MeshBasicMaterial(regTex ? { map: regTex, side: THREE.DoubleSide } : { color: pal.ground, side: THREE.DoubleSide });
      add(new THREE.Mesh(ground, groundMat));
      disposables.push(ground, groundMat);

      const wall = skylineWall(profile.azimuth_deg, profile.horizon_el_deg, R_WALL, FLOOR_EL, k);
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute("position", new THREE.BufferAttribute(wall.positions, 3));
      wallGeo.setIndex(new THREE.BufferAttribute(wall.indices, 1));
      if (regTex) wallGeo.setAttribute("uv", new THREE.BufferAttribute(skylineWallUv(profile.azimuth_deg, profile.horizon_el_deg, 10, 0.3), 2));
      const wallMat = new THREE.MeshBasicMaterial({ ...(regTex ? { map: regTex, color: PHOTO_LOOK.wall } : { color: pal.wall }), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      add(new THREE.Mesh(wallGeo, wallMat));
      disposables.push(wallGeo, wallMat);

      const ridgeMat = new THREE.LineBasicMaterial({ color: photo ? PHOTO_LOOK.ridge : pal.ridge });
      disposables.push(ridgeMat);
      for (const run of skylineRuns(profile.azimuth_deg, profile.horizon_el_deg, R_WALL, k)) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(run, 3));
        add(new THREE.Line(g, ridgeMat));
        disposables.push(g);
      }

      // rings: the flat 0 degree horizon (brighter) and every 5 degrees above it (the diagram view only)
      const maxEl = Math.max(10, ...profile.horizon_el_deg.filter((v): v is number => v != null), ...tracks.flatMap((x) => x.series.el_deg));
      for (let e = 0; !photo && e <= Math.ceil(maxEl / 5) * 5; e += 5) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(elevationRing(e, R_SKY + 0.2, 180, k), 3));
        const m = new THREE.LineBasicMaterial({ color: e === 0 ? pal.horizonRing : pal.ring, transparent: true, opacity: e === 0 ? 0.9 : 0.55 });
        add(new THREE.Line(g, m));
        disposables.push(g, m);
      }

      // paths: visible runs bright and depth-tested; everything else dim and always drawn (so you can see where it is)
      const pathObjs = new Map<string, THREE_NS.Object3D[]>();
      for (const tr of tracks) {
        for (const run of trackRuns(tr.series, tr.intervals, R_SKY, k)) {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(run.positions, 3));
          const vis = run.cls === "V";
          const m = new THREE.LineBasicMaterial({ color: COLORS[tr.target], transparent: !vis, opacity: vis ? 1 : photo ? 0.28 : 0.4, depthTest: vis });
          const line = add(new THREE.Line(g, m));
          pathObjs.set(tr.target, [...(pathObjs.get(tr.target) ?? []), line]);
          disposables.push(g, m);
        }
      }

      // compass letters and the observer pin
      const sprite = (text: string, color: string, scale: number) => {
        const c = document.createElement("canvas");
        c.width = 256;
        c.height = 128;
        const g = c.getContext("2d");
        if (g) {
          g.font = "bold 76px system-ui, sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.lineWidth = 10;
          g.strokeStyle = pal.labelStroke;
          g.strokeText(text, 128, 68);
          g.fillStyle = color;
          g.fillText(text, 128, 68);
        }
        const tex = new THREE.CanvasTexture(c);
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: photo ? 0.7 : 1 });
        const s = new THREE.Sprite(mat);
        s.scale.set(scale * 2, scale, 1);
        disposables.push(tex, mat);
        return s;
      };
      for (const c of COMPASS) {
        const s = sprite(c.label, photo ? PHOTO_LOOK.compass : c.label === "N" ? pal.labelNorth : pal.label, photo ? 0.8 : 1.4);
        s.position.set(...dirFromAzEl(c.az, exaggerate(0, k) + (photo ? 1.2 : 1.5), R_SKY + 0.6));
        add(s);
      }
      if (!photo) {
        const pinGeo = new THREE.ConeGeometry(0.18, 0.7, 12);
        const pinMat = new THREE.MeshBasicMaterial({ color: pal.pin });
        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.position.set(0, 0.35, 0);
        add(pin);
        disposables.push(pinGeo, pinMat);
      }

      // markers. Diagram view: a solid body (hidden behind terrain by the depth test) plus a faint ghost that is always drawn.
      // Atlas view: a glowing Sun and an Earth globe whose phase follows the Sun, both hidden by the terrain, with no labels.
      type Marker = { body: THREE_NS.Object3D; ghost: THREE_NS.Object3D | null; tag: THREE_NS.Object3D | null };
      const markers = new Map<string, Marker>();
      let earthLight: THREE_NS.DirectionalLight | null = null;
      if (photo) {
        earthLight = new THREE.DirectionalLight(PHOTO_LOOK.light, 3.4);
        scene.add(earthLight);
        scene.add(new THREE.AmbientLight(PHOTO_LOOK.light, 0.06));
      }
      for (const tr of tracks) {
        if (photo && tr.target === "sun_center") {
          const group = new THREE.Group();
          const coreGeo = new THREE.SphereGeometry(0.2, 24, 16);
          const coreMat = new THREE.MeshBasicMaterial({ color: PHOTO_LOOK.sunCore });
          group.add(new THREE.Mesh(coreGeo, coreMat));
          const glowTex = new THREE.CanvasTexture(glowCanvas(256, "rgba(255,250,235,1)", "rgba(255,196,110,0.45)") ?? document.createElement("canvas"));
          const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
          const glow = new THREE.Sprite(glowMat);
          glow.scale.set(4.4, 4.4, 1);
          group.add(glow);
          add(group);
          markers.set(tr.target, { body: group, ghost: null, tag: null });
          disposables.push(coreGeo, coreMat, glowTex, glowMat);
        } else if (photo) {
          const earthTex = new THREE.CanvasTexture(earthCanvas(512, 256) ?? document.createElement("canvas"));
          earthTex.colorSpace = THREE.SRGBColorSpace;
          const geo = new THREE.SphereGeometry(0.5, 48, 32);
          const mat = new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.9, metalness: 0 });
          const globe = new THREE.Mesh(geo, mat);
          globe.rotation.set(0.35, 1.2, 0.2);
          const haloTex = new THREE.CanvasTexture(glowCanvas(128, "rgba(120,170,255,0.0)", "rgba(110,170,255,0.28)") ?? document.createElement("canvas"));
          const haloMat = new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
          const halo = new THREE.Sprite(haloMat);
          halo.scale.set(1.8, 1.8, 1);
          const group = new THREE.Group();
          group.add(halo);
          group.add(globe);
          add(group);
          markers.set(tr.target, { body: group, ghost: null, tag: null });
          disposables.push(earthTex, geo, mat, haloTex, haloMat);
        } else {
          const geo = tr.target === "sun_center" ? new THREE.SphereGeometry(0.34, 24, 16) : new THREE.OctahedronGeometry(0.42);
          const solidMat = new THREE.MeshBasicMaterial({ color: COLORS[tr.target] });
          const ghostMat = new THREE.MeshBasicMaterial({ color: COLORS[tr.target], transparent: true, opacity: 0.3, depthTest: false });
          const solid = new THREE.Mesh(geo, solidMat);
          const ghost = new THREE.Mesh(geo, ghostMat);
          ghost.renderOrder = 5;
          const tag = sprite(targetLabel(tr.target), tr.target === "sun_center" ? pal.sun : pal.earth, 1.5);
          add(solid);
          add(ghost);
          add(tag);
          markers.set(tr.target, { body: solid, ghost, tag });
          disposables.push(geo, solidMat, ghostMat);
        }
      }

      // a generic lander (an illustration, not a real spacecraft): body, legs, pads and two panels, a little way off
      let lander: THREE_NS.Group | null = null;
      if (photo) {
        lander = new THREE.Group();
        const gold = new THREE.MeshBasicMaterial({ color: PHOTO_LOOK.landerBody });
        const dark = new THREE.MeshBasicMaterial({ color: PHOTO_LOOK.landerDark });
        const panel = new THREE.MeshBasicMaterial({ color: PHOTO_LOOK.landerPanel });
        const bodyGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 6);
        const body = new THREE.Mesh(bodyGeo, gold);
        body.position.y = 0.62;
        lander.add(body);
        const topGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.12, 6);
        const top = new THREE.Mesh(topGeo, dark);
        top.position.y = 0.81;
        lander.add(top);
        const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6);
        const padGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.015, 12);
        for (let q = 0; q < 4; q++) {
          const a = (q / 4) * Math.PI * 2 + Math.PI / 4;
          const leg = new THREE.Mesh(legGeo, dark);
          leg.position.set(Math.cos(a) * 0.4, 0.31, Math.sin(a) * 0.4);
          leg.rotation.z = -Math.cos(a) * 0.5;
          leg.rotation.x = Math.sin(a) * 0.5;
          lander.add(leg);
          const pad = new THREE.Mesh(padGeo, dark);
          pad.position.set(Math.cos(a) * 0.55, 0.01, Math.sin(a) * 0.55);
          lander.add(pad);
        }
        const panelGeo = new THREE.BoxGeometry(0.62, 0.02, 0.34);
        for (const sx of [-1, 1]) {
          const pn = new THREE.Mesh(panelGeo, panel);
          pn.position.set(sx * 0.72, 0.82, 0);
          pn.rotation.z = sx * 0.28;
          lander.add(pn);
        }
        const lp = dirFromAzEl(196, 0, 7.5);
        lander.position.set(lp[0], 0, lp[2]);
        lander.scale.setScalar(1.3);
        add(lander);
        disposables.push(bodyGeo, topGeo, legGeo, padGeo, panelGeo, gold, dark, panel);
      }

      let raf = 0;
      let frames = 0;
      const placeMarkers = () => {
        let sunPos: [number, number, number] | null = null;
        for (const tr of live.current.tracks) {
          const m = markers.get(tr.target);
          if (!m) continue;
          const p = interpAzEl(tr.series, live.current.t);
          const [x, y, z] = dirFromAzEl(p.az, exaggerate(p.el, live.current.k), R_SKY);
          m.body.position.set(x, y, z);
          m.ghost?.position.set(x, y, z);
          m.tag?.position.set(x, y + 0.95, z);
          if (tr.target === "sun_center") sunPos = [x, y, z];
        }
        if (earthLight) {
          // the globe is lit from the side of the Sun, so its phase is whatever the Sun and Earth directions make it
          const sp = sunPos ?? [0, 1, 0];
          earthLight.position.set(sp[0], sp[1], sp[2]);
        }
        if (lander) lander.visible = live.current.lander;
      };
      const draw = () => {
        raf = 0;
        const v = view.current;
        if (live.current.mode === "look") {
          camera.fov = clampFov(v.fov);
          camera.position.set(0, 0.02, 0);
          const [fx, fy, fz] = dirFromAzEl(v.yaw, clampPitch(v.pitch), 1);
          camera.lookAt(fx, fy + 0.02, fz);
        } else {
          camera.fov = 45;
          const [cx, cy, cz] = dirFromAzEl(v.yaw + 180, Math.max(8, clampPitch(v.pitch + 26)), v.dist);
          camera.position.set(cx, cy, cz);
          camera.lookAt(0, 1.5, 0);
        }
        camera.updateProjectionMatrix();
        for (const [target, objs] of pathObjs) for (const o of objs) o.visible = live.current.paths[target] !== false;
        placeMarkers();
        renderer.render(scene, camera);
        frames += 1;
        el.setAttribute("data-frames", String(frames));
        onViewRef.current?.(v.yaw, v.pitch);
      };
      const request = () => {
        if (!raf) raf = requestAnimationFrame(draw);
      };
      handles.current = { render: request, setView: (yaw, pitch) => ((view.current.yaw = yaw), (view.current.pitch = pitch), request()) };

      const resize = () => {
        const r = el.getBoundingClientRect();
        const w = Math.max(160, Math.floor(r.width));
        const h = bleed ? Math.max(220, Math.floor(r.height)) : Math.max(220, Math.floor(w < 520 ? w * 0.9 : w * 0.56));
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        canvas.style.height = `${h}px`;
        camera.aspect = w / h;
        request();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();

      // pointer: drag to look (or to orbit), wheel to zoom; one finger drags, touch-action is off on the canvas
      let drag: { x: number; y: number } | null = null;
      const down = (e: PointerEvent) => ((drag = { x: e.clientX, y: e.clientY }), canvas.setPointerCapture(e.pointerId));
      const move = (e: PointerEvent) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag = { x: e.clientX, y: e.clientY };
        const sens = live.current.mode === "look" ? (view.current.fov / 70) * 0.25 : 0.4;
        view.current.yaw = (view.current.yaw + (live.current.mode === "look" ? -dx : dx) * sens + 360) % 360;
        view.current.pitch = clampPitch(view.current.pitch + (live.current.mode === "look" ? dy : -dy) * sens);
        request();
      };
      const up = (e: PointerEvent) => ((drag = null), canvas.hasPointerCapture(e.pointerId) && canvas.releasePointerCapture(e.pointerId));
      const wheel = (e: WheelEvent) => {
        e.preventDefault();
        if (live.current.mode === "look") view.current.fov = clampFov(view.current.fov + Math.sign(e.deltaY) * 4);
        else view.current.dist = Math.max(14, Math.min(46, view.current.dist + Math.sign(e.deltaY) * 2));
        request();
      };
      const key = (e: KeyboardEvent) => {
        const v = view.current;
        const step = e.shiftKey ? 15 : 5;
        const handled = ({
          ArrowLeft: () => (v.yaw = (v.yaw - step + 360) % 360),
          ArrowRight: () => (v.yaw = (v.yaw + step) % 360),
          ArrowUp: () => (v.pitch = clampPitch(v.pitch + 3)),
          ArrowDown: () => (v.pitch = clampPitch(v.pitch - 3)),
          "+": () => (v.fov = clampFov(v.fov - 5)),
          "=": () => (v.fov = clampFov(v.fov - 5)),
          "-": () => (v.fov = clampFov(v.fov + 5)),
        } as Record<string, () => void>)[e.key];
        if (handled) {
          e.preventDefault();
          handled();
          request();
        }
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      canvas.addEventListener("wheel", wheel, { passive: false });
      canvas.addEventListener("keydown", key);

      cleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        canvas.removeEventListener("pointercancel", up);
        canvas.removeEventListener("wheel", wheel);
        canvas.removeEventListener("keydown", key);
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        canvas.remove();
        handles.current = null;
      };
      // first view: face the Sun, a little above the horizon
      const sun = tracks.find((x) => x.target === "sun_center") ?? tracks[0];
      if (sun) {
        const p = interpAzEl(sun.series, live.current.t);
        view.current.yaw = p.az;
        view.current.pitch = clampPitch(Math.max(2, Math.min(12, p.el * k)));
      }
      request();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [profile, tracks, k, scheme, bleed]);

  const btn = "rounded-md border border-border px-2.5 py-1 text-sm transition-colors hover:border-input hover:bg-muted";
  if (ok === false && bleed)
    return (
      <p role="status" className="atlas-panel atlas-prose absolute left-1/2 top-1/2 max-w-md -translate-x-1/2 -translate-y-1/2 px-4 py-3 text-sm text-[var(--ink)]">
        The 3D sky needs WebGL, which this browser or device does not offer. The Sky path panel draws the same sky as flat plots.
      </p>
    );
  if (ok === false)
    return (
      <p role="status" className="rounded-md border border-border bg-muted px-3 py-3 text-sm">
        The 3D view needs WebGL, which this browser or device does not offer. The polar and unrolled views show the same
        sky.
      </p>
    );

  if (bleed)
    return (
      <div ref={box} data-frames="0" className="absolute inset-0" data-testid="sky3d">
        <div data-canvas-slot className="absolute inset-0" role="group" aria-label={label} />
        {ok === null && <p role="status" className="atlas-label absolute inset-0 grid place-items-center text-[var(--ink-dim)]">Loading the 3D sky…</p>}
      </div>
    );

  return (
    <div ref={box} data-frames="0" className="grid gap-3">
      <div role="group" aria-label="3D view controls" className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} aria-pressed={mode === "look"} onClick={() => setMode("look")}>Look around</button>
        <button type="button" className={btn} aria-pressed={mode === "orbit"} onClick={() => setMode("orbit")}>From outside</button>
        <button type="button" className={btn} aria-pressed={k === 3} onClick={() => setK(k === 1 ? 3 : 1)}>
          Exaggerate heights ×3
        </button>
        <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" aria-hidden="true" />
        {tracks.map((x) => (
          <button key={x.target} type="button" className={btn} onClick={() => faceTarget(x.target)}>Face the {targetLabel(x.target)}</button>
        ))}
        {COMPASS.map((c) => (
          <button key={c.label} type="button" className={btn} aria-label={`Face ${{ N: "north", E: "east", S: "south", W: "west" }[c.label]}`} onClick={() => face(c.az)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-md border border-border" aria-label={label} role="group">
        <div data-canvas-slot className="min-h-[14rem] w-full" />
        {ok === null && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading the 3D view…</p>}
      </div>

      <ul className="grid gap-1 text-sm" aria-label="Where the Sun and Earth are at the cursor">
        {cursor.map((c) => (
          <li key={c.target}>
            <strong>{targetLabel(c.target)}</strong>: azimuth {c.az.toFixed(1)}°, elevation {c.el.toFixed(2)}°; {STATE_WORDS[c.cls]}.
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Drag to look around (arrow keys also turn the view, + and − zoom). The wall is the terrain skyline from the elevation
        data; a target behind it is hidden, shown faintly through the wall. Markers are drawn larger than the real Sun and
        Earth so they can be seen. {k !== 1 ? "Elevation angles are exaggerated ×3 for legibility. " : ""}
        This view only draws what the service already decided.
      </p>
    </div>
  );
}
