"use client";

import { useMemo, useState } from "react";
import { Tag } from "@/components/atlas/Tag";
import { ApiError, describeError, postJson } from "@/lib/api/client";
import type { RunSummary, Target } from "@/lib/api/types";
import { utcLabel, type RunWindow } from "@/lib/atlas/clock";
import type { Track } from "@/lib/atlas/run";
import type { AtlasSite } from "@/lib/atlas/sites";
import { metricsView, TARGET_SUBJECT, TARGET_WORDS, timelineSummary } from "@/lib/atlas/views";
import { encodeShare, referenceDraft, SHARE_PARAM, toRequest, validateDraft, type Draft } from "@/lib/draft";

const STEPS = ["Where", "When", "Answer", "Brief"] as const;
type Step = 0 | 1 | 2 | 3;

const LENGTHS = [
  { label: "3 days", days: "3" },
  { label: "14 days", days: "14" },
  { label: "A full day and night (29.5)", days: "29.5" },
];

const TARGETS: Target[] = ["sun_center", "earth_center"];

/** "2027-01-10": today in UTC. */
const todayIso = () => new Date().toISOString().slice(0, 10);

type Props = {
  sites: AtlasSite[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The loaded run's window and name, and the selected site's results in it (null when the run does not hold the site). */
  runWindow: RunWindow | null;
  runLabel: string | null;
  tracks: Partial<Record<Target, Track>> | null;
  /** Why there is nothing to show yet (the run is loading or could not be loaded). */
  loadNote: { kind: "loading" | "error"; text: string } | null;
  /** False on an offline copy: saved runs can still be read, but a new one cannot be computed. */
  canCompute: boolean;
  /** A run the planner started has been loaded (or is the one now loaded). */
  startedRunId: string | null;
  loadedRunId: string | null;
  onStarted: (runId: string) => void;
  onEnterSky?: () => void;
};

const dash = "—";

/**
 * The Planner: a guided way to the question the Atlas is for, "can we land here, on this date, and have the Sun and the Earth in view?".
 * Where (a site) → When (a date, how long, your limits) → Answer (the science service's availability for the Sun and the Earth against
 * those limits) → Brief (a short summary to copy). Every number is the service's; this panel only asks and arranges. It can also read the
 * run that is already loaded, so the saved reference runs answer without the service.
 */
export function PlannerPanel(p: Props) {
  const [step, setStep] = useState<Step>(0);
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState(todayIso);
  const [days, setDays] = useState("14");
  const [sunMin, setSunMin] = useState("60");
  const [earthMin, setEarthMin] = useState("50");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const selected = p.sites.find((s) => s.id === p.selectedId) ?? null;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return p.sites.filter((s) => !q || s.label.toLowerCase().includes(q) || s.group.toLowerCase().includes(q));
  }, [p.sites, query]);

  /** The inputs as the analysis form holds them; a typed point goes in as a custom point, a catalog site by its id. */
  const draft = (site: AtlasSite): Draft => {
    const base = referenceDraft(site.kind === "custom" ? [] : [site.id]);
    return {
      ...base,
      startDate,
      durationDays: days,
      sunMinPct: sunMin,
      earthMinPct: earthMin,
      custom:
        site.kind === "custom"
          ? [{ lat: String(Number(site.latDeg.toFixed(6))), lon: String(Number(site.lonEastDeg.toFixed(6))), direction: "east_positive", source: site.source.slice(0, 200), precision: String(site.precisionM) }]
          : [],
    };
  };

  async function run() {
    if (!selected) return;
    const d = draft(selected);
    // a typed point is computed with the loaded run's window by the Atlas itself; the run that sets the window needs a catalog site
    if (selected.kind === "custom") {
      const anchor = p.sites.find((s) => s.kind !== "custom");
      if (!anchor) {
        setError("There is no catalog site to anchor the run to.");
        return;
      }
      d.siteIds = [anchor.id];
      d.custom = [];
    }
    const errs = validateDraft(d);
    const first = Object.values(errs)[0];
    if (first) {
      setError(first);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await postJson<RunSummary>("analyses", toRequest(d));
      p.onStarted(out.run_id);
      setStep(2);
    } catch (e) {
      setError(e instanceof ApiError ? describeError(e) : describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const verdict = useMemo(() => {
    if (!p.tracks) return null;
    const outcomes = TARGETS.flatMap((t) => (p.tracks?.[t] ? [p.tracks[t]!.terrain.metrics.outcome] : []));
    if (!outcomes.length) return null;
    if (outcomes.includes("FAIL")) return { tone: "fail", head: "Does not meet your limits", body: "At least one of the Sun or the Earth is below your limit even at the best end of its range." } as const;
    if (outcomes.every((o) => o === "PASS")) return { tone: "ok", head: "Meets your limits", body: "Both the Sun and the Earth meet your limits even at the cautious end of their ranges." } as const;
    return { tone: "warn", head: "Cannot be settled", body: "The ranges straddle at least one limit, so neither a pass nor a fail can be claimed." } as const;
  }, [p.tracks]);

  const windowText = p.runWindow ? `${utcLabel(p.runWindow, 0)} to ${utcLabel(p.runWindow, p.runWindow.totalS)}` : null;

  const brief = useMemo(() => {
    if (!selected || !p.tracks || !p.runWindow) return null;
    const lines = [
      `LunaScope landing brief: ${selected.label}`,
      `Latitude ${selected.latDeg.toFixed(3)}, east longitude ${selected.lonEastDeg.toFixed(3)}`,
      `Window: ${windowText}${p.runLabel ? ` (run ${p.runLabel})` : ""}`,
      "",
      timelineSummary(p.tracks),
      ...TARGETS.flatMap((t) => {
        const tr = p.tracks?.[t];
        if (!tr) return [];
        const m = metricsView(t, tr);
        return [`${TARGET_WORDS[t]}: ${m.outcome.label}. Availability ${m.availability}, ${m.needs}. Longest time hidden ${m.longestHidden}.`];
      }),
      "",
      "Visibility results only. Not a power figure, a radio link or a landing-safety assessment.",
    ];
    return lines.join("\n");
  }, [selected, p.tracks, p.runWindow, p.runLabel, windowText]);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied(`${what} could not be copied; select the text and copy it.`);
    }
  }

  const shareLink = selected && selected.kind !== "custom" ? `${typeof window === "undefined" ? "" : window.location.origin}/atlas?${SHARE_PARAM}=${encodeShare(draft(selected))}` : null;

  const field = "rounded border border-[var(--panel-edge)] bg-black px-2 py-1.5 text-[var(--ink)]";

  return (
    <div className="flex flex-col gap-3 text-sm" data-testid="planner">
      <div role="tablist" aria-label="Planner steps" className="grid grid-cols-4 gap-1">
        {STEPS.map((name, i) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={step === i}
            className="atlas-key atlas-label"
            onClick={() => setStep(i as Step)}
          >
            {i + 1} {name}
          </button>
        ))}
      </div>

      {step === 0 && (
        <section aria-label="Where" className="flex flex-col gap-2">
          <h3 className="text-lg text-[var(--ink)]">Where do you want to land?</h3>
          <p className="text-[var(--ink-dim)]">Pick a site here, or click a pin on the Moon.</p>
          <input
            type="search"
            placeholder="Find a site by name"
            aria-label="Find a site"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={field}
          />
          <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto" data-testid="planner-sites">
            {shown.length === 0 && <li className="text-[var(--ink-dim)]">No site matches.</li>}
            {shown.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={s.id === p.selectedId}
                  onClick={() => p.onSelect(s.id)}
                  className="atlas-key flex w-full flex-col items-start text-left"
                >
                  <span className="text-[var(--ink)]">{s.label}</span>
                  <span className="atlas-label text-[var(--ink-dim)]">
                    {Math.abs(s.latDeg).toFixed(2)}° {s.latDeg < 0 ? "S" : "N"} · {s.lonEastDeg.toFixed(2)}° E
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="atlas-key atlas-label self-end" disabled={!selected} onClick={() => setStep(1)}>
            Next: choose a date
          </button>
        </section>
      )}

      {step === 1 && (
        <section aria-label="When" className="flex flex-col gap-3">
          <h3 className="text-lg text-[var(--ink)]">When, and for how long?</h3>
          <p className="text-[var(--ink-dim)]">
            {selected ? `For ${selected.label}.` : "Choose a site first."} Sun and Earth positions are available for 1969 to 1972, 2019 and 2024 to 2040. Times are UTC.
          </p>
          <label className="atlas-label flex flex-col gap-1 text-[var(--ink-dim)]">
            Window starts (UTC date)
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
          </label>
          <div className="flex flex-wrap gap-1" role="group" aria-label="How long">
            {LENGTHS.map((l) => (
              <button key={l.days} type="button" aria-pressed={days === l.days} className="atlas-key atlas-label" onClick={() => setDays(l.days)}>
                {l.label}
              </button>
            ))}
          </div>
          <label className="atlas-label flex flex-col gap-1 text-[var(--ink-dim)]">
            Window length in Earth days (one lunar day and night is 29.5)
            <input inputMode="decimal" value={days} onChange={(e) => setDays(e.target.value)} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="atlas-label flex flex-col gap-1 text-[var(--ink-dim)]">
              Sun above the horizon at least (% of the window)
              <input inputMode="decimal" value={sunMin} onChange={(e) => setSunMin(e.target.value)} className={field} />
            </label>
            <label className="atlas-label flex flex-col gap-1 text-[var(--ink-dim)]">
              Earth in view at least (% of the window)
              <input inputMode="decimal" value={earthMin} onChange={(e) => setEarthMin(e.target.value)} className={field} />
            </label>
          </div>
          <p className="atlas-label text-[var(--ink-dim)]">These limits are your own planning limits, not NASA values.</p>
          {error && (
            <p role="alert" className="text-[var(--fail,#ff8a8a)]">
              {error}
            </p>
          )}
          {!p.canCompute && (
            <p className="atlas-label text-[var(--ink-dim)]">
              This copy cannot compute a new window. Open GR-001, GR-002 or GR-003 from Runs, then read the answer for a site in it.
            </p>
          )}
          <div className="flex justify-between gap-2">
            <button type="button" className="atlas-key atlas-label" onClick={() => setStep(0)}>Back</button>
            <button type="button" className="atlas-key atlas-label" disabled={!selected || !p.canCompute || busy} onClick={run}>
              {busy ? "Starting…" : "See the answer"}
            </button>
          </div>
          <button type="button" className="atlas-label self-start text-[var(--ink-dim)] underline underline-offset-4" onClick={() => setStep(2)}>
            Or read the answer in the run that is already loaded
          </button>
        </section>
      )}

      {step === 2 && (
        <section aria-label="Answer" className="flex flex-col gap-3">
          <h3 className="text-lg text-[var(--ink)]">{selected ? `Can we land at ${selected.label}?` : "Choose a site first"}</h3>
          {!selected && <p className="text-[var(--ink-dim)]">Pick a site in step 1.</p>}
          {selected && p.loadNote && (
            <p role={p.loadNote.kind === "error" ? "alert" : "status"} className="text-[var(--ink-dim)]">
              {p.loadNote.text}
            </p>
          )}
          {selected && !p.loadNote && !p.tracks && (
            <p className="text-[var(--ink-dim)]">
              {p.startedRunId && p.startedRunId !== p.loadedRunId
                ? "Computing this window…"
                : "The loaded run does not hold this site. Choose When, then See the answer to compute it, or open a run that holds it from Runs."}
            </p>
          )}
          {selected && !p.loadNote && p.tracks && (
            <>
              {windowText && (
                <p className="atlas-label text-[var(--ink-dim)]">
                  {windowText}
                  {p.runLabel ? ` · run ${p.runLabel}` : ""}
                </p>
              )}
              {verdict && (
                <div
                  className={`rounded border px-3 py-2 ${verdict.tone === "ok" ? "border-emerald-500/50" : verdict.tone === "fail" ? "border-red-500/50" : "border-amber-500/50"}`}
                  data-testid="planner-verdict"
                >
                  <p className="text-lg text-[var(--ink)]">{verdict.head}</p>
                  <p className="text-[var(--ink-dim)]">{verdict.body}</p>
                </div>
              )}
              <ul className="flex flex-col gap-2">
                {TARGETS.map((t) => {
                  const tr = p.tracks?.[t];
                  if (!tr) return null;
                  const m = metricsView(t, tr);
                  return (
                    <li key={t} className="rounded border border-[var(--panel-edge)] px-3 py-2" data-testid={`planner-${t}`}>
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-[var(--ink)]">{TARGET_SUBJECT[t]}</span>
                        <span className="atlas-label">
                          {m.outcome.icon} {m.outcome.label}
                        </span>
                      </p>
                      <p className="atlas-number text-[var(--ink)]">{m.availability}</p>
                      <p className="text-[var(--ink-dim)]">
                        {m.needs}. Longest time hidden: {m.longestHidden}.
                      </p>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[var(--ink-dim)]">{timelineSummary(p.tracks)}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Tag kind="derived" />
                {p.onEnterSky && (
                  <button type="button" className="atlas-key atlas-label" onClick={p.onEnterSky}>
                    See the sky from this site
                  </button>
                )}
              </div>
            </>
          )}
          <div className="flex justify-between gap-2">
            <button type="button" className="atlas-key atlas-label" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="atlas-key atlas-label" disabled={!p.tracks} onClick={() => setStep(3)}>Next: brief</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section aria-label="Brief" className="flex flex-col gap-3">
          <h3 className="text-lg text-[var(--ink)]">Brief</h3>
          {brief ? (
            <>
              <pre className="whitespace-pre-wrap rounded border border-[var(--panel-edge)] bg-black/40 p-3 text-[var(--ink)]" data-testid="planner-brief">
                {brief}
              </pre>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="atlas-key atlas-label" onClick={() => copy(brief, "Brief")}>Copy brief</button>
                {shareLink && (
                  <button type="button" className="atlas-key atlas-label" onClick={() => copy(shareLink, "Link")}>
                    Copy link to these inputs
                  </button>
                )}
              </div>
              {copied && <p role="status" className="atlas-label text-[var(--ink-dim)]">{copied === "Brief" || copied === "Link" ? `${copied} copied.` : copied}</p>}
              <p className="atlas-label text-[var(--ink-dim)]">
                A link holds the inputs only: opening it fills the Analyse form and runs nothing.
              </p>
            </>
          ) : (
            <p className="text-[var(--ink-dim)]">{dash} Get an answer in step 3 first.</p>
          )}
          <div className="flex justify-between gap-2">
            <button type="button" className="atlas-key atlas-label" onClick={() => setStep(2)}>Back to the answer</button>
            <button type="button" className="atlas-key atlas-label" onClick={() => setStep(0)}>Start again</button>
          </div>
        </section>
      )}
    </div>
  );
}
