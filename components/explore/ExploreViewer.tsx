"use client";

import { Minus, Navigation2, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { sunDirection, subSolarPoint, subEarthPoint } from "@/lib/atlas/sun-light";
import { subLunarPoint } from "@/lib/atlas/earth-orient";
import { EARTH_IMAGE } from "@/lib/atlas/sky-look";
import { glowCanvas, sunBloomCanvas } from "@/lib/atlas/textures";
import {
  CREDIT_TEXT,
  FALLBACK_TEXTURE,
  MAX_HEIGHT_M,
  MIN_HEIGHT_M,
  MOON_RADIUS_M,
  TILE_MAX_LEVEL,
  TILE_URL,
  VIEWS,
  formatHeight,
  formatLatLon,
  headingDegrees,
  keyStep,
  niceScale,
  type ViewName,
} from "@/lib/explore/geometry";

type CesiumNs = typeof import("cesium");
type Viewer = import("cesium").Viewer;
type State = "loading" | "ready" | "unsupported";
type Readout = { centre: string; height: string; heading: number; scale: { px: number; label: string } | null };

const EMPTY: Readout = { centre: "", height: "", heading: 0, scale: null };
/** After this many failed tile requests the page says it is showing the bundled low-resolution picture. */
const TILE_ERRORS_BEFORE_NOTICE = 4;

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Galaxy explorer E1: a tiled Moon you can orbit, tilt and zoom, in the shape of a globe viewer.
 * CesiumJS is imported inside an effect, so this chunk stays small and the library loads only on this page.
 * The picture is illustration of the surface. It is never an analysis result and carries no site data yet.
 */
export type ScreenPoint = { x: number; y: number; visible: boolean };

/**
 * What the Atlas can ask of the globe (redesign phase C): move the camera, turn a surface point into a screen point (and say
 * whether the Moon itself hides it), turn a click into a surface point, and hear about every frame. Plain numbers in and
 * out, so nothing outside this file touches Cesium.
 */
/** The Atlas lets the camera go much farther out than the explorer page, so the Sun and Earth round the Moon can be seen whole. */
/** The camera distance at the opening view: the Sun and Earth pictures are drawn at their set size there, and scale with the distance from it. */
const REF_VIEW_M = 6_500_000;
const ATLAS_MAX_HEIGHT_M = 80_000_000;

export type SceneHandle = {
  fly: (name: ViewName) => void;
  flyToSite: (latDeg: number, lonDeg: number) => void;
  /** Fly down onto a place (the way into Site sky). Resolves its duration in seconds. */
  dive: (latDeg: number, lonDeg: number) => number;
  /** Fly straight up and away from where the camera is (the way out to the System scale). Returns its duration in seconds. */
  zoomOut: () => number;
  project: (latDeg: number, lonDeg: number) => ScreenPoint | null;
  pick: (x: number, y: number) => { latDeg: number; lonDeg: number } | null;
  onFrame: (cb: () => void) => () => void;
  setClickHandler: (cb: ((x: number, y: number) => void) | null) => void;
  /** Light the Moon from the Sun at this UTC time (milliseconds): the sunlit half bright, the other half dark. */
  setSunTime: (utcMs: number) => void;
  /**
   * Tell the view how the clock is running (playing, and sim milliseconds per real millisecond, negative in reverse, inside [lo, hi]).
   * While it plays the view draws every frame from its own steady time, so the light and the Sun and Earth move smoothly; setSunTime
   * then only corrects it when something real changed (a jump, a loop).
   */
  setPlayback: (playing: boolean, rate: number, lo: number, hi: number) => void;
};

export function ExploreViewer({ bleed = false, onReady }: { bleed?: boolean; onReady?: (handle: SceneHandle) => void } = {}) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const cesium = useRef<CesiumNs | null>(null);
  const [state, setState] = useState<State>("loading");
  const [readout, setReadout] = useState<Readout>(EMPTY);
  const [lowRes, setLowRes] = useState(false);
  const clickCb = useRef<((x: number, y: number) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let v: Viewer | null = null;
    let ro: ResizeObserver | null = null;
    let clicks: import("cesium").ScreenSpaceEventHandler | null = null;

    (async () => {
      try {
        (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium/";
        const C = await import("cesium");
        if (cancelled || !host.current) return;
        cesium.current = C;
        C.Ellipsoid.default = C.Ellipsoid.MOON;
        const moon = C.Ellipsoid.MOON;

        v = new C.Viewer(host.current, {
          baseLayer: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          skyBox: false,
          skyAtmosphere: false,
          creditContainer: document.createElement("div"),
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
          mapProjection: new C.GeographicProjection(moon),
        });
        viewer.current = v;

        clicks = new C.ScreenSpaceEventHandler(v.canvas);
        clicks.setInputAction((e: { position: { x: number; y: number } }) => clickCb.current?.(e.position.x, e.position.y), C.ScreenSpaceEventType.LEFT_CLICK);

        const scene = v.scene;
        scene.backgroundColor = C.Color.fromCssColorString("#05060d");
        scene.globe.baseColor = C.Color.fromCssColorString("#15161c");
        scene.globe.showGroundAtmosphere = false;
        scene.globe.enableLighting = false;
        if (scene.sun) scene.sun.show = false;
        if (scene.moon) scene.moon.show = false;
        const ctl = scene.screenSpaceCameraController;
        ctl.minimumZoomDistance = MIN_HEIGHT_M;
        ctl.maximumZoomDistance = bleed ? ATLAS_MAX_HEIGHT_M : MAX_HEIGHT_M;
        ctl.enableTilt = true;

        // the bundled low-resolution picture sits underneath, so the globe is never blank while tiles load or if they cannot
        const base = await C.SingleTileImageryProvider.fromUrl(FALLBACK_TEXTURE, { rectangle: C.Rectangle.MAX_VALUE });
        if (cancelled) return;
        v.imageryLayers.addImageryProvider(base);

        let errors = 0;
        const tiles = new C.UrlTemplateImageryProvider({
          url: TILE_URL,
          tilingScheme: new C.GeographicTilingScheme({ ellipsoid: moon, numberOfLevelZeroTilesX: 2, numberOfLevelZeroTilesY: 1 }),
          maximumLevel: TILE_MAX_LEVEL,
          tileWidth: 256,
          tileHeight: 256,
        });
        tiles.errorEvent.addEventListener((e) => {
          e.retry = e.timesRetried < 1;
          if (!e.retry && ++errors === TILE_ERRORS_BEFORE_NOTICE) setLowRes(true);
        });
        v.imageryLayers.addImageryProvider(tiles);
        if (bleed) {
          // the Atlas lights the Moon from the Sun: sharper tiles, brighter picture, and an unlit side that stays dark
          scene.globe.maximumScreenSpaceError = 1;
          scene.globe.enableLighting = true;
          // Far out, the Moon is the same soft, warm picture the System scale shows (the bundled one); closing in, the sharp tiles fade in over it
          const baseLayer = v.imageryLayers.get(0);
          const tileLayer = v.imageryLayers.get(1);
          baseLayer.brightness = 1.25;
          baseLayer.contrast = 1.0;
          baseLayer.gamma = 1.0;
          tileLayer.brightness = 1.45;
          tileLayer.contrast = 1.04;
          tileLayer.gamma = 0.92;
          for (const layer of [baseLayer, tileLayer]) {
            layer.nightAlpha = 0.07;
            layer.dayAlpha = 1;
          }
          scene.preRender.addEventListener(() => {
            const h = scene.camera.positionCartographic.height;
            const k = Math.min(Math.max((1_800_000 - h) / 1_200_000, 0), 1); // 0 above 1,800 km, 1 below 600 km
            tileLayer.alpha = k * k * (3 - 2 * k);
          });
          // the Sun and Earth pictures keep their size relative to the Moon: bigger when the camera comes in, smaller when it goes out
          const entityList = v.entities;
          scene.preRender.addEventListener(() => {
            const cam = scene.camera.positionWC;
            for (const ent of entityList.values) {
              const pos = ent.position?.getValue(scene.lastRenderTime ?? C.JulianDate.now());
              if (!ent.billboard || !pos) continue;
              const k = Math.min(Math.max(REF_VIEW_M / C.Cartesian3.distance(cam, pos), 0.05), 12);
              ent.billboard.scale = new C.ConstantProperty(k);
            }
          });
        }

        // the Atlas is about the south pole, so it opens there; the explorer page opens on the whole Moon
        const home = bleed ? VIEWS["south-pole"] : VIEWS.moon;
        v.camera.setView({ destination: C.Cartesian3.fromDegrees(home.lon, home.lat, home.heightM, moon) });

        // read the camera into plain text for the readout, the compass and the scale bar (throttled)
        let last = 0;
        v.scene.postRender.addEventListener(() => {
          const now = performance.now();
          if (!v || now - last < 120) return;
          last = now;
          const cam = v.camera;
          const carto = cam.positionCartographic;
          const w = v.canvas.clientWidth;
          const h = v.canvas.clientHeight;
          const a = cam.pickEllipsoid(new C.Cartesian2(w / 2, h / 2), moon);
          const b = cam.pickEllipsoid(new C.Cartesian2(w / 2 + 100, h / 2), moon);
          const scale = a && b ? niceScale(C.Cartesian3.distance(a, b) / 100) : null;
          const centre = a ? C.Cartographic.fromCartesian(a, moon) : null;
          setReadout({
            centre: centre ? formatLatLon(C.Math.toDegrees(centre.latitude), C.Math.toDegrees(centre.longitude)) : "",
            height: formatHeight(carto.height),
            heading: headingDegrees(cam.heading),
            scale: scale ? { px: scale.px, label: scale.label } : null,
          });
        });

        setState("ready");

        ro = new ResizeObserver(() => v?.resize());
        ro.observe(host.current);
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      clicks?.destroy();
      if (v && !v.isDestroyed()) v.destroy();
      viewer.current = null;
    };
    // `bleed` never changes for a mounted viewer; it only picks the opening view
  }, [bleed]);

  const fly = useCallback((name: ViewName) => {
    const v = viewer.current;
    const C = cesium.current;
    if (!v || !C || v.isDestroyed()) return;
    const t = VIEWS[name];
    v.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(t.lon, t.lat, t.heightM, C.Ellipsoid.MOON),
      orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
      duration: reducedMotion() ? 0 : 1.6,
    });
  }, []);

  useEffect(() => {
    if (state !== "ready") return;
    const v = viewer.current;
    const C = cesium.current;
    if (!v || !C) return;
    const moon = C.Ellipsoid.MOON;
    // a handle outlives its viewer when the viewer is rebuilt (hot reload, remount): every method then does nothing
    const dead = () => v.isDestroyed();

    // The Atlas also draws the Sun and the Earth round the Moon, where they really are in the Moon's sky (body-fixed frame, so the
    // lighting and the Sun marker always agree): the Sun goes once round in a lunar day, the Earth hangs near the middle of the near side
    // (the Moon always faces it) and wobbles a little. Both leave their path as a faint ring.
    const play = { t: Date.now(), at: performance.now(), playing: false, rate: 0, lo: 0, hi: 0 };
    const current = () => (play.playing ? Math.min(Math.max(play.t + (performance.now() - play.at) * play.rate, play.lo), play.hi) : play.t);
    const extras: import("cesium").Entity[] = [];
    let setBodies: ((utcMs: number) => void) | null = null;
    let earthPrimitiveRef: import("cesium").Primitive | null = null;
    if (bleed) {
      const R = 1_737_400;
      const SUN_R = R * 2.15;
      const EARTH_R = R * 1.75;
      const at = (d: [number, number, number], r: number) => new C.Cartesian3(d[0] * r, d[1] * r, d[2] * r);
      const sunAt = (t: number) => sunDirection(subSolarPoint(t));
      const earthAt = (t: number) => sunDirection(subEarthPoint(t));
      const label = (text: string, color: string) => ({
        text,
        font: "600 13px ui-monospace, Menlo, Consolas, monospace",
        fillColor: C.Color.fromCssColorString(color),
        outlineColor: C.Color.BLACK,
        outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new C.Cartesian2(14, -4),
        horizontalOrigin: C.HorizontalOrigin.LEFT,
      });
      // the same Sun and Earth pictures the System scale draws: the glowing Sun, and the Blue Marble Earth with clouds and a blue rim
      const sunPic = sunBloomCanvas(256);
      const sun = v.entities.add({
        position: at(sunAt(Date.now()), SUN_R),
        ...(sunPic
          ? { billboard: { image: sunPic, width: 150, height: 150 } }
          : { point: { pixelSize: 22, color: C.Color.fromCssColorString("#ffd27a"), outlineColor: C.Color.fromCssColorString("#fff3d0"), outlineWidth: 3 } }),
        label: { ...label("SUN", "#ffc46e"), pixelOffset: new C.Cartesian2(34, -4) },
      });
      // the Earth is a real sphere with the Blue Marble picture, turned each frame so the face toward the Moon is the right one; the Sun's
      // light (the scene light) shades it, so its lit side matches the Moon's
      const EARTH_RADIUS_M = 300_000;
      const orientationAt = (t: number) => {
        const e = earthAt(t); // from the Moon toward the Earth
        const f = new C.Cartesian3(-e[0], -e[1], -e[2]); // from the Earth toward the Moon
        const d = f.z;
        const n = C.Cartesian3.normalize(new C.Cartesian3(-d * f.x, -d * f.y, 1 - d * f.z), new C.Cartesian3()); // the Moon's north, squared to f
        const ew = C.Cartesian3.cross(n, f, new C.Cartesian3());
        const sp = subLunarPoint(t);
        const la = (sp.latDeg * Math.PI) / 180;
        const lo = (sp.lonDeg * Math.PI) / 180;
        const r = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
        const eL = [-Math.sin(lo), Math.cos(lo), 0];
        const nL = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
        const W = [ew, n, f];
        const L = [eL, nL, r];
        const m = new Array<number>(9).fill(0);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) m[i * 3 + j] += [W[k].x, W[k].y, W[k].z][i] * L[k][j];
        return C.Quaternion.fromRotationMatrix(new C.Matrix3(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]));
      };
      // The sphere is a primitive whose model matrix is set each frame (cheap); an entity geometry would be rebuilt whenever its position
      // changes, and so would never be drawn while time plays. The entity only carries the label.
      const earthPrimitive = v.scene.primitives.add(
        new C.Primitive({
          geometryInstances: new C.GeometryInstance({
            geometry: new C.EllipsoidGeometry({
              radii: new C.Cartesian3(EARTH_RADIUS_M, EARTH_RADIUS_M, EARTH_RADIUS_M),
              vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
              stackPartitions: 48,
              slicePartitions: 48,
            }),
          }),
          appearance: new C.MaterialAppearance({
            // slightly dimmed: the scene light is strong, tuned for the Moon
            material: C.Material.fromType("Image", { image: EARTH_IMAGE, color: new C.Color(0.75, 0.75, 0.78, 1) }),
            materialSupport: C.MaterialAppearance.MaterialSupport.TEXTURED,
            translucent: false,
            closed: true,
          }),
          asynchronous: false,
          modelMatrix: C.Matrix4.IDENTITY,
        }),
      );
      earthPrimitiveRef = earthPrimitive;
      const placeEarth = (t: number) => {
        earthPrimitive.modelMatrix = C.Matrix4.fromRotationTranslation(C.Matrix3.fromQuaternion(orientationAt(t)), at(earthAt(t), EARTH_R));
      };
      placeEarth(Date.now());
      const earth = v.entities.add({
        position: at(earthAt(Date.now()), EARTH_R),
        label: { ...label("EARTH", "#7fb4ff"), pixelOffset: new C.Cartesian2(38, -4) },
      });
      // a soft blue glow just behind the Earth (a picture that keeps its size relative to the Moon, drawn behind the sphere)
      const haloPic = glowCanvas(128, "rgba(120,170,255,0)", "rgba(110,170,255,0.32)");
      const halo = v.entities.add({
        position: at(earthAt(Date.now()), EARTH_R),
        ...(haloPic ? { billboard: { image: haloPic, width: 150, height: 150, eyeOffset: new C.Cartesian3(0, 0, 700_000) } } : {}),
      });
      const ring = (id: string, positions: import("cesium").Cartesian3[], color: string) =>
        v.entities.add({ id, polyline: { positions, width: 1.5, material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString(color).withAlpha(0.7), dashLength: 14 }) } });
      const start = Date.now();
      const DAY = 86400000;
      const sunPath = Array.from({ length: 121 }, (_, i) => at(sunAt(start + (i / 120) * 29.53 * DAY), SUN_R));
      const earthPath = Array.from({ length: 121 }, (_, i) => at(earthAt(start + (i / 120) * 27.55 * DAY), EARTH_R));
      extras.push(sun, earth, halo, ring("sun-path", sunPath, "#ffc46e"), ring("earth-path", earthPath, "#7fb4ff"));
      setBodies = (t) => {
        sun.position = new C.ConstantPositionProperty(at(sunAt(t), SUN_R));
        const ep = at(earthAt(t), EARTH_R);
        earth.position = new C.ConstantPositionProperty(ep);
        halo.position = new C.ConstantPositionProperty(ep);
        placeEarth(t);
      };
    }
    const light = new C.DirectionalLight({ direction: new C.Cartesian3(-1, 0, 0), intensity: 4.6 });
    v.scene.light = light;
    const applyTime = (t: number) => {
      const [x, y, z] = sunDirection(subSolarPoint(t));
      light.direction = new C.Cartesian3(-x, -y, -z);
      setBodies?.(t);
      v.scene.requestRender();
    };
    let frame = 0;
    const loop = () => {
      if (dead() || !play.playing) return;
      applyTime(current());
      frame = requestAnimationFrame(loop);
    };
    onReady?.({
      fly,
      flyToSite(latDeg, lonDeg) {
        if (dead()) return;
        v.camera.flyTo({
          destination: C.Cartesian3.fromDegrees(lonDeg, latDeg, 900_000, moon),
          orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
          duration: reducedMotion() ? 0 : 1.4,
        });
      },
      dive(latDeg, lonDeg) {
        if (dead()) return 0;
        const duration = reducedMotion() ? 0 : 1.3;
        v.camera.flyTo({
          destination: C.Cartesian3.fromDegrees(lonDeg, latDeg, 40_000, moon),
          orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
          duration,
          easingFunction: C.EasingFunction.CUBIC_IN_OUT,
        });
        return duration;
      },
      zoomOut() {
        if (dead()) return 0;
        const duration = reducedMotion() ? 0 : 1.1;
        const here = C.Cartographic.fromCartesian(v.camera.positionWC, moon);
        v.camera.flyTo({
          destination: C.Cartesian3.fromRadians(here.longitude, here.latitude, 16_000_000, moon),
          orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
          duration,
          easingFunction: C.EasingFunction.CUBIC_IN,
        });
        return duration;
      },
      project(latDeg, lonDeg) {
        if (dead()) return null;
        const p = C.Cartesian3.fromDegrees(lonDeg, latDeg, 0, moon);
        const w = C.SceneTransforms.worldToWindowCoordinates(v.scene, p);
        if (!w) return null;
        return { x: w.x, y: w.y, visible: new C.EllipsoidalOccluder(moon, v.camera.positionWC).isPointVisible(p) };
      },
      pick(x, y) {
        if (dead()) return null;
        const hit = v.camera.pickEllipsoid(new C.Cartesian2(x, y), moon);
        if (!hit) return null;
        const c = C.Cartographic.fromCartesian(hit, moon);
        return { latDeg: C.Math.toDegrees(c.latitude), lonDeg: C.Math.toDegrees(c.longitude) };
      },
      onFrame(cb) {
        if (dead()) return () => {};
        const off = v.scene.postRender.addEventListener(cb);
        v.scene.requestRender();
        return off;
      },
      setClickHandler(cb) {
        clickCb.current = cb;
      },
      setSunTime(utcMs) {
        if (dead()) return;
        // while time plays the view runs its own steady time: take the clock's value only when it really moved (a jump or a loop)
        if (play.playing && Math.abs(utcMs - current()) <= Math.max(600 * Math.abs(play.rate), 1000)) return;
        play.t = utcMs;
        play.at = performance.now();
        applyTime(utcMs);
      },
      setPlayback(playing, rate, lo, hi) {
        if (dead()) return;
        play.t = current();
        play.at = performance.now();
        play.playing = playing;
        play.rate = rate;
        play.lo = lo;
        play.hi = hi;
        cancelAnimationFrame(frame);
        if (playing) frame = requestAnimationFrame(loop);
      },
    });
    return () => {
      cancelAnimationFrame(frame);
      if (!v.isDestroyed()) {
        for (const e of extras) v.entities.remove(e);
        if (earthPrimitiveRef) v.scene.primitives.remove(earthPrimitiveRef);
      }
    };
  }, [state, fly, onReady, bleed]);

  const zoom = useCallback((dir: 1 | -1) => {
    const v = viewer.current;
    if (!v) return;
    const h = v.camera.positionCartographic.height;
    const maxH = bleed ? ATLAS_MAX_HEIGHT_M : MAX_HEIGHT_M;
    const step = keyStep(h).zoomM;
    if (dir === 1) v.camera.zoomIn(Math.max(0, Math.min(step, h - MIN_HEIGHT_M)));
    else v.camera.zoomOut(Math.min(step, (maxH - h > 0 ? maxH - h : 0)));
    v.scene.requestRender();
  }, []);

  const resetNorth = useCallback(() => {
    const v = viewer.current;
    const C = cesium.current;
    if (!v || !C) return;
    v.camera.flyTo({
      destination: v.camera.positionWC.clone(),
      orientation: { heading: 0, pitch: v.camera.pitch, roll: 0 },
      duration: reducedMotion() ? 0 : 0.8,
    });
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const v = viewer.current;
      if (!v || e.ctrlKey || e.metaKey || e.altKey) return;
      const { rotateRad } = keyStep(v.camera.positionCartographic.height);
      let handled = true;
      switch (e.key) {
        case "ArrowLeft": v.camera.rotateLeft(rotateRad); break;
        case "ArrowRight": v.camera.rotateRight(rotateRad); break;
        case "ArrowUp": v.camera.rotateUp(rotateRad); break;
        case "ArrowDown": v.camera.rotateDown(rotateRad); break;
        case "+": case "=": zoom(1); break;
        case "-": case "_": zoom(-1); break;
        case "Home": fly("moon"); break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        v.scene.requestRender();
      }
    },
    [fly, zoom],
  );

  return (
    <figure className={bleed ? "absolute inset-0 m-0" : "m-0"} aria-label="Interactive Moon">
      <div
        className={
          bleed
            ? "absolute inset-0 overflow-hidden bg-[#05060d]"
            : "relative h-[min(72svh,720px)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-[#05060d]"
        }
        data-testid="explore"
        data-state={state}
        data-heading={readout.heading}
        data-low-res={lowRes ? "true" : "false"}
      >
        <div
          ref={host}
          role="application"
          aria-label="Moon globe. Drag to turn it, scroll to zoom. With the keyboard use the arrow keys to turn, plus and minus to zoom, Home to see the whole Moon."
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring [&_.cesium-viewer]:size-full [&_.cesium-viewer-cesiumWidgetContainer]:size-full [&_.cesium-widget]:relative [&_.cesium-widget]:size-full [&_.cesium-widget_canvas]:block [&_.cesium-widget_canvas]:size-full [&_.cesium-widget-credits]:hidden"
        />

        {state === "loading" && (
          <p role="status" className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            Loading the Moon…
          </p>
        )}

        {state === "unsupported" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="max-w-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static fallback picture, shown only when 3D is unavailable */}
              <img src={FALLBACK_TEXTURE} alt="A flat map of the whole Moon, an illustration of the surface" className="mb-4 w-full rounded-lg" />
              <p className="text-sm text-muted-foreground">
                The 3D Moon could not start in this browser. The rest of LunaScope works as usual; the picture above is a flat map of the surface.
              </p>
            </div>
          </div>
        )}

        {state === "ready" && (
          <>
            <div className={bleed ? "hidden" : "chrome-glass absolute left-3 top-3 flex items-center gap-1 rounded-lg border border-border p-1"}>
              <Button type="button" variant="ghost" size="sm" onClick={() => fly("moon")}>
                {VIEWS.moon.label}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => fly("south-pole")}>
                {VIEWS["south-pole"].label}
              </Button>
            </div>

            <div className={`chrome-glass absolute right-3 flex flex-col items-center gap-1 rounded-lg border border-border p-1 ${bleed ? "bottom-48" : "top-3"}`}>
              <Button type="button" variant="ghost" size="icon" onClick={resetNorth} aria-label={`Compass: north is ${readout.heading === 0 ? "up" : `${readout.heading} degrees from up`}. Press to turn north up.`}>
                <Navigation2 aria-hidden="true" style={{ transform: `rotate(${-readout.heading}deg)` }} />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => zoom(1)} aria-label="Zoom in">
                <Plus aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => zoom(-1)} aria-label="Zoom out">
                <Minus aria-hidden="true" />
              </Button>
            </div>

            <div className={bleed ? "hidden" : "chrome-glass pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border px-3 py-2 font-mono text-xs leading-5 text-muted-foreground"} data-testid="explore-readout">
              {readout.centre && <div>Centre {readout.centre}</div>}
              <div>Height {readout.height}</div>
              {readout.scale && (
                <div className="mt-1 flex items-center gap-2">
                  <span aria-hidden="true" className="block h-1.5 border-x border-b border-muted-foreground" style={{ width: readout.scale.px }} />
                  <span>{readout.scale.label}</span>
                </div>
              )}
            </div>

            {lowRes && (
              <p role="status" className={`chrome-glass absolute max-w-xs ${bleed ? "bottom-48 left-1/2 -translate-x-1/2" : "bottom-3 right-3"} rounded-lg border border-border px-3 py-2 text-xs leading-5 text-muted-foreground`}>
                The detailed imagery could not be reached. Showing the bundled low-resolution picture of the Moon.
              </p>
            )}
          </>
        )}
      </div>
      <figcaption className={bleed ? "sr-only" : "mt-3 text-xs leading-5 text-muted-foreground"}>
        {CREDIT_TEXT} Moon radius {(MOON_RADIUS_M / 1000).toLocaleString("en-US")} km.
      </figcaption>
    </figure>
  );
}
