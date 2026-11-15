"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Sky3DHandle } from "@/components/Sky3D";
import { LearnPanel } from "@/components/atlas/LearnPanel";
import { MissionWindowPanel } from "@/components/atlas/MissionWindowPanel";
import { SiteSky, type SkyLook } from "@/components/atlas/SiteSky";
import { SkyControls } from "@/components/atlas/SkyControls";
import { PinLayer } from "@/components/atlas/PinLayer";
import { Readout } from "@/components/atlas/Readout";
import { SelectedSitePanel, type SiteCursor } from "@/components/atlas/SelectedSitePanel";
import { SitesPanel } from "@/components/atlas/SitesPanel";
import { TimeDock, type DockRun } from "@/components/atlas/TimeDock";
import { ClearancePanel } from "@/components/atlas/ClearancePanel";
import { ComparePanel } from "@/components/atlas/ComparePanel";
import { MetricsPanel } from "@/components/atlas/MetricsPanel";
import { Panel } from "@/components/atlas/Panel";
import { SkyPathPanel } from "@/components/atlas/SkyPathPanel";
import { TimelinePanel } from "@/components/atlas/TimelinePanel";
import { RIGHT_PANELS, TopBar, type PanelId, type Scale } from "@/components/atlas/TopBar";
import { useHorizon } from "@/components/atlas/useHorizon";
import { useCatalog } from "@/components/atlas/useCatalog";
import { useClock } from "@/components/atlas/useClock";
import { useRun } from "@/components/atlas/useRun";
import { ExploreLoader } from "@/components/explore/ExploreLoader";
import type { SceneHandle } from "@/components/explore/ExploreViewer";
import { describeError, postJson } from "@/lib/api/client";
import type { CustomSiteCheck } from "@/lib/api/types";
import { fromCustomCheck, inTerrainData, MAX_CUSTOM_POINTS, type AtlasSite } from "@/lib/atlas/sites";
import { utcLabel } from "@/lib/atlas/clock";
import { cursorAt, eventScopeWords, eventTimesFor } from "@/lib/atlas/run";
import { skyScaleLabel } from "@/lib/atlas/sky";
import { shortId } from "@/lib/format";
import type { ViewName } from "@/lib/explore/geometry";

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

const SCALE_LABEL: Record<Scale, string> = { moon: "MOON SCALE", system: "SYSTEM SCALE", sky: "SITE SKY" };

/** Placed points are checked by the service, and the precision is a stated assumption for a point set by hand. */
const PLACED_SOURCE = "Placed by hand in the Atlas";
const PLACED_PRECISION_M = 1000;

/**
 * The Atlas frame (spec 3 and 4): one full-screen scene, floating instruments on top, one time dock underneath.
 * Phase C adds the sites: pins on the Moon, a Sites list, the selected-site card and custom points. The clock and the
 * result panels arrive in later phases. H hides the interface (for screenshots) and shows it again.
 */
export function AtlasShell() {
  const catalog = useCatalog();
  const runLoad = useRun();
  const runData = runLoad.status === "ready" ? runLoad.run : null;
  const { clock, actions, reducedMotion } = useClock(runData?.window ?? null);
  const [scale, setScale] = useState<Scale>("moon");
  const [open, setOpen] = useState<PanelId[]>(["sites"]);
  const [hidden, setHidden] = useState(false);
  const [scene, setScene] = useState<SceneHandle | null>(null);
  const [customs, setCustoms] = useState<AtlasSite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [skyLook, setSkyLook] = useState<SkyLook>("look");
  const [skyK, setSkyK] = useState(1);
  const [skyPaths, setSkyPaths] = useState({ sun_center: true, earth_center: true });
  const [skyYaw, setSkyYaw] = useState(0);
  const skyHandle = useRef<Sky3DHandle | null>(null);
  const nextCustom = useRef(1);

  const sites = useMemo(() => [...catalog.sites, ...customs], [catalog.sites, customs]);
  const selected = sites.find((s) => s.id === selectedId) ?? null;

  const runLabel = runLoad.status === "ready" ? (runLoad.reference ?? shortId(runLoad.run.runId)) : null;

  const dockRun: DockRun = useMemo(() => {
    if (runLoad.status === "loading") {
      const pct = runLoad.progress == null ? "" : ` ${Math.round(runLoad.progress * 100)}%`;
      return { kind: "loading", text: `Loading the reference run · ${runLoad.stage}${pct}` };
    }
    if (runLoad.status === "error") return { kind: "error", text: `No run loaded · ${runLoad.message}` };
    return {
      kind: "ready",
      window: runLoad.run.window,
      events: eventTimesFor(runLoad.run, selectedId),
      eventScope: eventScopeWords(runLoad.run, selectedId),
      label: runLoad.reference ?? shortId(runLoad.run.runId),
      synthetic: runLoad.run.resultState === "synthetic_demonstration",
    };
  }, [runLoad, selectedId]);

  const tracks = runData && selectedId ? (runData.sites[selectedId] ?? null) : null;
  const rightOpen = RIGHT_PANELS.find((p) => open.includes(p)) ?? null;
  // Site sky needs a run and a selected site the run holds; without them the scale falls back to the Moon
  const skyReady = !!tracks && !!selected;
  const effScale: Scale = scale === "sky" && !skyReady ? "moon" : scale;
  const inSky = effScale === "sky";
  // losing the site (deselected, or not in the run) leaves Site sky for good, so selecting again does not jump back into it
  if (scale === "sky" && !skyReady) setScale("moon");
  const needHorizon = !!tracks && (open.includes("clearance") || open.includes("sky-path") || inSky);
  const horizon = useHorizon(runData?.runId ?? null, selectedId, needHorizon);
  const readings = runData && selectedId ? cursorAt(runData, selectedId, clock.t) : null;

  /** Why a site panel has nothing to show: no run, no site, or a site the run does not hold. */
  const gate = (title: string, onClose: () => void) => {
    const text =
      runLoad.status === "loading"
        ? "Loading the run, so there is nothing to show yet."
        : runLoad.status === "error"
          ? `The run could not be loaded, so nothing is shown. ${runLoad.message}`
          : !selected
            ? "Select a site (a pin on the Moon, or the Sites list) to see its results."
            : `${selected.label} is not in the loaded run (${runLabel ?? "this run"}), so there is nothing to show for it. Use Analyse this site to compute it.`;
    return (
      <Panel title={title} onClose={onClose} focused>
        <p role="status" className="atlas-prose text-sm text-[var(--ink-dim)]">
          {text}
        </p>
      </Panel>
    );
  };

  const cursor: SiteCursor = useMemo(() => {
    if (runLoad.status === "loading") return { kind: "loading" };
    if (runLoad.status === "error") return { kind: "error", text: runLoad.message };
    if (!selectedId) return { kind: "none" };
    const readings = cursorAt(runLoad.run, selectedId, clock.t);
    if (!readings) return { kind: "not-in-run", runLabel: runLabel ?? "this run" };
    return { kind: "ready", timeLabel: utcLabel(runLoad.run.window, clock.t), runLabel: runLabel ?? "", readings };
  }, [runLoad, selectedId, clock.t, runLabel]);

  const onReady = useCallback((h: SceneHandle) => setScene(h), []);
  const onSkyReady = useCallback((h: Sky3DHandle) => {
    skyHandle.current = h;
  }, []);
  const onSkyView = useCallback((yaw: number) => setSkyYaw((cur) => (Math.round(cur) === Math.round(yaw) ? cur : yaw)), []);
  const onView = useCallback((v: ViewName) => scene?.fly(v), [scene]);
  // the right-hand panels share one column: opening one closes the others
  const toggle = useCallback(
    (p: PanelId) =>
      setOpen((o) => {
        if (o.includes(p)) return o.filter((x) => x !== p);
        return RIGHT_PANELS.includes(p) ? [...o.filter((x) => !RIGHT_PANELS.includes(x)), p] : [...o, p];
      }),
    [],
  );

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      const s = sites.find((x) => x.id === id);
      if (s) scene?.flyToSite(s.latDeg, s.lonEastDeg);
    },
    [sites, scene],
  );

  /** Add a custom point after the service has checked it. Returns a sentence when it could not be added. */
  const addCustom = useCallback(
    async (latDeg: number, lonDeg: number): Promise<string | null> => {
      if (!inTerrainData(latDeg)) return "The terrain data covers 80° S to the pole. Choose a latitude from −90 to −80.";
      if (customs.length >= MAX_CUSTOM_POINTS) return `Up to ${MAX_CUSTOM_POINTS} custom points. Remove one to add another.`;
      try {
        const check = await postJson<CustomSiteCheck>("sites/custom", {
          lat_deg: latDeg,
          lon_deg: lonDeg,
          lon_direction: "east_positive",
          convention: "planetocentric",
          source: PLACED_SOURCE,
          precision_m: PLACED_PRECISION_M,
        });
        const site = fromCustomCheck(nextCustom.current++, check);
        setCustoms((c) => [...c, site]);
        setSelectedId(site.id);
        scene?.flyToSite(site.latDeg, site.lonEastDeg);
        return null;
      } catch (e) {
        return describeError(e);
      }
    },
    [customs.length, scene],
  );

  // Place a point: while it is on, a click on the Moon proposes a point there.
  useEffect(() => {
    if (!scene) return;
    if (!placing) {
      scene.setClickHandler(null);
      return;
    }
    scene.setClickHandler((x, y) => {
      const hit = scene.pick(x, y);
      if (!hit) return void toast.message("That click did not land on the Moon.");
      void addCustom(hit.latDeg, hit.lonDeg).then((err) => (err ? toast.message(err) : toast.success("Point added and selected.")));
    });
    return () => scene.setClickHandler(null);
  }, [scene, placing, addCustom]);

  const removeCustom = useCallback((id: string) => {
    setCustoms((c) => c.filter((s) => s.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (e.key === "h" || e.key === "H") setHidden((h) => !h);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="atlas absolute inset-0 overflow-hidden" data-testid="atlas" data-scale={effScale} data-hidden={hidden} data-placing={placing}>
      <h1 className="sr-only">LunaScope Atlas: the lunar south pole</h1>
      <ExploreLoader bleed onReady={onReady} />
      {!inSky && <PinLayer scene={scene} sites={sites} selectedId={selectedId} onSelect={select} />}
      {inSky && tracks && runData && selected && (
        <SiteSky
          siteName={selected.label}
          tracks={tracks}
          horizon={horizon}
          window={runData.window}
          t={clock.t}
          look={skyLook}
          exaggeration={skyK}
          paths={skyPaths}
          onReady={onSkyReady}
          onView={onSkyView}
        />
      )}

      <p role="status" className="sr-only">
        {hidden ? "Interface hidden. Press H to show it." : ""}
      </p>
      {hidden && (
        <p aria-hidden="true" className="atlas-label pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[var(--ink-dim)]">
          Press H to show the interface
        </p>
      )}

      {!hidden && (
        <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3">
          {/* only the instruments take the mouse; everything between them is the globe (drag, zoom, click a pin) */}
          <div className="pointer-events-auto">
            <TopBar
              scale={effScale}
              onScale={setScale}
              skyReady={skyReady}
              open={open}
              onTogglePanel={toggle}
              onView={onView}
              placing={placing}
              onTogglePlacing={() => setPlacing((p) => !p)}
              runLabel={runLabel ? `Run ${runLabel}` : undefined}
            />
          </div>

          {inSky && (
            <div className="pointer-events-auto">
              <SkyControls
                look={skyLook}
                onLook={setSkyLook}
                exaggeration={skyK}
                onExaggeration={setSkyK}
                paths={skyPaths}
                onPaths={setSkyPaths}
                onFaceTarget={(t) => skyHandle.current?.faceTarget(t)}
                onFace={(az) => skyHandle.current?.face(az)}
                onReturn={() => setScale("moon")}
                yaw={skyYaw}
                has={{ sun_center: !!tracks?.sun_center, earth_center: !!tracks?.earth_center }}
              />
            </div>
          )}

          <div className="pointer-events-none flex min-h-0 flex-1 items-start justify-between gap-3">
            <div className="pointer-events-none flex h-full min-h-0 w-[min(24rem,100%)] flex-col gap-3 [&>*]:pointer-events-auto">
              {inSky && tracks && runData && (
                <div className="flex max-h-[45%] shrink-0 flex-col">
                  <MissionWindowPanel window={runData.window} t={clock.t} tracks={tracks} readings={readings} onClose={() => setScale("moon")} />
                </div>
              )}
              {open.includes("sites") && (
                <div className="flex min-h-0 flex-1 flex-col">
                  <SitesPanel
                    catalog={catalog}
                    sites={sites}
                    selectedId={selectedId}
                    onSelect={select}
                    onAddPoint={addCustom}
                    customCount={customs.length}
                    onClose={() => toggle("sites")}
                  />
                </div>
              )}
              {selected && (
                <div className="flex max-h-[40%] shrink-0 flex-col">
                  <SelectedSitePanel
                    key={selected.id}
                    site={selected}
                    cursor={cursor}
                    onCentre={() => scene?.flyToSite(selected.latDeg, selected.lonEastDeg)}
                    onReset={() => scene?.fly("south-pole")}
                    onRemove={selected.kind === "custom" ? () => removeCustom(selected.id) : undefined}
                    onClose={() => setSelectedId(null)}
                    onEnterSky={tracks ? () => setScale("sky") : undefined}
                  />
                </div>
              )}
              {open.includes("timeline") && (
                <div className="flex max-h-[62%] shrink-0 flex-col">
                  {tracks && runData && selected ? (
                    <TimelinePanel siteLabel={selected.label} tracks={tracks} window={runData.window} t={clock.t} onSeek={actions.seek} onClose={() => toggle("timeline")} />
                  ) : (
                    gate("Timeline", () => toggle("timeline"))
                  )}
                </div>
              )}
            </div>
            <div className="pointer-events-none flex h-full min-h-0 w-[min(26rem,100%)] flex-col items-end gap-3">
              <Readout
                scaleLabel={inSky ? skyScaleLabel(skyK) : SCALE_LABEL[effScale]}
                timeLabel={runData ? utcLabel(runData.window, clock.t) : "NO RUN LOADED"}
                extra={
                  inSky && readings
                    ? readings.map((r) => ({
                        label: r.target === "sun_center" ? "Sun" : "Earth",
                        tag: "derived" as const,
                        value: `AZ ${r.azDeg.toFixed(1)}° · EL ${r.elDeg >= 0 ? "+" : "−"}${Math.abs(r.elDeg).toFixed(2)}°`,
                      }))
                    : []
                }
              />
              {placing && (
                <p role="status" className="atlas-panel atlas-label pointer-events-auto px-3 py-2 text-[var(--ink)]">
                  Click the Moon to place a point · latitude −90 to −80
                </p>
              )}
              {rightOpen && (
                <div className="pointer-events-auto flex min-h-0 w-full flex-1 flex-col" data-testid="right-panel" data-panel={rightOpen}>
                  {rightOpen === "learn" && <LearnPanel onClose={() => toggle("learn")} />}
                  {rightOpen === "metrics" &&
                    (tracks && selected && runData ? (
                      <MetricsPanel siteLabel={selected.label} tracks={tracks} cursor={readings} timeLabel={utcLabel(runData.window, clock.t)} onClose={() => toggle("metrics")} />
                    ) : (
                      gate("Metrics", () => toggle("metrics"))
                    ))}
                  {rightOpen === "clearance" &&
                    (tracks && selected && runData ? (
                      <ClearancePanel siteLabel={selected.label} tracks={tracks} window={runData.window} t={clock.t} horizon={horizon} onSeek={actions.seek} onClose={() => toggle("clearance")} />
                    ) : (
                      gate("Clearance", () => toggle("clearance"))
                    ))}
                  {rightOpen === "sky-path" &&
                    (tracks && selected ? (
                      <SkyPathPanel siteLabel={selected.label} tracks={tracks} t={clock.t} horizon={horizon} onClose={() => toggle("sky-path")} />
                    ) : (
                      gate("Sky path", () => toggle("sky-path"))
                    ))}
                  {rightOpen === "compare" &&
                    (runData && Object.keys(runData.sites).length >= 2 ? (
                      <ComparePanel
                        runId={runData.runId}
                        siteIds={Object.keys(runData.sites)}
                        nameOf={(id) => sites.find((s) => s.id === id)?.label ?? id}
                        onClose={() => toggle("compare")}
                      />
                    ) : (
                      <Panel title="Compare" onClose={() => toggle("compare")} focused>
                        <p role="status" className="atlas-prose text-sm text-[var(--ink-dim)]">
                          {runData ? "This run has fewer than two sites, so there is nothing to compare." : "No run is loaded, so there is nothing to compare."}
                        </p>
                      </Panel>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="pointer-events-auto">
            <TimeDock run={dockRun} clock={clock} actions={actions} reducedMotion={reducedMotion} />
          </div>
        </div>
      )}
    </div>
  );
}
