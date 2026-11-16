"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { Sky3DHandle } from "@/components/Sky3D";
import { MoonOrbitHud } from "@/components/atlas/MoonOrbitHud";
import { PlannerPanel } from "@/components/atlas/PlannerPanel";
import { Presence } from "@/components/atlas/Presence";
import { SystemDatePanel } from "@/components/atlas/SystemDatePanel";
import { LearnPanel } from "@/components/atlas/LearnPanel";
import { MissionWindowPanel } from "@/components/atlas/MissionWindowPanel";
import { SiteSky } from "@/components/atlas/SiteSky";
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
import { RunsPanel } from "@/components/atlas/RunsPanel";
import { analyseDraft } from "@/components/atlas/SelectedSitePanel";
import { RIGHT_PANELS, TopBar, WIDE_PANELS, type PanelId, type Scale } from "@/components/atlas/TopBar";
import { useHorizon } from "@/components/atlas/useHorizon";
import { useTerrainPatch } from "@/components/atlas/useTerrainPatch";
import { useCatalog } from "@/components/atlas/useCatalog";
import { PHONE_QUERY, useMediaQuery } from "@/components/atlas/useMediaQuery";
import { useClock } from "@/components/atlas/useClock";
import { useReplayMode } from "@/components/DataStatusBanner";
import { RUN_LOCALLY_URL } from "@/lib/atlas/offline";
import { referenceFor } from "@/lib/atlas/reference-sites";
import { useRun } from "@/components/atlas/useRun";
import { useRunRequest, useSiteRuns } from "@/components/atlas/useSiteRuns";
import { AnalyzeForm } from "@/components/AnalyzeForm";
import { EvidencePanel } from "@/components/EvidencePanel";
import { TimeMachineView } from "@/components/TimeMachineView";
import { searchFor, targetFromSearch, type RunTarget } from "@/lib/atlas/run-target";
import { SHARE_PARAM, type Draft } from "@/lib/draft";
import { rememberRun } from "@/lib/recent-runs";
import { ExploreLoader } from "@/components/explore/ExploreLoader";
import type { SceneHandle } from "@/components/explore/ExploreViewer";
import { describeError, postJson } from "@/lib/api/client";
import type { CustomSiteCheck } from "@/lib/api/types";
import { fromCustomCheck, inTerrainData, MAX_CUSTOM_POINTS, type AtlasSite } from "@/lib/atlas/sites";
import { speedSeconds, utcLabel, type RunWindow } from "@/lib/atlas/clock";
import { cursorAt, eventScopeWords, eventTimesFor } from "@/lib/atlas/run";
import { mergeRuns, runIdFor, serviceSiteId } from "@/lib/atlas/site-run";
import { skyScaleLabel } from "@/lib/atlas/sky";
import { shortId, siteLabel as nameOfSite } from "@/lib/format";
import type { ViewName } from "@/lib/explore/geometry";

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** three.js loads here, on the first visit to the System scale. */
const SystemView = dynamic(() => import("@/components/atlas/SystemView").then((m) => m.SystemView), { ssr: false });

const SCALE_LABEL: Record<Scale, string> = { moon: "MOON SCALE", system: "SYSTEM SCALE", sky: "SITE SKY" };

/** Placed points are checked by the service, and the precision is a stated assumption for a point set by hand. */
const PLACED_SOURCE = "Placed by hand in the Atlas";
const PLACED_PRECISION_M = 1000;

/**
 * The Atlas frame (spec 3 and 4): one full-screen scene, floating instruments on top, one time dock underneath.
 * Phase C adds the sites: pins on the Moon, a Sites list, the selected-site card and custom points. The clock and the
 * result panels arrive in later phases. H hides the interface (for screenshots) and shows it again.
 */
export function AtlasShell({ initialSearch = "" }: { initialSearch?: string } = {}) {
  const catalog = useCatalog();
  const phone = useMediaQuery(PHONE_QUERY);
  const [target, setTarget] = useState<RunTarget>(() => targetFromSearch(initialSearch));
  const runLoad = useRun(target);
  // the loaded run, and the sites computed separately for places it does not hold, merged into one view
  const baseRun = runLoad.status === "ready" ? runLoad.run : null;
  const baseRequest = useRunRequest(baseRun?.runId ?? null);
  const siteRuns = useSiteRuns(baseRun?.runId ?? null, baseRun?.window ?? null, baseRequest);
  const runData = useMemo(() => (baseRun ? mergeRuns(baseRun, siteRuns.extras) : null), [baseRun, siteRuns.extras]);
  const [scale, setScale] = useState<Scale>("moon");
  // The System scale needs no run: without one it plays a month from the current hour, so the orbit works with the service down
  const [defaultStart] = useState(() => Math.floor(Date.now() / 3600000) * 3600000);
  // a date picked in the System scale replaces the run window there, and playing it covers a month from that date
  const [pickedStart, setPickedStart] = useState<number | null>(null);
  // the run the Planner started, so it can say "computing" until that run is the one loaded
  const [plannerRun, setPlannerRun] = useState<string | null>(null);
  const orbitWindow = useMemo<RunWindow>(() => ({ startMs: pickedStart ?? defaultStart, totalS: 28 * 86400 }), [pickedStart, defaultStart]);
  // no run to play (the service is down): the clock plays the orbit preview instead, so the Moon scale and the System scale still move
  const orbitOnly = (scale === "system" && (!runData || pickedStart != null)) || (!runData && runLoad.status === "error");
  const clockWindow = orbitOnly ? orbitWindow : (runData?.window ?? null);
  const { clock, actions, reducedMotion } = useClock(clockWindow);
  // a link carrying analysis inputs (the classic share link) opens the Analyse panel with them filled in
  const [open, setOpen] = useState<PanelId[]>(() => (new URLSearchParams(initialSearch).has(SHARE_PARAM) ? ["sites", "analyse"] : ["sites", "planner"]));
  // on a phone nothing opens on its own, so the Moon is the first thing seen (adjusted once, during render, not in an effect)
  const [phoneSeen, setPhoneSeen] = useState(false);
  if (phone && !phoneSeen) {
    setPhoneSeen(true);
    setOpen((o) => (o.length > 1 ? [o[o.length - 1]] : o.filter((x) => x !== "sites")));
  }
  const [analyseSeed, setAnalyseSeed] = useState<{ draft: Draft; n: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [scene, setScene] = useState<SceneHandle | null>(null);
  const [customs, setCustoms] = useState<AtlasSite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [skyK, setSkyK] = useState(1);
  const [skyPaths, setSkyPaths] = useState({ sun_center: true, earth_center: true });
  const [skyYaw, setSkyYaw] = useState(0);
  const [skyLander, setSkyLander] = useState(true);
  const skyHandle = useRef<Sky3DHandle | null>(null);
  const nextCustom = useRef(1);

  const sites = useMemo(() => [...catalog.sites, ...customs], [catalog.sites, customs]);
  const selected = sites.find((s) => s.id === selectedId) ?? null;

  const runLabel = runLoad.status === "ready" ? (runLoad.reference ?? shortId(runLoad.run.runId)) : null;

  const dockRun: DockRun = useMemo(() => {
    if (orbitOnly) return { kind: "ready", window: orbitWindow, events: [], eventScope: "the orbit preview", label: "Orbit preview", synthetic: false };
    if (runLoad.status === "loading") {
      const pct = runLoad.progress == null ? "" : ` ${Math.round(runLoad.progress * 100)}%`;
      return { kind: "loading", text: `Loading the reference run · ${runLoad.stage}${pct}` };
    }
    if (runLoad.status === "error") return { kind: "error", text: `No run loaded · ${runLoad.message}`, retry: runLoad.retry };
    return {
      kind: "ready",
      window: runLoad.run.window,
      events: eventTimesFor(runData ?? runLoad.run, selectedId),
      eventScope: eventScopeWords(runData ?? runLoad.run, selectedId),
      label: runLoad.reference ?? shortId(runLoad.run.runId),
      synthetic: runLoad.run.resultState === "synthetic_demonstration",
    };
  }, [runLoad, runData, selectedId, orbitOnly, orbitWindow]);

  const tracks = runData && selectedId ? (runData.sites[selectedId] ?? null) : null;
  const rightOpen = RIGHT_PANELS.find((p) => open.includes(p)) ?? null;
  // Site sky needs a run and a selected site the run holds; without them the scale falls back to the Moon
  const skyReady = !!tracks && !!selected;
  const effScale: Scale = scale === "sky" && !skyReady ? "moon" : scale;
  const inSky = effScale === "sky";
  const inSystem = effScale === "system";
  // losing the site (deselected, or not in the run) leaves Site sky for good, so selecting again does not jump back into it
  if (scale === "sky" && !skyReady) setScale("moon");
  const needHorizon = !!tracks && (open.includes("clearance") || open.includes("sky-path") || inSky);
  const offline = useReplayMode();
  const terrain = useTerrainPatch(selected?.latDeg ?? null, selected?.lonEastDeg ?? null, inSky);
  const horizon = useHorizon(runData && selectedId ? runIdFor(runData, selectedId) : null, runData && selectedId ? serviceSiteId(runData, selectedId) : null, needHorizon);
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
            : `${selected.label} is not in the loaded run (${runLabel ?? "this run"}), so there is nothing to show for it yet. Press Compute sky for this site on its card.`;
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
    const readings = cursorAt(runData ?? runLoad.run, selectedId, clock.t);
    if (!readings) return { kind: "not-in-run", runLabel: runLabel ?? "this run" };
    return { kind: "ready", timeLabel: utcLabel(runLoad.run.window, clock.t), runLabel: runLabel ?? "", readings };
  }, [runLoad, runData, selectedId, clock.t, runLabel]);

  /** Load another run into the Atlas, and keep the address in step so the view can be shared. */
  const chooseRun = useCallback((t: RunTarget) => {
    setTarget(t);
    try {
      const q = searchFor(t, window.location.search);
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    } catch {
      /* the address is a convenience */
    }
  }, []);

  // runs the person opens are remembered on this device, with a label from the site names the service returned
  const readyRunId = runLoad.status === "ready" ? runLoad.run.runId : null;
  const readyState = runLoad.status === "ready" ? runLoad.run.resultState : undefined;
  const readySites = runLoad.status === "ready" ? Object.keys(runLoad.run.sites).join("|") : "";
  useEffect(() => {
    const ids = readySites ? readySites.split("|") : [];
    if (!readyRunId || !ids.length) return;
    rememberRun({ id: readyRunId, label: ids.length > 1 ? `${nameOfSite(ids[0])} and ${ids.length - 1} more` : nameOfSite(ids[0]), state: readyState, sites: ids });
  }, [readyRunId, readyState, readySites]);

  // the Moon is lit by the Sun at the clock's time (the run's start until a run is loaded, otherwise the present)
  const sunMs = clockWindow ? clockWindow.startMs + clock.t * 1000 : null;
  useEffect(() => {
    scene?.setSunTime(sunMs ?? Date.now());
  }, [scene, sunMs]);
  // tell the Moon view how the clock runs, so it draws every frame while time plays
  const rateNow = (clock.reverse ? -1 : 1) * speedSeconds(clock.speed);
  const loMs = clockWindow?.startMs ?? 0;
  const hiMs = clockWindow ? clockWindow.startMs + clockWindow.totalS * 1000 : 0;
  useEffect(() => {
    scene?.setPlayback(clock.playing && !!clockWindow, rateNow, loMs, hiMs);
  }, [scene, clock.playing, clockWindow, rateNow, loMs, hiMs]);
  const onReady = useCallback((h: SceneHandle) => setScene(h), []);
  const onSkyReady = useCallback((h: Sky3DHandle) => {
    skyHandle.current = h;
  }, []);
  const onSkyView = useCallback((yaw: number) => setSkyYaw((cur) => (Math.round(cur) === Math.round(yaw) ? cur : yaw)), []);
  const onView = useCallback((v: ViewName) => scene?.fly(v), [scene]);

  /**
   * Change scale as one move, not a cut (the way a place search flies in Google Earth): into Site sky the Moon dives onto the site first;
   * into System it pulls away from the Moon first, and the System view then arrives close to the Moon and pulls back; out of either, the
   * Moon flies back to where it was while the other scene fades and dives away. Clicks during the move are ignored.
   */
  const moving = useRef<number | null>(null);
  const scaleRef = useRef(scale);
  const playingRef = useRef(clock.playing);
  useEffect(() => {
    playingRef.current = clock.playing;
  }, [clock.playing]);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => () => {
    if (moving.current != null) window.clearTimeout(moving.current);
  }, []);
  const goScale = useCallback(
    (next: Scale) => {
      const from = scaleRef.current;
      if (moving.current != null || next === from) return;
      const site = sites.find((x) => x.id === selectedId);
      const commit = () => {
        moving.current = null;
        setScale(next);
      };
      if (!scene) return commit();
      let wait = 0;
      if (from === "moon" && next === "sky" && site) wait = scene.dive(site.latDeg, site.lonEastDeg);
      else if (from === "moon" && next === "system") wait = scene.zoomOut();
      else if (next === "moon" && site) scene.flyToSite(site.latDeg, site.lonEastDeg);
      else if (next === "moon") scene.fly("moon");
      if (wait <= 0) return commit();
      moving.current = window.setTimeout(commit, wait * 1000 * 0.9);
    },
    [scene, sites, selectedId],
  );
  // arriving in System (or picking a new date there) starts the orbit: a day of time per second, so the Moon goes round in about half a minute
  const autoPlayed = useRef<string | null>(null);
  useEffect(() => {
    if (scale !== "system") {
      autoPlayed.current = null;
      return;
    }
    const key = clockWindow ? String(clockWindow.startMs) : null;
    if (!key || autoPlayed.current === key) return;
    autoPlayed.current = key;
    actions.setSpeed("1d");
    if (!playingRef.current) actions.toggle();
  }, [scale, clockWindow, actions]);
  // the right-hand panels share one column: opening one closes the others
  const toggle = useCallback(
    (p: PanelId) =>
      setOpen((o) => {
        if (o.includes(p)) return o.filter((x) => x !== p);
        if (phone) return [p]; // a phone shows one sheet at a time
        return RIGHT_PANELS.includes(p) ? [...o.filter((x) => !RIGHT_PANELS.includes(x)), p] : [...o, p];
      }),
    [phone],
  );

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (phone) setOpen((o) => o.filter((x) => x !== "sites")); // the card replaces the list on a phone
      const s = sites.find((x) => x.id === id);
      if (s) scene?.flyToSite(s.latDeg, s.lonEastDeg);
    },
    [sites, scene, phone],
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

  // the pieces of the middle of the screen, so the desktop columns and the phone sheet use the same ones
  const readoutEl = (
              <Readout compact={phone}
                scaleLabel={inSky ? skyScaleLabel(skyK) : SCALE_LABEL[effScale]}
                timeLabel={clockWindow ? utcLabel(clockWindow, clock.t) : "NO RUN LOADED"}
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
  );
  const placingEl = (
    <>
              {placing && (
                <p role="status" className="atlas-panel atlas-label pointer-events-auto px-3 py-2 text-[var(--ink)]">
                  Click the Moon to place a point · latitude −90 to −80
                </p>
              )}
    </>
  );
  const leftStack = (
    <>
              {inSystem && clockWindow && (
                <div className={phone ? "flex min-h-0 flex-col" : "flex min-h-0 flex-1 flex-col"}>
                  <SystemDatePanel utcMs={clockWindow.startMs + clock.t * 1000} custom={pickedStart != null} onPick={setPickedStart} onReset={() => setPickedStart(null)} />
                </div>
              )}
              {inSky && tracks && runData && (!phone || open.length === 0) && (
                <div className={phone ? "flex min-h-0 flex-col" : "flex max-h-[45%] shrink-0 flex-col"}>
                  <MissionWindowPanel window={runData.window} t={clock.t} tracks={tracks} readings={readings} onClose={() => setScale("moon")} />
                </div>
              )}
              {!inSystem && open.includes("sites") && (
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
              {!inSystem && selected && (!phone || open.length === 0) && (
                <div className={phone ? "flex min-h-0 flex-col" : "flex max-h-[40%] shrink-0 flex-col"}>
                  <SelectedSitePanel
                    key={selected.id}
                    site={selected}
                    cursor={cursor}
                    onCentre={() => scene?.flyToSite(selected.latDeg, selected.lonEastDeg)}
                    onReset={() => scene?.fly("south-pole")}
                    onRemove={selected.kind === "custom" ? () => removeCustom(selected.id) : undefined}
                    onClose={() => setSelectedId(null)}
                    onEnterSky={tracks ? () => goScale("sky") : undefined}
                    savedRun={(() => {
                      const ref = referenceFor(selected.id);
                      return ref ? { label: ref.label, onOpen: () => chooseRun({ kind: "reference", id: ref.id }) } : undefined;
                    })()}
                    compute={!tracks ? { offline, canStart: siteRuns.canCompute, state: siteRuns.states[selected.id], onStart: () => siteRuns.compute(selected) } : undefined}
                    onAnalyse={() => {
                      setAnalyseSeed((cur) => ({ draft: analyseDraft(selected), n: (cur?.n ?? 0) + 1 }));
                      setOpen((o) => [...o.filter((x) => !RIGHT_PANELS.includes(x)), "analyse"]);
                    }}
                  />
                </div>
              )}
              {open.includes("timeline") && (
                <div className={phone ? "flex min-h-0 flex-col" : "flex max-h-[62%] shrink-0 flex-col"}>
                  {tracks && runData && selected ? (
                    <TimelinePanel siteLabel={selected.label} tracks={tracks} window={runData.window} t={clock.t} onSeek={actions.seek} onClose={() => toggle("timeline")} />
                  ) : (
                    gate("Timeline", () => toggle("timeline"))
                  )}
                </div>
              )}
    </>
  );
  const rightPanelEl = (
    <>
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
                  {rightOpen === "planner" && (
                    <Panel title="Planner" onClose={() => toggle("planner")} focused className="max-h-full" bodyClassName="atlas-prose">
                      <PlannerPanel
                        sites={sites}
                        selectedId={selectedId}
                        onSelect={select}
                        runWindow={runData?.window ?? null}
                        runLabel={runLabel}
                        tracks={tracks}
                        loadNote={
                          runLoad.status === "loading"
                            ? { kind: "loading", text: "Loading the run…" }
                            : runLoad.status === "error"
                              ? { kind: "error", text: `No run is loaded: ${runLoad.message}` }
                              : null
                        }
                        canCompute={!offline}
                        startedRunId={plannerRun}
                        loadedRunId={readyRunId}
                        onStarted={(id) => {
                          setPlannerRun(id);
                          chooseRun({ kind: "run", id });
                        }}
                        onEnterSky={tracks ? () => goScale("sky") : undefined}
                      />
                    </Panel>
                  )}
                  {rightOpen === "runs" && <RunsPanel current={target} onChoose={chooseRun} onClose={() => toggle("runs")} />}
                  {rightOpen === "analyse" && (
                    <Panel title="Analyse" onClose={() => toggle("analyse")} focused className="max-h-full" bodyClassName="atlas-prose">
                      {offline ? (
                        <p data-testid="analyse-offline">
                          This copy of LunaScope is offline: it shows the saved reference runs and cannot compute a new analysis. Open GR-001, GR-002
                          or GR-003 from the Runs panel. To analyse your own sites and dates, run LunaScope on your computer:{" "}
                          <a href={RUN_LOCALLY_URL} target="_blank" rel="noreferrer" className="text-[var(--ink)] underline underline-offset-4">
                            how to run it locally
                          </a>
                          .
                        </p>
                      ) : (
                      <AnalyzeForm
                        key={analyseSeed?.n ?? 0}
                        seed={analyseSeed?.draft ?? null}
                        onStarted={(id) => {
                          chooseRun({ kind: "run", id });
                          toast.success("Run started. It opens here when it finishes.");
                          setOpen((o) => o.filter((x) => x !== "analyse"));
                        }}
                      />
                      )}
                    </Panel>
                  )}
                  {rightOpen === "dates" &&
                    (runData ? (
                      <Panel title="Dates" onClose={() => toggle("dates")} focused className="max-h-full" bodyClassName="atlas-prose">
                        <TimeMachineView key={runData.runId} runId={runData.runId} embedded />
                      </Panel>
                    ) : (
                      <Panel title="Dates" onClose={() => toggle("dates")} focused>
                        <p role="status" className="atlas-prose text-sm text-[var(--ink-dim)]">
                          {runLoad.status === "loading" ? "Loading the run, so there is nothing to shift yet." : "No run is loaded, so there are no dates to test."}
                        </p>
                      </Panel>
                    ))}
                  {rightOpen === "evidence" &&
                    (runData ? (
                      <Panel title="Evidence" onClose={() => toggle("evidence")} focused className="max-h-full" bodyClassName="atlas-prose">
                        <EvidencePanel key={runData.runId} runId={runData.runId} embedded />
                      </Panel>
                    ) : (
                      <Panel title="Evidence" onClose={() => toggle("evidence")} focused>
                        <p role="status" className="atlas-prose text-sm text-[var(--ink-dim)]">
                          {runLoad.status === "loading" ? "Loading the run, so there is no evidence to show yet." : "No run is loaded, so there is no evidence to show."}
                        </p>
                      </Panel>
                    ))}
                  {rightOpen === "compare" &&
                    (baseRun && Object.keys(baseRun.sites).length >= 2 ? (
                      <ComparePanel
                        runId={baseRun.runId}
                        siteIds={Object.keys(baseRun.sites)}
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
    </>
  );

  return (
    <div className="atlas absolute inset-0 overflow-hidden" data-testid="atlas" data-scale={effScale} data-hidden={hidden} data-placing={placing}>
      <h1 className="sr-only">LunaScope Atlas: the lunar south pole</h1>
      <ExploreLoader bleed onReady={onReady} />
      {!inSky && !inSystem && <PinLayer scene={scene} sites={sites} selectedId={selectedId} onSelect={select} />}
      {scale === "moon" && !hidden && !rightOpen && clockWindow && <MoonOrbitHud utcMs={clockWindow.startMs + clock.t * 1000} playing={clock.playing} rate={(clock.reverse ? -1 : 1) * speedSeconds(clock.speed)} lo={clockWindow.startMs} hi={clockWindow.startMs + clockWindow.totalS * 1000} />}
      <Presence show={inSystem && !!clockWindow}>
        {clockWindow && <SystemView startMs={clockWindow.startMs} totalS={clockWindow.totalS} utcMs={clockWindow.startMs + clock.t * 1000} playing={clock.playing} rate={(clock.reverse ? -1 : 1) * speedSeconds(clock.speed)} />}
      </Presence>
      {inSystem && (
        <p className="atlas-panel atlas-label pointer-events-none absolute bottom-[9.5rem] right-3 z-10 max-w-sm px-3 py-2 text-right text-[var(--ink-dim)]" data-testid="system-note">
          Not to scale: the Earth and Moon are drawn 6× larger, and the Sun-Earth distance and the Moon's orbit are shortened so all three fit. Where the Sun is, the Moon's phase and the lighting are real. Positions are a display estimate.
        </p>
      )}
      <Presence show={inSky && !!tracks && !!runData && !!selected}>
      {tracks && runData && selected && (
        <SiteSky
          siteName={selected.label}
          tracks={tracks}
          horizon={horizon}
          terrain={terrain}
          window={runData.window}
          t={clock.t}
          look="look"
          exaggeration={skyK}
          paths={skyPaths}
          lander={skyLander}
          onReady={onSkyReady}
          onView={onSkyView}
        />
      )}
      </Presence>

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
              onScale={goScale}
              skyReady={skyReady}
              open={open}
              onTogglePanel={toggle}
              onView={onView}
              placing={placing}
              onTogglePlacing={() => setPlacing((p) => !p)}
              canPlace={!offline}
              runLabel={runLabel ? `Run ${runLabel}` : undefined}
              compact={phone}
            />
          </div>

          {inSky && (
            <div className="pointer-events-auto">
              <SkyControls
                look="look"
                exaggeration={skyK}
                onExaggeration={setSkyK}
                paths={skyPaths}
                onPaths={setSkyPaths}
                lander={skyLander}
                onLander={setSkyLander}
                onFaceTarget={(t) => skyHandle.current?.faceTarget(t)}
                onFace={(az) => skyHandle.current?.face(az)}
                onReturn={() => goScale("moon")}
                yaw={skyYaw}
                has={{ sun_center: !!tracks?.sun_center, earth_center: !!tracks?.earth_center }}
                compact={phone}
              />
            </div>
          )}

          {phone ? (
            /* phone: one bottom sheet at a time, the time and scale on a line above it */
            <div className="pointer-events-none flex min-h-0 flex-1 flex-col justify-between gap-2" data-testid="phone-layout">
              <div className="flex justify-end">{readoutEl}</div>
              <div className="pointer-events-none flex min-h-0 max-h-[min(66%,34rem)] flex-col gap-2 [&>*]:pointer-events-auto">
                {placingEl}
                {leftStack}
                {rightPanelEl}
              </div>
            </div>
          ) : (
            <div className="pointer-events-none flex min-h-0 flex-1 items-start justify-between gap-3">
              <div className="pointer-events-none flex h-full min-h-0 w-[min(24rem,100%)] flex-col gap-3 [&>*]:pointer-events-auto">
                {leftStack}
              </div>
              <div className={`pointer-events-none flex h-full min-h-0 ${rightOpen && WIDE_PANELS.includes(rightOpen) ? "w-[min(44rem,100%)]" : "w-[min(26rem,100%)]"} flex-col items-end gap-3`} data-wide={!!rightOpen && WIDE_PANELS.includes(rightOpen)}>
                {readoutEl}
                {placingEl}
                {rightPanelEl}
              </div>
            </div>
          )}

          <div className="pointer-events-auto">
            <TimeDock run={dockRun} clock={clock} actions={actions} reducedMotion={reducedMotion} compact={phone} />
          </div>
        </div>
      )}
    </div>
  );
}
