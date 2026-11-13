"""Shared enumerations. Strings are part of the API contract."""

from enum import StrEnum


class IntervalClass(StrEnum):
    VISIBLE = "V"
    HIDDEN = "H"
    UNRESOLVED = "U"  # inside the numerical decision band (bounded, propagates into bounds)
    UNCERTIFIED = "X"  # event search could not certify the interval (exclusion trigger)
    GAP = "G"  # missing geometry or terrain coverage (exclusion trigger)


class Outcome(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    INDETERMINATE = "INDETERMINATE"
    EXCLUDED = "EXCLUDED"


class SiteStatus(StrEnum):
    PASS = "PASS"
    FAIL_SUN = "FAIL_SUN"
    FAIL_EARTH = "FAIL_EARTH"
    FAIL_BOTH = "FAIL_BOTH"
    INDETERMINATE = "INDETERMINATE"
    UNKNOWN_COVERAGE = "UNKNOWN_COVERAGE"


class ResultState(StrEnum):
    SYNTHETIC = "synthetic_demonstration"
    REAL_UNVERIFIED = "real_data_unverified"
    VALIDATED = "validated"


class ExclusionReason(StrEnum):
    UNCERTIFIED_EVENT_SEARCH = "UNCERTIFIED_EVENT_SEARCH"
    COVERAGE_MISSING = "COVERAGE_MISSING"
    FATAL_VALIDATION = "FATAL_VALIDATION"
    OBSERVER_UNRESOLVED = "OBSERVER_UNRESOLVED"
