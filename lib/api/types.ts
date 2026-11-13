/**
 * Hand-written subset of the science-service response shapes (docs/API.md).
 * TODO: generate from the service's OpenAPI schema once responses are Pydantic models.
 * The browser displays these values; it never computes visibility, outages or comparisons.
 */

export type ResultState = "synthetic_demonstration" | "real_data_unverified" | "validated";
export type Outcome = "PASS" | "FAIL" | "INDETERMINATE" | "EXCLUDED";
export type SiteStatus =
  | "PASS"
  | "FAIL_SUN"
  | "FAIL_EARTH"
  | "FAIL_BOTH"
  | "INDETERMINATE"
  | "UNKNOWN_COVERAGE";
export type RunStatus = "queued" | "running" | "complete" | "complete_with_warnings" | "failed";
export type Target = "sun_center" | "earth_center";
export type HorizonKind = "terrain" | "flat";
export type IntervalClass = "V" | "H" | "U" | "X" | "G";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    field: string | null;
    retryable: boolean;
    correlation_id: string | null;
  };
}

export interface Health {
  status: string;
  mode: "live" | "replay";
  stack: "synthetic" | "live";
  algorithm_id: string;
  result_state: ResultState;
  resources_ok: boolean;
  resources_approved: boolean;
  queue: Record<string, number>;
  running: string[];
  limits: { max_running: number; max_queued: number; run_timeout_s: number };
}

export interface CatalogSite {
  site_id: string;
  label: string;
  lat_deg: number;
  lon_east_deg: number;
  source: string;
  precision_m: number;
  kind: string;
  dem_coverage_150km: { covered_fraction: number; fully_covered: boolean; sectors_with_gap: number };
}

export interface SitesResponse {
  note: string;
  sites: CatalogSite[];
}

export interface RunSummary {
  run_id: string;
  result_id: string | null;
  status: RunStatus;
  stage: string | null;
  progress: number | null;
  result_state: ResultState;
  attempt: number;
  created_utc: string;
  finished_utc: string | null;
  algorithm_id: string;
  attached?: boolean;
  error?: { code: string; message: string };
}

export interface MatrixCell {
  outcome: Outcome;
  availability_lower: number;
  availability_upper: number;
  threshold: number;
}

export interface MatrixRow {
  site_id: string;
  site_status: SiteStatus;
  targets: Record<Target, Record<HorizonKind, MatrixCell>>;
}

export interface RunStatusResponse extends RunSummary {
  warnings?: string[];
  verified?: boolean;
  matrix?: MatrixRow[];
}

export interface Metrics {
  visible_s: number;
  hidden_s: number;
  unknown_s: number;
  availability_lower: number;
  availability_upper: number;
  known_time_fraction: number | null;
  longest_known_hidden_s: number;
  longest_known_hidden_start: number | null;
  longest_known_hidden_end: number | null;
  worst_case_not_visible_s: number;
  exclusion_reasons: string[];
  threshold: number;
  outcome: Outcome;
  margin_lower: number;
  margin_upper: number;
}

export interface IntervalRow {
  start_s: number;
  end_s: number;
  start_utc: string;
  end_utc: string;
  class: IntervalClass;
}

export interface EventRow {
  t_s: number;
  t_utc: string;
  type: "rise" | "set";
  solver_bracket_s: number;
  geometry_timing_bound_s: number | null;
  quality: string;
}

export interface Countdown {
  kind: string;
  text: string;
  at?: number;
  remaining_s?: number | null;
  solver_bracket_s?: number;
}

export interface SkySeries {
  step_s: number;
  az_deg: number[];
  el_deg: number[];
}

export interface HorizonProfileResponse {
  site_id: string;
  result_state: ResultState;
  settings: { radius_km: number; az_step_deg: number };
  azimuth_deg: number[];
  horizon_el_deg: (number | null)[];
  argmax_distance_km: (number | null)[];
  sector_state: string[];
  sectors: { certified: number; coverage_limited: number; unsupported: number };
  skyline_min_deg: number;
  skyline_max_deg: number;
}

export interface CountdownResponse extends Countdown {
  run_id: string;
  site_id: string;
  horizon: HorizonKind;
  result_state: ResultState;
  state: IntervalClass;
  t: number;
  mission_end: number;
  event_type?: "rise" | "set";
  unknown_from?: number;
  unknown_until?: number;
  band?: [number, number];
}

export interface TargetHorizonResult {
  metrics: Metrics;
  clearance_at_nodes: { min_deg: number; median_deg: number; max_deg: number } | null;
  countdown_at_start: Countdown;
  intervals?: IntervalRow[];
  events?: EventRow[];
}

export type SiteTargetMetrics = Partial<Record<HorizonKind, TargetHorizonResult>> & { series?: SkySeries };

export interface SiteResults {
  site_id: string;
  validity: string;
  site_status: SiteStatus;
  result_state: ResultState;
  target_metrics: Partial<Record<Target, SiteTargetMetrics>>;
  warnings: string[];
}

export interface ResultsResponse {
  run_id: string;
  result_id: string;
  status: RunStatus;
  result_state: ResultState;
  warnings: string[];
  sites: SiteResults[];
}

export interface ProvenanceResponse {
  run_id: string;
  result_id: string;
  algorithm_id: string;
  result_state: ResultState;
  verified: boolean;
  validated_scopes: string[];
  resources: { role: string; sha256: string }[];
  sites: {
    site_id: string;
    observer: { ground_height_m: number; lat_deg: number; lon_deg_east: number };
    geometry: Record<
      string,
      {
        provider: string;
        raw_sha256: string;
        holdout: { max_deg: number } | null;
        reference_agreement?: { max_total_arcsec: number; tolerance_arcsec: number; within_tolerance: boolean };
      }
    >;
    caveats: string[];
  }[];
}

/** What the analysis form sends to POST /analyses. */
export interface AnalysisRequestBody {
  schema_version: "1";
  mission: { start_utc: string; duration_s: number; step_s: number };
  requirements: { sun_min_availability: number; earth_min_availability: number };
  terrain: {
    dem_profile: string;
    radius_km: number;
    az_step_deg: number;
    observer_height_m: number;
  };
  sites: ({ site_id: string } | { custom: Record<string, unknown> })[];
  options: { sensitivity: boolean };
}

/** POST /comparisons for several sites of one run. Facts are typed records, rendered by fixed templates. */
export interface CompareRow {
  outcome: Outcome;
  availability_lower: number;
  availability_upper: number;
  margin_lower: number;
  margin_upper: number;
  longest_known_hidden_s: number;
  worst_case_not_visible_s: number;
  events: number;
  exclusion_reasons: string[];
}

export type CompareFact =
  | { fact: "terrain_changes_outcome"; site_id: string; target: Target; flat_outcome: Outcome; terrain_outcome: Outcome;
      flat_availability_lower: number; terrain_availability_lower: number }
  | { fact: "outcomes_differ" | "outcomes_same"; target: Target; outcomes: Record<string, Outcome> }
  | { fact: "equal_availability_different_outage"; target: Target; sites: [string, string];
      availability_lower: [number, number]; longest_known_hidden_s: [number, number] }
  | { fact: "unresolved_time_matters"; target: Target; sites: string[] };

export interface ComparisonResponse {
  mode: "sites_in_run";
  run_id: string;
  result_state: ResultState;
  compatible: boolean;
  alignment: string;
  held_constant: { field: string; value: string | number }[];
  changed: { field: string; values: { site_id: string; lat_deg: number; lon_east_deg: number; ground_height_m: number }[] }[];
  site_status: Record<string, SiteStatus>;
  targets: Record<
    Target,
    {
      sites: ({ site_id: string } & Record<HorizonKind, CompareRow>)[];
      spread: { availability_lower_min: number; availability_lower_max: number; availability_lower_range: number };
    }
  >;
  facts: CompareFact[];
  caveats: string[];
  warnings: string[];
  validated_scopes: string[];
  verified: boolean;
}
