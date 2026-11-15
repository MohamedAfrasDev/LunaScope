"use client";

import { Minus, Navigation2, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
export type SceneHandle = { fly: (name: ViewName) => void };

export function ExploreViewer({ bleed = false, onReady }: { bleed?: boolean; onReady?: (handle: SceneHandle) => void } = {}) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const cesium = useRef<CesiumNs | null>(null);
  const [state, setState] = useState<State>("loading");
  const [readout, setReadout] = useState<Readout>(EMPTY);
  const [lowRes, setLowRes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let v: Viewer | null = null;
    let ro: ResizeObserver | null = null;

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

        const scene = v.scene;
        scene.backgroundColor = C.Color.fromCssColorString("#05060d");
        scene.globe.baseColor = C.Color.fromCssColorString("#15161c");
        scene.globe.showGroundAtmosphere = false;
        scene.globe.enableLighting = false;
        if (scene.sun) scene.sun.show = false;
        if (scene.moon) scene.moon.show = false;
        const ctl = scene.screenSpaceCameraController;
        ctl.minimumZoomDistance = MIN_HEIGHT_M;
        ctl.maximumZoomDistance = MAX_HEIGHT_M;
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

        const home = VIEWS.moon;
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
      if (v && !v.isDestroyed()) v.destroy();
      viewer.current = null;
    };
  }, []);

  const fly = useCallback((name: ViewName) => {
    const v = viewer.current;
    const C = cesium.current;
    if (!v || !C) return;
    const t = VIEWS[name];
    v.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(t.lon, t.lat, t.heightM, C.Ellipsoid.MOON),
      orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
      duration: reducedMotion() ? 0 : 1.6,
    });
  }, []);

  useEffect(() => {
    if (state === "ready") onReady?.({ fly });
  }, [state, fly, onReady]);

  const zoom = useCallback((dir: 1 | -1) => {
    const v = viewer.current;
    if (!v) return;
    const h = v.camera.positionCartographic.height;
    const step = keyStep(h).zoomM;
    if (dir === 1) v.camera.zoomIn(Math.max(0, Math.min(step, h - MIN_HEIGHT_M)));
    else v.camera.zoomOut(Math.min(step, MAX_HEIGHT_M - h > 0 ? MAX_HEIGHT_M - h : 0));
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
