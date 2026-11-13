"""DemTerrain: projection, bilinear sampling and window handling on a synthetic source with known
answers, plus checks against the real LOLA products (skipped when the files are not on disk)."""

import dataclasses
import hashlib
import math

import numpy as np
import pytest

from lunascope.dem import (
    HALF,
    PIX,
    RAW,
    SPHERE_M,
    DemTerrain,
    GeoTiffSource,
    N,
    PdsImgSource,
    footprint_coverage,
    lonlat_to_unit,
    stereographic_xy,
)
from lunascope.errors import RESOURCE_INTEGRITY_FAILED, LunaScopeError
from lunascope.horizon import CERTIFIED, HorizonSettings, clearance_deg, compute_horizon
from lunascope.observer import build_observer

ADJ = RAW / "LDEM_80S_20MPP_ADJ.TIF"
PDS = RAW / "LDEM_80S_20M.IMG"
have_adj, have_pds = ADJ.exists(), PDS.exists()
need_files = pytest.mark.skipif(not (have_adj and have_pds), reason="DEM files not downloaded")


class LinearSource:
    """z(row, col) = 3 + 0.01*row + 0.02*col  (bilinear interpolation is exact for this)."""

    kind = "fake"

    def __init__(self, path=None, nan_cells=()):
        self.path, self.nan_cells, self.reads = path, set(nan_cells), []

    def window(self, r0, r1, c0, c1):
        self.reads.append((r0, r1, c0, c1))
        rr, cc = np.mgrid[r0:r1, c0:c1]
        z = (3 + 0.01 * rr + 0.02 * cc).astype(np.float64)
        for (r, c) in self.nan_cells:
            if r0 <= r < r1 and c0 <= c < c1:
                z[r - r0, c - c0] = np.nan
        return z.astype(np.float32)


def at_xy(x, y):
    """Unit vector whose stereographic image is (x, y)."""
    rho = math.hypot(x, y)
    z = (rho**2 - 4 * SPHERE_M**2) / (rho**2 + 4 * SPHERE_M**2)  # inverse of rho = 2R sqrt((1+z)/(1-z))
    s = math.sqrt(max(1 - z * z, 0.0))
    return np.array([s * y / rho, s * x / rho, z]) if rho > 0 else np.array([0.0, 0.0, -1.0])


def dem(src=None, lat=-89.5, lon=0.0, radius=40.0):
    return DemTerrain(src or LinearSource(), center_lat_deg=lat, center_lon_east_deg=lon,
                      radius_km=radius)


# ---- projection ------------------------------------------------------------------------------
def test_projection_key_points():
    x, y = stereographic_xy(np.array([[0.0, 0.0, -1.0]]))
    assert x[0] == pytest.approx(0) and y[0] == pytest.approx(0)
    rho80 = 2 * SPHERE_M * math.tan(math.radians(5.0))
    assert abs(rho80 - HALF) < 100  # 80 deg S sits on the 304 km tile edge
    for lon, ex, ey in ((0, 0, 1), (90, 1, 0), (180, 0, -1), (270, -1, 0)):
        x, y = stereographic_xy(lonlat_to_unit(-80.0, lon)[None, :])
        assert x[0] == pytest.approx(ex * rho80, abs=1e-6) and y[0] == pytest.approx(ey * rho80, abs=1e-6)


def test_inverse_helper_round_trips():
    for x, y in ((12345.0, -2000.0), (-150000.0, 80000.0), (0.0, 250000.0)):
        xx, yy = stereographic_xy(at_xy(x, y)[None, :])
        assert xx[0] == pytest.approx(x, abs=1e-6) and yy[0] == pytest.approx(y, abs=1e-6)


@pytest.mark.skipif(not have_adj, reason="DEM files not downloaded")
def test_projection_matches_proj_with_the_datasets_own_crs():
    import rasterio
    from pyproj import Transformer
    ds = rasterio.open(ADJ)
    rng = np.random.default_rng(7)
    lat, lon = rng.uniform(-90, -80, 3000), rng.uniform(0, 360, 3000)
    xp, yp = Transformer.from_crs(ds.crs.geodetic_crs, ds.crs, always_xy=True).transform(lon, lat)
    la, lo = np.radians(lat), np.radians(lon)
    q = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)
    x, y = stereographic_xy(q)
    assert np.abs(x - xp).max() < 1e-4 and np.abs(y - yp).max() < 1e-4  # metres


# ---- sampling on a source with known answers --------------------------------------------------
def pixel_centre_xy(row, col):
    return -HALF + PIX * (col + 0.5), HALF - PIX * (row + 0.5)


def test_pixel_centres_return_the_pixel_value_and_orientation_is_north_up_east_right():
    d = dem()
    for row, col in ((15200, 15200), (15000, 15300), (15400, 15100)):
        x, y = pixel_centre_xy(row, col)
        z = d.elevation_m(at_xy(x, y)[None, :])[0]
        assert z == pytest.approx(3 + 0.01 * row + 0.02 * col, abs=1e-4)


def test_bilinear_is_exact_for_a_linear_surface_between_pixels():
    d = dem()
    x0, y0 = pixel_centre_xy(15200, 15200)
    for fx, fy in ((0.25, 0.5), (0.9, 0.1), (0.5, 0.5)):
        x, y = x0 + fx * PIX, y0 - fy * PIX  # east = +col, south = +row
        z = d.elevation_m(at_xy(x, y)[None, :])[0]
        assert z == pytest.approx(3 + 0.01 * (15200 + fy) + 0.02 * (15200 + fx), abs=1e-4)


def test_outside_the_tile_and_outside_the_window_is_nan_never_zero():
    d = dem(radius=20.0)
    assert np.isnan(d.elevation_m(at_xy(HALF + 5 * PIX, 0.0)[None, :])[0])  # beyond the tile edge
    assert np.isnan(d.elevation_m(at_xy(-HALF - 1.0, 100.0)[None, :])[0])
    far = at_xy(150_000.0, 150_000.0)  # inside the tile, but outside the 20 km window
    assert np.isnan(d.elevation_m(far[None, :])[0])


def test_a_nan_neighbour_makes_the_sample_nan_but_not_its_surroundings():
    src = LinearSource(nan_cells={(15200, 15201)})
    d = dem(src)
    x, y = pixel_centre_xy(15200, 15200)
    assert np.isnan(d.elevation_m(at_xy(x + 0.5 * PIX, y)[None, :])[0])  # uses the NaN pixel
    xs, ys = pixel_centre_xy(15190, 15190)
    assert np.isfinite(d.elevation_m(at_xy(xs, ys)[None, :])[0])


def test_window_is_a_bounded_crop_not_the_whole_tile():
    src = LinearSource()
    d = dem(src, radius=40.0)
    r0, r1, c0, c1 = src.reads[0]
    assert (r1 - r0) < 0.3 * N and (c1 - c0) < 0.3 * N
    assert d.data.shape == (r1 - r0, c1 - c0) and not d.clipped
    edge = DemTerrain(LinearSource(), center_lat_deg=-80.2, center_lon_east_deg=90.0, radius_km=50.0)
    assert edge.clipped


def test_footprint_entirely_outside_the_tile_is_refused():
    with pytest.raises(LunaScopeError):
        DemTerrain(LinearSource(), center_lat_deg=-60.0, center_lon_east_deg=0.0, radius_km=10.0)


def test_ground_height_and_missing_height():
    d = dem()
    z = d.ground_height_m(-89.9, 30.0)
    assert math.isfinite(z)
    with pytest.raises(LunaScopeError):
        d.ground_height_m(-70.0, 0.0)  # outside the tile


def test_integrity_check_uses_the_manifest_pin(tmp_path):
    f = tmp_path / "x.bin"
    f.write_bytes(b"abc")
    d = dem(LinearSource(path=f))
    d.identity = {**d.identity, "sha256": hashlib.sha256(b"abc").hexdigest()}
    d.verify_integrity()
    d.identity = {**d.identity, "sha256": "0" * 64}
    with pytest.raises(LunaScopeError) as e:
        d.verify_integrity()
    assert e.value.code == RESOURCE_INTEGRITY_FAILED
    d.identity = {**d.identity, "sha256": None}
    with pytest.raises(LunaScopeError):
        d.verify_integrity()  # no pin means no trust


def test_footprint_coverage_report():
    near = build_observer(site_id="a", lat_deg=-89.5, lon_deg=0, convention="planetocentric",
                          lon_direction="east_positive", reference_radius_km=1737.4,
                          ground_height_m=0, ground_height_source="t", observer_height_above_ground_m=2)
    edge = dataclasses.replace(near, lat_deg=-82.0)
    assert footprint_coverage(near, 150.0)["fully_covered"]
    c = footprint_coverage(edge, 150.0)
    assert not c["fully_covered"] and 0 < c["covered_fraction"] < 1 and c["sectors_with_gap"] > 0


def test_synthetic_surface_through_the_horizon_engine_marks_off_tile_sectors_limited():
    obs = build_observer(site_id="a", lat_deg=-80.5, lon_deg=0, convention="planetocentric",
                         lon_direction="east_positive", reference_radius_km=1737.4,
                         ground_height_m=3.0, ground_height_source="t", observer_height_above_ground_m=2)
    d = DemTerrain(LinearSource(), center_lat_deg=-80.5, center_lon_east_deg=0.0, radius_km=40.0)
    p = compute_horizon(obs, d, HorizonSettings(radius_km=40.0, az_step_deg=5.0, near_pixel_m=100,
                                                far_pixel_m=100))
    assert 0 < (p.sector_state != CERTIFIED).sum() < len(p.sector_state)  # only the sectors off the tile
    assert np.isnan(clearance_deg(1.0, p.azimuth_deg[np.flatnonzero(p.sector_state != CERTIFIED)[0]], p))


# ---- real data -------------------------------------------------------------------------------
@need_files
def test_real_sources_agree_with_each_other_and_with_gdal_sampling():
    import rasterio
    a = DemTerrain(GeoTiffSource(ADJ), center_lat_deg=-89.5, center_lon_east_deg=0.0, radius_km=20.0)
    p = DemTerrain(PdsImgSource(PDS), center_lat_deg=-89.5, center_lon_east_deg=0.0, radius_km=20.0)
    rng = np.random.default_rng(3)
    cx, cy = stereographic_xy(lonlat_to_unit(-89.5, 0.0))  # points within 10 km of the site
    q = np.stack([at_xy(cx + dx, cy + dy) for dx, dy in rng.uniform(-10000, 10000, (400, 2))])
    za, zp = a.elevation_m(q), p.elevation_m(q)
    assert np.isfinite(za).all() and np.isfinite(zp).all()
    assert np.sqrt(np.mean((za - zp) ** 2)) < 5.0  # RMS between releases, metres
    # GDAL nearest sampling at pixel centres must equal our value exactly there
    ds = rasterio.open(ADJ)
    rows = np.array([15150, 15200, 15250, 15300])
    cols = np.array([15180, 15210, 15240, 15260])
    xs, ys = -HALF + PIX * (cols + 0.5), HALF - PIX * (rows + 0.5)
    gdal = np.array([v[0] for v in ds.sample(zip(xs, ys, strict=True))])
    ours = a.elevation_m(np.stack([at_xy(x, y) for x, y in zip(xs, ys, strict=True)]))
    assert np.allclose(ours, gdal, atol=1e-3)


@need_files
def test_real_horizon_at_the_fixture_site_both_dems():
    lat, lon = -89.5, 0.0
    s = HorizonSettings(radius_km=100.0, az_step_deg=0.5)
    profs = {}
    for name, src in (("adj", GeoTiffSource(ADJ)), ("pds", PdsImgSource(PDS))):
        d = DemTerrain(src, center_lat_deg=lat, center_lon_east_deg=lon, radius_km=100.0)
        g = d.ground_height_m(lat, lon)
        obs = build_observer(site_id="s", lat_deg=lat, lon_deg=lon, convention="planetocentric",
                             lon_direction="east_positive", reference_radius_km=1737.4,
                             ground_height_m=g, ground_height_source=name,
                             observer_height_above_ground_m=2.0)
        profs[name] = compute_horizon(obs, d, s)
        assert g == pytest.approx(-722.0, abs=1.0)  # measured 13 Nov 2026
    for p in profs.values():
        assert (p.sector_state == CERTIFIED).all() and np.isfinite(p.horizon_el_deg).all()
        assert 8.0 < np.nanmax(p.horizon_el_deg) < 11.0 and np.nanmin(p.horizon_el_deg) < 1.0
        # the recorded Sun (azimuth ~153.5, elevation ~0.42 deg) is far below this skyline
        assert float(p.lookup(153.48)) > 9.0 and clearance_deg(0.4177, 153.48, p) < -8.0
    # skyline toward the Sun agrees across releases even though other azimuths differ
    assert abs(float(profs["adj"].lookup(153.48)) - float(profs["pds"].lookup(153.48))) < 0.01
    diff = np.abs(profs["adj"].lookup(np.arange(0, 360, 0.5)) - profs["pds"].lookup(np.arange(0, 360, 0.5)))
    assert 0.1 < diff.max() < 1.0  # measured ~0.45 deg: the DEM release matters at some azimuths
