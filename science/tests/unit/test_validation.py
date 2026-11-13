from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from lunascope.providers.geometry.base import GeometrySeries
from lunascope.validation import geometry_residuals

T = tuple(datetime(2027, 1, 10, tzinfo=UTC) + timedelta(hours=h) for h in range(3))


def series(az, el, provider="p", target="sun_center", t=T):
    return GeometrySeries(target=target, t_utc=t, az_deg=np.array(az), el_deg=np.array(el),
                          provider=provider, signature_version="x", raw_sha256="h",
                          retrieved_utc="x", request={}, correction_mode="m", time_scale="UTC")


def test_azimuth_residual_is_wrapped_across_north():
    r = geometry_residuals(series([359.9999, 0.0001, 10.0], [1, 1, 1]),
                           series([0.0001, 359.9999, 10.0], [1, 1, 1], "q"))
    assert np.allclose(r.az_deg, [-0.0002, 0.0002, 0.0], atol=1e-9)


def test_azimuth_residual_is_scaled_to_the_sky():
    r = geometry_residuals(series([10.001], [60.0], t=T[:1]), series([10.0], [60.0], "q", t=T[:1]))
    assert r.az_on_sky_deg[0] == pytest.approx(0.001 * 0.5, rel=1e-6)  # cos 60 deg = 0.5


def test_mismatched_series_are_rejected_not_compared():
    with pytest.raises(ValueError):
        geometry_residuals(series([1, 2, 3], [0, 0, 0]),
                           series([1, 2, 3], [0, 0, 0], target="earth_center"))
    with pytest.raises(ValueError):
        geometry_residuals(series([1, 2, 3], [0, 0, 0]), series([1, 2], [0, 0], t=T[:2]))


def test_within_uses_the_total_on_sky_error():
    r = geometry_residuals(series([10.0, 10.0, 10.0], [1, 1, 1]),
                           series([10.0, 10.0, 10.0], [1, 1, 1.00001], "q"))
    assert r.max_total_arcsec() == pytest.approx(0.036, rel=1e-3)
    assert r.within(0.05) and not r.within(0.03)
