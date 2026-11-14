/**
 * Hand-written subset of the science-service response shapes (docs/API.md).
 * Health, RunSummary and the validation cards are generated from the service's OpenAPI schema
 * (lib/api/generated.ts, `npm run gen:api`); the rest are still hand-written until they get models.
 * The browser displays these values; it never computes visibility, outages or comparisons.
 */

import type { components } from "./generated";

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

export type Health = components["schemas"]["HealthResponse"];

export type CatalogSite = components["schemas"]["CatalogSiteResponse"];

export type SitesResponse = components["schemas"]["SitesResponse"];

/** POST /sites/custom: the normalised analysis point, the source point kept separate, and DEM coverage. */
export interface CustomSiteCheck {
  lat_deg: number;
  lon_east_deg: number;
  convention: string;
  source: string;
  precision_m: number;
  source_point_kept_separate: { lon_deg: number; lon_direction: "east_positive" | "west_positive" };
  dem_coverage_150km: components["schemas"]["DemCoverage"];
}

export type RunSummary = components["schemas"]["RunSummaryResponse"];

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

export interface ExplanationFact {
  code: string;
  text: string;
  params: Record<string, unknown>;
}

export type SiteTargetMetrics = Partial<Record<HorizonKind, TargetHorizonResult>> & {
  series?: SkySeries;
  explanations?: ExplanationFact[] | null;
};

/** One sensitivity variant of a site (azimuth step halved, other DEM release): the service's numbers. */
export interface SensitivityVariant {
  variant: string;
  sensitivity_high: boolean;
  tolerance_availability: number;
  variant_run_id?: string;
  targets: Record<
    string,
    {
      delta_lower: number;
      delta_upper: number;
      outcome_base: Outcome;
      outcome_variant: Outcome;
      outcome_changed: boolean;
      event_count_base: number;
      event_count_variant: number;
      max_event_shift_s: number;
      longest_hidden_delta_s: number;
    }
  >;
}

export interface SiteResults {
  site_id: string;
  validity: string;
  site_status: SiteStatus;
  result_state: ResultState;
  target_metrics: Partial<Record<Target, SiteTargetMetrics>>;
  warnings: string[];
  sensitivity?: SensitivityVariant[];
}

export interface ResultsResponse {
  run_id: string;
  result_id: string;
  status: RunStatus;
  result_state: ResultState;
  warnings: string[];
  sites: SiteResults[];
}

export type ValidationCard = components["schemas"]["ValidationCardResponse"];
export type CardStatus = ValidationCard["status"];
export type ValidationResponse = components["schemas"]["ValidationResponse"];

/** Disk-edge sensitivity (S-2): the centre-only assumption bracketed by the upper limb and the whole disc. */
export interface DiskEdgeCase {
  margin_deg: number;
  outcome: Outcome;
  availability_lower: number;
  availability_upper: number;
  longest_known_hidden_s: number;
  events: number;
}

export interface DiskEdgeTarget {
  angular_radius_deg: number;
  centre: { outcome: Outcome; availability_lower: number; availability_upper: number; longest_known_hidden_s: number };
  upper_limb: DiskEdgeCase;
  whole_disk: DiskEdgeCase;
  outcome_changes: { upper_limb: boolean; whole_disk: boolean };
  matters: boolean;
}

export interface DiskEdge {
  schema: string;
  note: string;
  matters: boolean;
  targets: Partial<Record<Target, DiskEdgeTarget>>;
}

export type ValidationGroup = components["schemas"]["ValidationGroup"];

export interface ProvenanceGeometry {
  provider: string;
  raw_sha256: string;
  retrieved_utc?: string;
  signature_version?: string;
  correction_mode?: string;
  time_scale?: string;
  samples?: number;
  delta_geom_used_deg?: number;
  holdout: { max_deg: number; n: number; truth_step_s: number } | null;
  reference_agreement?: { max_total_arcsec: number; tolerance_arcsec: number; within_tolerance: boolean; n?: number; reference?: string };
}

export interface ProvenanceResponse {
  run_id: string;
  result_id: string;
  algorithm_id: string;
  result_state: ResultState;
  verified: boolean;
  validated_scopes: string[];
  request?: {
    mission: { start_utc: string; duration_s: number; step_s: number };
    requirements: { sun_min_availability: number; earth_min_availability: number };
    terrain: { dem_profile: string; radius_km: number; az_step_deg: number; observer_height_m: number; clearance_margin_deg: number };
  };
  effective_settings?: Record<string, unknown>;
  resources: { role: string; sha256: string }[];
  sites: {
    site_id: string;
    observer: { ground_height_m: number; lat_deg: number; lon_deg_east: number; body_frame?: string; reference_radius_km?: number; observer_height_above_ground_m?: number };
    horizon?: { cache_key: string; payload_sha256?: string | null; sectors: Record<string, number>; settings: Record<string, number>;
      skyline_min_deg: number | null; skyline_max_deg: number | null };
    geometry: Record<string, ProvenanceGeometry>;
    warnings?: string[];
    disk_edge?: DiskEdge | null; // absent on results made before the check existed
    caveats: string[];
  }[];
}

/** Time Machine (FR-10): a linked date-shift variant and the runs linked to a run. */
export type VariantAdmission = components["schemas"]["VariantAdmissionResponse"];
export type VariantLink = components["schemas"]["VariantLink"];
export type VariantsResponse = components["schemas"]["VariantsResponse"];
/** Alternatives search (FR-11): the tested-dates strip. */
export type SearchAdmission = components["schemas"]["SearchAdmissionResponse"];
export type SearchStrip = components["schemas"]["SearchStripResponse"];
export type StripDate = components["schemas"]["StripDate"];
export type Alignment = "elapsed" | "calendar";

export interface RunCompareRow extends CompareRow {
  window_s?: number; // calendar alignment: metrics restricted to the shared window
}

export interface ChangedInterval {
  start_s: number; // on run a's elapsed axis
  end_s: number;
  a: IntervalClass | "?";
  b: IntervalClass | "?";
}

/** POST /comparisons with two runs: baseline (a) and variant (b) under one stated alignment mode. */
export interface RunComparisonResponse {
  mode: "runs";
  compatible: boolean;
  alignment: Alignment;
  runs: { a: { run_id: string; start_utc: string }; b: { run_id: string; start_utc: string } };
  shift_s: number;
  overlap: { start_utc: string; duration_s: number } | null;
  held_constant: { field: string; value: string | number }[];
  changed: { field: string; from: string | number; to: string | number }[];
  sites: {
    site_id: string;
    site_status: { a: SiteStatus; b: SiteStatus };
    targets: Record<
      Target,
      {
        a: RunCompareRow;
        b: RunCompareRow;
        delta: { availability_lower: number; availability_upper: number; longest_known_hidden_s: number };
        outcome_change: string | null;
        event_count: [number, number];
        changed_intervals: ChangedInterval[];
        terrain_vs_flat: { a: Outcome; b: Outcome };
      }
    >;
  }[];
  result_state: ResultState | "mixed";
  warnings: string[];
  verified: boolean;
  note: string;
}

/** GET /references/{id}: a golden reference definition and the exact request it submits. */
export interface ReferenceDefinition {
  reference_id: string;
  status: "draft" | "frozen" | string;
  frozen: { run_id: string } | null;
  sites_status: string | null;
  request: AnalysisRequestBody;
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
