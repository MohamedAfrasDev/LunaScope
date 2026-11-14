"""Canonical JSON (RFC 8785 JCS) and identity hashing.

run_id    : known at admission (request, effective settings, resources, algorithm).
result_id : sealed after every contributing input is known (spec 8.1).
Hashes are taken over named fields, never informal concatenation.
"""

from __future__ import annotations

import hashlib
from typing import Any

import rfc8785


def canonical_bytes(obj: Any) -> bytes:
    return rfc8785.dumps(obj)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_of(obj: Any) -> str:
    return sha256_hex(canonical_bytes(obj))


def make_run_id(
    request: dict, effective_settings: dict, resources: list[dict], algorithm_id: str
) -> str:
    """Resources are {"role": ..., "sha256": ...}; order does not matter."""
    ordered = sorted(resources, key=lambda r: (r["role"], r["sha256"]))
    return hash_of(
        {
            "v": 1,
            "request": request,
            "effective_settings": effective_settings,
            "resources": ordered,
            "algorithm_id": algorithm_id,
        }
    )


def make_result_id(run_id: str, input_manifest: dict, artifact_sha256s: list[str]) -> str:
    return hash_of(
        {
            "v": 1,
            "run_id": run_id,
            "input_manifest": input_manifest,
            "artifacts": sorted(artifact_sha256s),
        }
    )
