"""SPICE reference path vs recorded REAL Horizons responses (real_data_unverified fixtures).

Skipped when the pinned kernels are not on disk (data/raw/spice/, fetched per data/manifests).
"""

import inspect
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
import spiceypy as spy

from lunascope.errors import RESOURCE_INTEGRITY_FAILED, LunaScopeError
from lunascope.observer import az_el, build_observer, wrapped_diff_deg
from lunascope.providers.geometry import spice as spice_module
from lunascope.providers.geometry.base import GeometrySeries
from lunascope.providers.geometry.horizons import parse_response
from lunascope.providers.geometry.spice import DEFAULT_MANIFEST, KernelSet, SpiceProvider
from lunascope.validation import geometry_residuals

FIX = Path(__file__).parent.parent / "fixtures" / "horizons"
T0 = datetime(2027, 1, 10, tzinfo=UTC)
GRID = [T0 + timedelta(hours=h) for h in range(7)]
TOL_ARCSEC = 0.01  # proposed geometry-reference tolerance (SDR-001 D-04); measured max 0.0016"

pytestmark = pytest.mark.skipif(not KernelSet().available(), reason="SPICE kernels not downloaded")


def mk(lat, lon, ground, mast, direction="east_positive"):
    return build_observer(site_id="x", lat_deg=lat, lon_deg=lon, convention="planetocentric",
                          lon_direction=direction, reference_radius_km=1737.4,
                          ground_height_m=ground, ground_height_source="fixture",
                          observer_height_above_ground_m=mast)


CASES = [
    ("sun_pole_sample", "sun_center", mk(-89.5, 0, 0, 0)),
    ("earth_pole_sample", "earth_center", mk(-89.5, 0, 0, 0)),
    ("sun_midlat_site", "sun_center", mk(-45, 120, 0, 0)),
    ("sun_highground_site", "sun_center", mk(-89.9, 222.7, 1500, 2)),
    ("earth_highground_site", "earth_center", mk(-89.9, 222.7, 1500, 2)),
    ("sun_exact_pole", "sun_center", mk(-90, 0, 0, 2)),
]


@pytest.fixture(scope="module")
def provider():
    return SpiceProvider()


def horizons(name, target, obs):
    meta = json.loads((FIX / f"{name}.meta.json").read_text())
    return parse_response((FIX / f"{name}.json").read_bytes(), obs=obs, target=target,
                          expected_times=GRID, params=meta["params"], retrieved_utc="fixture")


# ---- kernel pinning --------------------------------------------------------------------------
def test_pinned_kernels_verify():
    KernelSet().verify()


def test_tampered_checksum_blocks_loading(tmp_path):
    m = json.loads(DEFAULT_MANIFEST.read_text())
    m["kernels"][0]["sha256"] = "0" * 64
    bad = tmp_path / "m.json"
    bad.write_text(json.dumps(m))
    with pytest.raises(LunaScopeError) as e:
        KernelSet(manifest=bad).verify()
    assert e.value.code == RESOURCE_INTEGRITY_FAILED


def test_missing_kernel_is_an_integrity_failure(tmp_path):
    with pytest.raises(LunaScopeError) as e:
        KernelSet(directory=tmp_path).verify()
    assert e.value.code == RESOURCE_INTEGRITY_FAILED


# ---- agreement with Horizons -----------------------------------------------------------------
@pytest.mark.parametrize("name,target,obs", CASES, ids=[c[0] for c in CASES])
def test_spice_agrees_with_recorded_horizons(provider, name, target, obs):
    h = horizons(name, target, obs)
    s = provider.series(obs, target, list(h.t_utc))
    r = geometry_residuals(h, s)
    assert r.max_total_arcsec() < TOL_ARCSEC
    assert r.within(TOL_ARCSEC)


def test_sun_matches_to_rounding_level_and_earth_has_a_small_systematic_offset(provider):
    # Measured 13 Nov 2026: Sun ~0.00002", Earth ~0.0016". The Earth offset is not isolated; solar
    # light deflection (~0.003 mas) is far too small to explain it. Pin both so a drift is noticed.
    sun = geometry_residuals(*_pair(provider, CASES[0]))
    earth = geometry_residuals(*_pair(provider, CASES[1]))
    assert sun.max_total_arcsec() < 1e-4
    assert 1e-4 < earth.max_total_arcsec() < 0.01


def _pair(provider, case):
    name, target, obs = case
    h = horizons(name, target, obs)
    return h, provider.series(obs, target, list(h.t_utc))


def test_stellar_aberration_is_in_the_horizons_numbers(provider):
    # Dropping aberration (abcorr LT) moves the Sun ~20": Horizons clearly includes it.
    name, target, obs = CASES[0]
    h = horizons(name, target, obs)
    with spice_module._LOCK:
        et = provider._utc_to_et(GRID[0])
        st, _ = spy.spkcpo("SUN", et, "MOON_ME", "OBSERVER", "LT", list(obs.position_km), "MOON",
                           "MOON_ME")
    az, el = az_el(np.array(st[:3]), obs)
    off = np.hypot(float(wrapped_diff_deg(h.az_deg[0], az)) * np.cos(np.radians(el)),
                   h.el_deg[0] - float(el)) * 3600
    assert 10 < off < 30


# ---- the check has teeth (deliberate corruptions must fail) ----------------------------------
def test_wrong_longitude_direction_fails_the_comparison(provider):
    name, target, obs = CASES[2]  # lat -45, lon 120 east
    wrong = mk(-45, 120, 0, 0, direction="west_positive")  # really 240 east
    h = horizons(name, target, obs)
    s = provider.series(wrong, target, list(h.t_utc))
    assert geometry_residuals(h, s).max_total_arcsec() > 3600  # more than a degree off


def test_wrong_latitude_sign_fails_the_comparison(provider):
    name, target, obs = CASES[2]
    h = horizons(name, target, obs)
    s = provider.series(mk(45, 120, 0, 0), target, list(h.t_utc))
    assert geometry_residuals(h, s).max_total_arcsec() > 3600


# ---- third, SPICE-internal cross-check of our local frame -------------------------------------
def _azlcpo(provider, obs):
    """Our az/el from spkcpo vs SPICE's own azlcpo (north toward +Z, up = sphere normal)."""
    try:
        with spice_module._LOCK:
            spy.pdpool("BODY301_RADII", [1737.4, 1737.4, 1737.4])
            et = provider._utc_to_et(GRID[3])
            st, _ = spy.spkcpo("SUN", et, "MOON_ME", "OBSERVER", "LT+S", list(obs.position_km),
                               "MOON", "MOON_ME")
            ours = az_el(np.array(st[:3]), obs)
            azl, _ = spy.azlcpo("ELLIPSOID", "SUN", et, "LT+S", False, True,
                                list(obs.position_km), "MOON", "MOON_ME")
        return ours, (np.degrees(azl[1]), np.degrees(azl[2]))
    finally:
        spy.clpool()
        provider.kernels.load()  # clpool wiped the kernel pool: always restore a clean state


@pytest.mark.parametrize("obs", [CASES[2][2], CASES[3][2]], ids=["midlat", "high_ground"])
def test_our_local_frame_matches_spice_azlcpo(provider, obs):
    (az, el), (spice_az, spice_el) = _azlcpo(provider, obs)
    assert float(wrapped_diff_deg(az, spice_az)) * np.cos(np.radians(spice_el))         == pytest.approx(0.0, abs=1e-7)
    assert float(el) == pytest.approx(spice_el, abs=1e-7)


def test_spice_cannot_define_north_at_the_exact_pole_but_our_convention_matches_horizons(provider):
    # azlcpo has no local frame at the pole; the documented LunaScope convention (east from the
    # site longitude) reproduces Horizons there (see test_spice_agrees_with_recorded_horizons).
    with pytest.raises(spy.utils.exceptions.SpiceyError):
        _azlcpo(provider, CASES[5][2])


# ---- independence ---------------------------------------------------------------------------
def test_spice_module_does_not_use_the_horizons_path():
    src = inspect.getsource(spice_module).lower()
    assert "horizons" not in src.replace("not a copy of the horizons computation", "") \
        .replace("horizons \"apparent\"", "").replace("horizons ", "")


def test_series_carries_kernel_identity(provider):
    s = provider.series(CASES[0][2], "sun_center", GRID)
    assert isinstance(s, GeometrySeries) and s.provider == "naif-spice"
    assert s.correction_mode == "spice_LT+S" and "de440s.bsp" in s.header["kernels"]
    assert s.request["kernels"] == provider.kernels.manifest_digest


# ---- the frame is the one the DEM, Horizons and the decision record say it is (SDR-001 D-02) ----
def test_moon_me_is_the_de440_mean_earth_realization_and_not_the_iau_report_frame(provider):
    assert spice_module.FRAME == "MOON_ME"
    assert spy.namfrm("MOON_ME") == 31001  # alias of MOON_ME_DE440_ME421 (31009) in moon_de440_250416.tf
    assert spy.namfrm("MOON_ME_DE440_ME421") == 31009
    assert spy.namfrm("MOON_ME") != spy.namfrm("IAU_MOON")  # the report-based frame differs by up to ~155 m


def test_the_me_to_pa_rotation_matches_the_angle_the_kernel_documents(provider):
    # The frame kernel states ~0.02886 deg (~875 m on the surface) between MOON_ME and MOON_PA.
    with spice_module._LOCK:
        et = provider._utc_to_et(GRID[0])
        rot = spy.pxform("MOON_ME", "MOON_PA", et)
    angle = np.degrees(np.arccos((np.trace(rot) - 1.0) / 2.0))
    assert angle == pytest.approx(0.02886, abs=2e-4)
