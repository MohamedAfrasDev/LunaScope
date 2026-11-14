"""Independently implemented SPICE reference path (spec 5.5, review I-03).

Not a copy of the Horizons computation: the target state comes from NAIF kernels (`spkcpo` with
`LT+S`), and azimuth/elevation come from OUR local-frame math (`observer.az_el`), so the two
paths share nothing but the physical site. Used to check Horizons at selected epochs and, once
validated, as a possible offline primary.

Correction modes are NOT claimed identical: Horizons "apparent" also applies relativistic light
bending; SPICE `LT+S` is Newtonian light time plus stellar aberration. The measured residual
budget (SDR-001 D-04) absorbs that.

SPICE is not thread-safe, so every call is serialised behind one lock.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import ClassVar

import numpy as np
import spiceypy as sp

from ...canonical import hash_of
from ...errors import INVALID_INPUT, RESOURCE_INTEGRITY_FAILED, LunaScopeError
from ...observer import CanonicalObserver, az_el
from .base import GeometrySeries

REPO = Path(__file__).resolve().parents[4]
DEFAULT_MANIFEST = REPO / "data" / "manifests" / "spice-kernels.json"
DEFAULT_DIR = REPO / "data" / "raw" / "spice"
TARGETS = {"sun_center": "SUN", "earth_center": "EARTH"}
CORRECTION_MODE = "spice_LT+S"
TIME_SCALE = "UTC via LSK -> ET"
FRAME = "MOON_ME"
_LOCK = threading.Lock()


def kernel_dir() -> Path:
    return Path(os.environ.get("LUNASCOPE_KERNEL_DIR", DEFAULT_DIR))


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while block := f.read(4 * 1024 * 1024):
            h.update(block)
    return h.hexdigest()


class KernelSet:
    """The pinned kernel list. Loading verifies size and SHA-256 against the manifest first."""

    def __init__(self, directory: Path | None = None, manifest: Path | None = None):
        self.dir = Path(directory) if directory else kernel_dir()
        m = json.loads(Path(manifest or DEFAULT_MANIFEST).read_text(encoding="utf-8"))
        self.entries = m["kernels"]  # load order matters (LSK, FK, PCK, SPK)
        self.manifest_digest = hash_of([{k: e[k] for k in ("filename", "sha256")}
                                        for e in self.entries])

    def available(self) -> bool:
        return all((self.dir / e["filename"]).exists() for e in self.entries)

    def verify(self) -> None:
        for e in self.entries:
            p = self.dir / e["filename"]
            if not p.exists():
                raise LunaScopeError(RESOURCE_INTEGRITY_FAILED, f"kernel {e['filename']} missing")
            if p.stat().st_size != e["size_bytes"] or _sha256(p) != e["sha256"]:
                raise LunaScopeError(RESOURCE_INTEGRITY_FAILED,
                                     f"kernel {e['filename']} fails its size/checksum pin")

    def load(self) -> None:
        self.verify()
        with _LOCK:
            sp.kclear()
            for e in self.entries:
                sp.furnsh(str(self.dir / e["filename"]))


class SpiceProvider:
    identity: ClassVar[dict] = {"name": "naif-spice", "correction_mode": CORRECTION_MODE, "time_scale": TIME_SCALE,
                "frame": FRAME}

    def __init__(self, kernels: KernelSet | None = None, *, load: bool = True):
        self.kernels = kernels or KernelSet()
        if load:
            self.kernels.load()

    def _utc_to_et(self, t: datetime) -> float:
        if t.tzinfo is None or t.utcoffset().total_seconds() != 0:
            raise LunaScopeError(INVALID_INPUT, "times must be UTC", field="times_utc")
        return sp.str2et(t.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S.%f") + " UTC")

    def direction_body_fixed(self, obs: CanonicalObserver, target: str, t: datetime):
        """Observer-to-target vector (km) in MOON_ME, from the SPICE kernels (`LT+S`)."""
        if target not in TARGETS:
            raise LunaScopeError(INVALID_INPUT, f"unknown target {target!r}", field="target")
        with _LOCK:
            et = self._utc_to_et(t)
            state, _lt = sp.spkcpo(TARGETS[target], et, FRAME, "OBSERVER", "LT+S",
                                   list(obs.position_km), "MOON", FRAME)
        return np.array(state[:3])

    def series(self, obs: CanonicalObserver, target: str, times_utc: list[datetime]) -> GeometrySeries:
        az, el = [], []
        for t in times_utc:
            a, e = az_el(self.direction_body_fixed(obs, target, t), obs)
            az.append(float(a))
            el.append(float(e))
        request = {"target": target, "observer": obs.digest(), "frame": FRAME,
                   "abcorr": "LT+S", "kernels": self.kernels.manifest_digest}
        return GeometrySeries(
            target=target, t_utc=tuple(times_utc), az_deg=np.array(az), el_deg=np.array(el),
            provider="naif-spice", signature_version=sp.tkvrsn("TOOLKIT"),
            raw_sha256=hash_of(request), retrieved_utc=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            request=request, correction_mode=CORRECTION_MODE, time_scale=TIME_SCALE,
            header={"kernels": [e["filename"] for e in self.kernels.entries]})
