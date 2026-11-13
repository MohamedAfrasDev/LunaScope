"""Precomputed horizon storage (phase plan 1.6): a computed skyline is kept on disk under its cache key.

The cache key already covers observer, terrain identity (product + SHA-256 + window), settings and
algorithm version, so a hit is the same computation. On load the file is verified three ways: the
payload hash recorded at save time, the settings/identity echo, and the key recomputed from the
loaded profile. Any mismatch is a miss, never a wrong profile.
"""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import numpy as np

from .canonical import sha256_hex
from .horizon import HorizonProfile, HorizonSettings

FORMAT = 1
_ARRAYS = ("azimuth_deg", "horizon_el_deg", "argmax_distance_km", "sector_state")


def _path(directory: Path, key: str) -> Path:
    if not key or not all(c in "0123456789abcdef" for c in key):
        raise ValueError("cache key must be lowercase hex")
    return Path(directory) / f"{key}.horizon.npz"


def save(profile: HorizonProfile, directory: Path) -> Path:
    key = profile.cache_key()
    arrays = {k: np.ascontiguousarray(getattr(profile, k)) for k in _ARRAYS}
    digest = sha256_hex(b"".join(arrays[k].tobytes() for k in _ARRAYS))
    meta = {"format": FORMAT, "cache_key": key, "payload_sha256": digest, "observer_digest": profile.observer_digest,
            "terrain_identity": profile.terrain_identity, "settings": profile.settings.__dict__,
            "algorithm": profile.algorithm}
    buf = io.BytesIO()
    np.savez(buf, meta=np.frombuffer(json.dumps(meta, sort_keys=True).encode(), dtype=np.uint8), **arrays)
    p = _path(directory, key)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_bytes(buf.getvalue())
    tmp.replace(p)  # atomic: a reader never sees half a file
    return p


def load(key: str, directory: Path) -> HorizonProfile | None:
    p = _path(directory, key)
    if not p.is_file():
        return None
    try:
        with np.load(p, allow_pickle=False) as z:
            meta = json.loads(bytes(z["meta"]).decode())
            arrays = {k: z[k] for k in _ARRAYS}
        digest = sha256_hex(b"".join(np.ascontiguousarray(arrays[k]).tobytes() for k in _ARRAYS))
        if meta.get("format") != FORMAT or digest != meta["payload_sha256"]:
            return None
        prof = HorizonProfile(
            arrays["azimuth_deg"], arrays["horizon_el_deg"], arrays["argmax_distance_km"],
            arrays["sector_state"], HorizonSettings(**meta["settings"]), meta["observer_digest"],
            meta["terrain_identity"], meta["algorithm"])
        return prof if prof.cache_key() == key == meta["cache_key"] else None
    except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile, EOFError):
        return None
