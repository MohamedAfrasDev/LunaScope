"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ApiError, describeError, getJson, postJson } from "@/lib/api/client";
import type { CustomSiteCheck, RunSummary, SitesResponse } from "@/lib/api/types";
import {
  AZ_STEP_CHOICES,
  MAX_SAMPLES,
  STEP_CHOICES,
  clearDraft,
  customBody,
  customErrors,
  decodeShare,
  emptyCustom,
  encodeShare,
  fieldKeyFromService,
  loadDraft,
  nowStart,
  referenceDraft,
  saveDraft,
  SHARE_PARAM,
  sampleCount,
  toRequest,
  validateDraft,
  type CustomDraft,
  type Draft,
  type Errors,
} from "@/lib/draft";
import { siteLabel } from "@/lib/format";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-xs font-medium text-fail">
          <span aria-hidden="true">✗ </span>
          {error}
        </p>
      )}
    </div>
  );
}

/** Fields that live under "Advanced settings": a problem in one opens that section. */
const isAdvancedKey = (k: string) => /^(requirements|terrain|options)\./.test(k);

const input =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm aria-[invalid=true]:border-fail aria-[invalid=true]:bg-fail-soft";

/** The catalog grouped for display: demonstration points first, then each named group in catalog order. */
function siteGroups(catalog: SitesResponse): [string, SitesResponse["sites"]][] {
  const order: string[] = ["demonstration"];
  const label: Record<string, string> = { demonstration: "Demonstration points (rule-chosen, not candidate sites)", ...(catalog.groups ?? {}) };
  const by: Record<string, SitesResponse["sites"]> = {};
  for (const s of catalog.sites) {
    const g = s.group ?? "demonstration";
    if (!by[g]) by[g] = [];
    by[g].push(s);
    if (!order.includes(g)) order.push(g);
  }
  return order.filter((g) => by[g]).map((g) => [label[g] ?? g, by[g]]);
}

export function AnalyzeForm() {
  const router = useRouter();
  const uid = useId();
  const [catalog, setCatalog] = useState<SitesResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // Advanced settings stay closed until something inside them needs attention; the error summary takes focus.
  const [advOpen, setAdvOpen] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusTick > 0) summaryRef.current?.focus();
  }, [focusTick]);

  useEffect(() => {
    getJson<SitesResponse>("sites")
      .then((c) => {
        setCatalog(c);
        const known = new Set(c.sites.map((s) => s.site_id));
        // a shared link fills the form and nothing more: it never starts a run
        const raw = new URLSearchParams(window.location.search).get(SHARE_PARAM);
        const shared = raw === null ? null : decodeShare(raw);
        if (raw !== null) {
          window.history.replaceState(null, "", window.location.pathname);
          setNotice(shared
            ? "These inputs came from a shared link. Nothing has been run: check them, then press Run analysis."
            : "That link could not be read, so the default inputs are shown.");
        }
        const saved = shared ?? loadDraft();
        // a saved draft survives navigation in this tab; preset ids no longer in the catalog are dropped
        setD(saved ? { ...saved, siteIds: saved.siteIds.filter((x) => known.has(x)) } : referenceDraft([...known]));
      })
      .catch((e) => setLoadErr(describeError(e)));
  }, []);

  if (loadErr)
    return (
      <p role="alert" className="rounded-md border border-fail/40 bg-fail-soft px-3 py-2 text-fail">
        {loadErr}
      </p>
    );
  if (!d || !catalog) return <p className="text-muted">Loading the site catalog…</p>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    const next = { ...d, [k]: v };
    setD(next);
    saveDraft(next);
    setErrors({});
  };
  const reset = () => {
    clearDraft();
    setD(referenceDraft(catalog.sites.map((s) => s.site_id)));
    setErrors({});
    setFormErr(null);
    setNotice(null);
  };
  async function share() {
    if (!d) return;
    const url = `${window.location.origin}/analyze?${SHARE_PARAM}=${encodeShare(d)}`;
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copied. It holds these inputs only; opening it fills the form and runs nothing.");
    } catch {
      setNotice("Copy the link below. It holds these inputs only; opening it fills the form and runs nothing.");
    }
  }
  const fid = (n: string) => `${uid}-${n}`;
  const f = (key: string, n: string) => ({
    id: fid(n),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${fid(n)}-err` : undefined,
  });
  const samples = sampleCount(d);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!d) return;
    const errs = validateDraft(d);
    setErrors(errs);
    setFormErr(null);
    if (Object.keys(errs).length) {
      if (Object.keys(errs).some(isAdvancedKey)) setAdvOpen(true);
      setFocusTick((n) => n + 1);
      return;
    }
    setBusy(true);
    try {
      const run = await postJson<RunSummary>("analyses", toRequest(d));
      clearDraft(); // the run now holds an immutable snapshot of these inputs
      router.push(`/runs/${run.run_id}`);
    } catch (e) {
      const key = e instanceof ApiError ? fieldKeyFromService(e.field) : null;
      if (key) {
        setErrors({ [key]: describeError(e) });
        if (isAdvancedKey(key)) setAdvOpen(true);
        setFocusTick((n) => n + 1);
      } else setFormErr(describeError(e));
      setBusy(false);
    }
  }

  const fieldset = "surface-card p-5";
  const legend = "px-1 text-base font-semibold tracking-tight";

  return (
    <form onSubmit={submit} noValidate className="grid max-w-5xl gap-5">
      {Object.keys(errors).length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-md border border-fail/40 bg-fail-soft px-4 py-3 text-sm text-fail">
          <strong>Fix {Object.keys(errors).length} field(s) before submitting.</strong> Nothing has been sent.
        </div>
      )}
      {notice && <p role="status" className="rounded-md border border-info/40 bg-info-soft px-4 py-3 text-sm text-info">{notice}</p>}
      {formErr && (
        <p role="alert" className="rounded-md border border-fail/40 bg-fail-soft px-4 py-3 text-sm text-fail">
          {formErr}
        </p>
      )}

      <fieldset className={fieldset}>
        <legend className={legend}>Mission window (UTC)</legend>
        <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
          <button type="button" className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium"
            onClick={() => {
              const n = nowStart();
              const next = { ...d, ...n };
              setD(next);
              saveDraft(next);
              setErrors({});
              setNotice(`Start set to ${n.startDate} ${n.startTime} UTC, the current hour. With the duration below this is “now to +${d.durationDays} days”. Nothing has been run yet.`);
            }}>
            Start from now
          </button>
          <span>Sets the start to the current UTC hour. A window that is not already saved asks JPL Horizons for fresh positions, so it needs live mode and can take minutes.</span>
        </p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id={fid("date")} label="Start date" error={errors["mission.start_date"]} hint="YYYY-MM-DD">
            <input {...f("mission.start_date", "date")} className={input} value={d.startDate}
              onChange={(e) => set("startDate", e.target.value)} inputMode="numeric" />
          </Field>
          <Field id={fid("time")} label="Start time" error={errors["mission.start_time"]} hint="HH:MM">
            <input {...f("mission.start_time", "time")} className={input} value={d.startTime}
              onChange={(e) => set("startTime", e.target.value)} />
          </Field>
          <Field id={fid("days")} label="Duration (days)" error={errors["mission.duration"]} hint="1 hour to 30 days">
            <input {...f("mission.duration", "days")} className={input} value={d.durationDays}
              onChange={(e) => set("durationDays", e.target.value)} inputMode="decimal" />
          </Field>
          <Field id={fid("step")} label="Base step (minutes)" error={errors["mission.step"]}
            hint="Provisional until convergence is shown">
            <select {...f("mission.step", "step")} className={input} value={d.stepMin}
              onChange={(e) => set("stepMin", e.target.value)}>
              {STEP_CHOICES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className={fieldset} aria-describedby={errors.sites ? fid("sites-err") : undefined}>
        <legend className={legend}>Sites</legend>
        <p className="text-xs text-muted">{catalog.note}</p>
        {siteGroups(catalog).map(([heading, sites]) => (
          <div key={heading} className="mt-4">
            <h2 className="text-sm font-semibold">{heading}</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {sites.map((s) => (
                <li key={s.site_id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm transition-colors hover:border-border-strong hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-info-soft">
                    <input type="checkbox" className="mt-1" checked={d.siteIds.includes(s.site_id)}
                      onChange={(e) => set("siteIds", e.target.checked ? [...d.siteIds, s.site_id]
                        : d.siteIds.filter((x) => x !== s.site_id))} />
                    <span>
                      <strong>{siteLabel(s.site_id)}</strong>
                      {s.name && (
                        <span className="block text-xs text-muted">
                          {s.feature_type?.split(",")[0]}
                          {s.diameter_km ? `, ${s.diameter_km} km across` : ""}; {s.lat_deg.toFixed(2)}°, {s.lon_east_deg.toFixed(2)}°E
                          {s.iau_url && (
                            <>
                              {" "}
                              <a href={s.iau_url} target="_blank" rel="noreferrer" className="text-accent underline">
                                IAU entry
                              </a>
                            </>
                          )}
                        </span>
                      )}
                      <span className="block text-xs text-muted">
                        Source: {s.source}. Precision ±{s.precision_m} m. Terrain footprint{" "}
                        {s.dem_coverage_150km.fully_covered ? "fully covered" : "partly outside the data"}.
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {d.custom.map((c, i) => (
          <div key={i} className="mt-4 grid gap-3 rounded-md border border-border bg-surface-2 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field id={fid(`clat${i}`)} label="Latitude (°)" error={errors[`custom.${i}.lat`]}>
              <input id={fid(`clat${i}`)} className={input} value={c.lat}
                aria-invalid={errors[`custom.${i}.lat`] ? true : undefined}
                onChange={(e) => set("custom", d.custom.map((x, j) => (j === i ? { ...x, lat: e.target.value } : x)))} />
            </Field>
            <Field id={fid(`clon${i}`)} label="Longitude (°)" error={errors[`custom.${i}.lon`]}>
              <input id={fid(`clon${i}`)} className={input} value={c.lon}
                aria-invalid={errors[`custom.${i}.lon`] ? true : undefined}
                onChange={(e) => set("custom", d.custom.map((x, j) => (j === i ? { ...x, lon: e.target.value } : x)))} />
            </Field>
            <Field id={fid(`cdir${i}`)} label="Longitude direction">
              <select id={fid(`cdir${i}`)} className={input} value={c.direction}
                onChange={(e) => set("custom", d.custom.map((x, j) => (j === i
                  ? { ...x, direction: e.target.value as Draft["custom"][number]["direction"] } : x)))}>
                <option value="east_positive">East positive</option>
                <option value="west_positive">West positive</option>
              </select>
            </Field>
            <Field id={fid(`csrc${i}`)} label="Source note" error={errors[`custom.${i}.source`]}>
              <input id={fid(`csrc${i}`)} className={input} value={c.source}
                aria-invalid={errors[`custom.${i}.source`] ? true : undefined}
                onChange={(e) => set("custom", d.custom.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))} />
            </Field>
            <Field id={fid(`cprec${i}`)} label="Precision (m)" error={errors[`custom.${i}.precision`]}>
              <div className="flex gap-2">
                <input id={fid(`cprec${i}`)} className={`${input} w-full`} value={c.precision}
                  aria-invalid={errors[`custom.${i}.precision`] ? true : undefined}
                  onChange={(e) => set("custom", d.custom.map((x, j) => (j === i ? { ...x, precision: e.target.value } : x)))} />
                <button type="button" className="rounded-md border border-border px-2 text-sm"
                  onClick={() => set("custom", d.custom.filter((_, j) => j !== i))}
                  aria-label={`Remove custom site ${i + 1}`}>
                  Remove
                </button>
              </div>
            </Field>
            <CustomCoverage c={c} index={i} errors={customErrors(d, i)} />
          </div>
        ))}
        <button type="button" className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium"
          onClick={() => set("custom", [...d.custom, emptyCustom()])}>
          Add a custom point
        </button>
        {errors.sites && (
          <p id={fid("sites-err")} className="mt-3 text-sm font-medium text-fail">
            <span aria-hidden="true">✗ </span>{errors.sites}
          </p>
        )}
      </fieldset>

      <details
        open={advOpen}
        onToggle={(e) => setAdvOpen(e.currentTarget.open)}
        className="surface-card group"
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="text-base font-semibold tracking-tight">Advanced settings</span>
          <span className="type-caption flex items-center gap-2">
            {`Sunlight at least ${d.sunMinPct}%, Earth visibility at least ${d.earthMinPct}%, terrain ${d.radiusKm} km, sensitivity ${d.sensitivity ? "on" : "off"}`}
            <svg aria-hidden="true" viewBox="0 0 10 6" className="h-1.5 w-2.5 shrink-0 transition-transform group-open:rotate-180">
              <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
        </summary>
        <div className="grid gap-6 border-t border-border p-5">
      <fieldset className="grid gap-3">
        <legend className={legend}>Requirements (scenario values, not mission rules)</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Field id={fid("sun")} label="Minimum sunlight availability (%)" error={errors["requirements.sun"]}
            hint="Sun centre above the terrain skyline">
            <input {...f("requirements.sun", "sun")} className={input} value={d.sunMinPct}
              onChange={(e) => set("sunMinPct", e.target.value)} inputMode="decimal" />
          </Field>
          <Field id={fid("earth")} label="Minimum Earth visibility (%)" error={errors["requirements.earth"]}
            hint="Direct line of sight, not a link budget">
            <input {...f("requirements.earth", "earth")} className={input} value={d.earthMinPct}
              onChange={(e) => set("earthMinPct", e.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">
          Sunlight and Earth are judged separately. There is no combined score.
        </p>
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className={legend}>Terrain</legend>
        <p className="text-xs text-muted">
          Terrain is always on. The flat-horizon result is shown beside it for comparison.
        </p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id={fid("dem")} label="Elevation data">
            <select id={fid("dem")} className={input} value={d.demProfile}
              onChange={(e) => set("demProfile", e.target.value as Draft["demProfile"])}>
              <option value="lola-80s-20m-adj">LOLA 20 m, adjusted (PGDA 2023)</option>
              <option value="lola-80s-20m-pds">LOLA 20 m, PDS release (2017)</option>
            </select>
          </Field>
          <Field id={fid("radius")} label="Horizon radius (km)" error={errors["terrain.radius"]}>
            <input {...f("terrain.radius", "radius")} className={input} value={d.radiusKm}
              onChange={(e) => set("radiusKm", e.target.value)} inputMode="decimal" />
          </Field>
          <Field id={fid("az")} label="Azimuth step (°)" error={errors["terrain.az_step"]}
            hint="Finer is slower; 0.5° was too coarse in tests">
            <select {...f("terrain.az_step", "az")} className={input} value={d.azStepDeg}
              onChange={(e) => set("azStepDeg", e.target.value)}>
              {AZ_STEP_CHOICES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field id={fid("mast")} label="Observer height (m)" error={errors["terrain.mast"]}
            hint="Above the local ground">
            <input {...f("terrain.mast", "mast")} className={input} value={d.mastM}
              onChange={(e) => set("mastM", e.target.value)} inputMode="decimal" />
          </Field>
        </div>
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className={legend}>Options</legend>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={d.sensitivity} onChange={(e) => set("sensitivity", e.target.checked)} />
          Also run a sensitivity check (half the azimuth step, and the other DEM release). Slower.
        </label>
      </fieldset>
        </div>
      </details>

      {/* the primary action and its cost stay in view; the secondary actions sit just below, not sticky */}
      <div className="sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-surface/95">
        <button type="submit" disabled={busy}
          className="btn-primary">
          {busy ? "Submitting…" : "Run analysis"}
        </button>
        <p className="text-sm text-muted" aria-live="polite">
          {samples.toLocaleString("en")} samples ({d.siteIds.length + d.custom.length} site(s) × 2 targets), limit{" "}
          {MAX_SAMPLES.toLocaleString("en")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium">
          Reset to the reference mission
        </button>
        <button type="button" onClick={share} className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium">
          Copy a link to these inputs
        </button>
      </div>
      {shareUrl && (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Link to these inputs</span>
          <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className="rounded-md border border-border-strong bg-surface px-3 py-2 font-mono text-xs" />
        </label>
      )}
    </form>
  );
}

/**
 * FR-02: before running, check a custom point against the terrain data. The service returns the
 * normalised analysis point (planetocentric, east-positive) with the source point kept separate,
 * and the DEM coverage of the horizon footprint. A result is shown only for the inputs it was asked for.
 */
function CustomCoverage({ c, index, errors }: { c: CustomDraft; index: number; errors: Errors }) {
  const key = JSON.stringify(customBody(c));
  const [res, setRes] = useState<{ key: string; check: CustomSiteCheck } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const invalid = Object.keys(errors).length > 0;

  async function check() {
    setBusy(true);
    setErr(null);
    try {
      const out = await postJson<CustomSiteCheck>("sites/custom", customBody(c));
      setRes({ key, check: out });
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const r = res && res.key === key ? res.check : null;
  const cov = r?.dem_coverage_150km;
  return (
    <div className="sm:col-span-2 lg:col-span-5" aria-live="polite">
      <button type="button" onClick={check} disabled={busy || invalid}
        className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50">
        {busy ? "Checking…" : `Check terrain coverage for point ${index + 1}`}
      </button>
      {invalid && <span className="ml-3 text-xs text-muted">Fix this point&rsquo;s fields first.</span>}
      {err && <p role="alert" className="mt-2 text-sm text-fail">{err}</p>}
      {r && cov && (
        <p className="mt-2 text-sm">
          Analysis point {r.lat_deg.toFixed(5)}°, {r.lon_east_deg.toFixed(5)}° E ({r.convention}, east positive); your
          source point {r.source_point_kept_separate.lon_deg}° {r.source_point_kept_separate.lon_direction === "east_positive" ? "east" : "west"} positive
          is kept separately.{" "}
          <span className={cov.fully_covered ? "font-medium" : "font-medium text-warn"}>
            <span aria-hidden="true">{cov.fully_covered ? "✓ " : "! "}</span>
            {cov.fully_covered
              ? `The ${cov.radius_km} km horizon footprint is fully inside the terrain data.`
              : `${(cov.covered_fraction * 100).toFixed(1)}% of the ${cov.radius_km} km footprint is inside the terrain data; ${cov.sectors_with_gap} azimuth sector(s) will be unknown, not flat.`}
          </span>
        </p>
      )}
    </div>
  );
}
