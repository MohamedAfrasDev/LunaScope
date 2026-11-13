"""GeometryProvider contract (spec 5.3)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

import numpy as np

from ...observer import CanonicalObserver


@dataclass(frozen=True)
class GeometrySeries:
    """Sun/Earth centre azimuth and elevation (degrees) on a uniform UTC grid."""

    target: str
    t_utc: tuple[datetime, ...]
    az_deg: np.ndarray
    el_deg: np.ndarray
    provider: str
    signature_version: str
    raw_sha256: str  # hash of the verbatim provider response
    retrieved_utc: str
    request: dict  # the exact parameters sent
    correction_mode: str
    time_scale: str
    flags: tuple[str, ...] = ()
    header: dict = field(default_factory=dict)  # facts echoed by the provider (frame, radii, ...)
    warnings: tuple[str, ...] = ()

    def __len__(self) -> int:
        return len(self.t_utc)


class GeometryProvider(Protocol):
    identity: dict

    def series(self, obs: CanonicalObserver, target: str,
               times_utc: list[datetime]) -> GeometrySeries: ...
