"""Stable error codes (spec 11 error envelope, 14 status codes)."""

from __future__ import annotations


class LunaScopeError(Exception):
    def __init__(self, code: str, message: str, *, field: str | None = None,
                 retryable: bool = False):
        super().__init__(f"{code}: {message}")
        self.code, self.message, self.field, self.retryable = code, message, field, retryable

    def to_dict(self, correlation_id: str | None = None) -> dict:
        return {"error": {"code": self.code, "message": self.message, "field": self.field,
                          "retryable": self.retryable, "correlation_id": correlation_id}}


# Geometry provider
GEOMETRY_PROVIDER_UNAVAILABLE = "GEOMETRY_PROVIDER_UNAVAILABLE"  # retryable
GEOMETRY_PROVIDER_REJECTED_REQUEST = "GEOMETRY_PROVIDER_REJECTED_REQUEST"  # input error, even on HTTP 200
GEOMETRY_RESPONSE_UNSUPPORTED = "GEOMETRY_RESPONSE_UNSUPPORTED"  # unknown API signature/format
GEOMETRY_COVERAGE_MISSING = "GEOMETRY_COVERAGE_MISSING"
OBSERVER_MISMATCH = "OBSERVER_MISMATCH"  # provider echoed a different observer than requested
RESOURCE_INTEGRITY_FAILED = "RESOURCE_INTEGRITY_FAILED"
INVALID_INPUT = "INVALID_INPUT"
