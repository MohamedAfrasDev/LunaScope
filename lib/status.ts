import type { IntervalClass, Outcome, ResultState, SiteStatus } from "./api/types";

/** Every state is an icon AND a word AND a tone: never colour alone (NFR-03, AC-07). */
export interface Presentation {
  label: string;
  icon: string;
  tone: "ok" | "fail" | "warn" | "muted" | "info";
  help: string;
}

export const OUTCOME: Record<Outcome, Presentation> = {
  PASS: { label: "Pass", icon: "✓", tone: "ok", help: "The lower availability bound meets the requirement." },
  FAIL: { label: "Fail", icon: "✗", tone: "fail", help: "Even the upper availability bound is below the requirement." },
  INDETERMINATE: {
    label: "Indeterminate",
    icon: "?",
    tone: "warn",
    help: "The bounds straddle the requirement; neither a pass nor a fail can be claimed.",
  },
  EXCLUDED: {
    label: "Excluded",
    icon: "∅",
    tone: "muted",
    help: "Missing data or an uncertified region: this case is left out, not failed.",
  },
};

export const SITE_STATUS: Record<SiteStatus, Presentation> = {
  PASS: { label: "Pass", icon: "✓", tone: "ok", help: "Both requirements pass." },
  FAIL_SUN: { label: "Fail: Sun", icon: "✗", tone: "fail", help: "The sunlight requirement is not met." },
  FAIL_EARTH: { label: "Fail: Earth", icon: "✗", tone: "fail", help: "The direct-to-Earth requirement is not met." },
  FAIL_BOTH: { label: "Fail: both", icon: "✗", tone: "fail", help: "Neither requirement is met." },
  INDETERMINATE: { label: "Indeterminate", icon: "?", tone: "warn", help: "At least one requirement cannot be decided." },
  UNKNOWN_COVERAGE: { label: "Excluded", icon: "∅", tone: "muted", help: "Not enough data to decide." },
};

export const RESULT_STATE: Record<ResultState, { label: string; icon: string; tone: Presentation["tone"]; detail: string }> = {
  synthetic_demonstration: {
    label: "Synthetic demonstration",
    icon: "◆",
    tone: "warn",
    detail:
      "These values come from an invented test fixture. They are not lunar results and must not be read as science.",
  },
  real_data_unverified: {
    label: "Real data, unverified",
    icon: "◇",
    tone: "info",
    detail:
      "Computed from real NASA data, but no validation gate has closed. Treat as a screening result, not a verified one.",
  },
  validated: {
    label: "Validated",
    icon: "●",
    tone: "ok",
    detail: "Validated within the named scopes only.",
  },
};

export const INTERVAL: Record<IntervalClass, { label: string; short: string }> = {
  V: { label: "Visible", short: "V" },
  H: { label: "Hidden by terrain or below the horizon", short: "H" },
  U: { label: "Unresolved (inside the numerical decision band)", short: "U" },
  X: { label: "Uncertified (the event search could not decide)", short: "X" },
  G: { label: "No data (coverage gap)", short: "G" },
};

export const WARNING_TEXT: Record<string, string> = {
  UNVERIFIED: "Real data computed, but no validation gate has closed.",
  DEMONSTRATION_DATA: "Synthetic demonstration data.",
  UTC_FUTURE_LEAP_SECOND_ASSUMPTION: "UTC after the last announced leap second assumes none is added.",
  EOP_PREDICTED: "Earth-orientation data is predicted, not measured, for part of this window.",
  DEM_COVERAGE_INCOMPLETE: "Part of the terrain footprint lacks data; those sectors are unknown, not flat.",
  GEOMETRY_REFERENCE_MISMATCH: "The independent geometry check disagreed beyond tolerance.",
  SENSITIVITY_HIGH: "The result changes beyond tolerance under a finer or alternative setting.",
  INTERPOLATION_ERROR_ASSUMED: "Interpolation error was assumed, not measured.",
};

/** Validation card and group status: never colour alone, and "not evaluated" is never a pass. */
export const CARD_STATUS: Record<"met" | "not_met" | "not_evaluated", Presentation> = {
  met: { label: "Met", icon: "✓", tone: "ok", help: "The check ran and is within its stated tolerance." },
  not_met: { label: "Not met", icon: "✗", tone: "fail", help: "The check ran and is outside its tolerance." },
  not_evaluated: { label: "Not evaluated", icon: "–", tone: "muted", help: "The check has not been run; it supports nothing." },
};
