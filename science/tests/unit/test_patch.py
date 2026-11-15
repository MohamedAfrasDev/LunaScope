"""The terrain patch: a grid of real heights around a site, for drawing the ground. A picture, never a visibility result."""

from __future__ import annotations

import base64

import numpy as np
import pytest
from fastapi.testclient import TestClient

from lunascope.errors import LunaScopeError
from lunascope.main import create_app
from lunascope.observer import enu_basis
from lunascope.patch import MAX_SIZE, NODATA, UNIT_M, grid_size, sample_patch, validate
from lunascope.stacks import ServiceConfig

LAT, LON = -88.0, 40.0


class Slope:
    """Height rises to the north (0.5 m per metre) and to the east (0.25 m per metre), exactly, on the sphere."""

    def __init__(self, lat=LAT, lon=LON):
        self.e, self.n, self.u = enu_basis(lat, lon)

    def elevation_m(self, q):
        R = 1_737_400.0
        return R * 0.5 * (q @ self.n) + R * 0.25 * (q @ self.e)


def decode(p: dict) -> np.ndarray:
    raw = base64.b64decode(p["heights_b64"])
    return np.frombuffer(raw, dtype="<i2").reshape(p["size"], p["size"]).astype(np.float64)


def test_the_grid_has_an_odd_number_of_cells_so_the_site_is_the_middle_cell():
    assert grid_size(25, 100) == 501
    assert grid_size(25, 99) % 2 == 1
    assert grid_size(1, 50) == 41


def test_inputs_are_checked_with_the_field_named():
    for kw, field in [
        (dict(lat_deg=-70.0), "lat_deg"),
        (dict(lat_deg=-90.1), "lat_deg"),
        (dict(lon_east_deg=360.0), "lon_east_deg"),
        (dict(lon_east_deg=float("nan")), "lon_east_deg"),
        (dict(radius_km=0.5), "radius_km"),
        (dict(radius_km=41.0), "radius_km"),
        (dict(step_m=10.0), "step_m"),
        (dict(step_m=500.0), "step_m"),
        (dict(radius_km=40.0, step_m=50.0), "step_m"),  # 1,601 cells a side
    ]:
        args = dict(lat_deg=LAT, lon_east_deg=LON, radius_km=25.0, step_m=100.0) | kw
        with pytest.raises(LunaScopeError) as e:
            validate(**args)
        assert e.value.field == field, kw
    validate(LAT, LON, 40.0, 150.0)
    assert grid_size(40.0, 150.0) <= MAX_SIZE


def test_the_site_is_the_middle_cell_and_every_height_is_relative_to_it():
    p = sample_patch(Slope(), LAT, LON, 5.0, 100.0)
    z = decode(p)
    n = p["size"]
    assert n == 101 and z.shape == (101, 101)
    assert z[n // 2, n // 2] == 0
    assert p["unit_m"] == UNIT_M and p["nodata"] == NODATA
    assert p["covered_fraction"] == 1.0
    assert p["schema"] == "lunascope-terrain-patch/1"
    assert p["rows_from"] == "north" and p["cols_from"] == "west"


def test_row_zero_is_north_and_column_zero_is_west():
    p = sample_patch(Slope(), LAT, LON, 5.0, 100.0)
    z = decode(p) * UNIT_M
    n = p["size"]
    mid = n // 2
    # north of the site is higher (0.5 m per metre) and the first row is the northernmost
    assert z[0, mid] > z[mid, mid] > z[-1, mid]
    assert z[0, mid] == pytest.approx(0.5 * 5000, rel=0.02)
    assert z[-1, mid] == pytest.approx(-0.5 * 5000, rel=0.02)
    # east of the site is higher (0.25 m per metre) and the last column is the easternmost
    assert z[mid, -1] > z[mid, mid] > z[mid, 0]
    assert z[mid, -1] == pytest.approx(0.25 * 5000, rel=0.02)
    assert z[mid, 0] == pytest.approx(-0.25 * 5000, rel=0.02)


def test_the_grid_is_laid_out_on_the_sphere_not_on_a_plane():
    """Ten kilometres out, a cell centre is ten kilometres of surface away, not ten kilometres of straight line."""
    p = sample_patch(Slope(), LAT, LON, 10.0, 100.0)
    z = decode(p) * UNIT_M
    mid = p["size"] // 2
    assert z[0, mid] == pytest.approx(0.5 * 10_000, rel=0.01)  # the slope is exact in surface distance


def test_missing_terrain_is_nodata_never_guessed_and_the_coverage_says_so():
    class Holey(Slope):
        def elevation_m(self, q):
            z = super().elevation_m(q)
            north = 1_737_400.0 * (q @ self.n)
            return np.where(north > 2000.0, np.nan, z)  # nothing known more than two kilometres north

    p = sample_patch(Holey(), LAT, LON, 5.0, 100.0)
    z = decode(p)
    assert (z[0, :] == NODATA).all()
    assert (z[p["size"] // 2, :] != NODATA).all()
    assert 0.5 < p["covered_fraction"] < 0.9


def test_a_site_with_no_height_is_refused_instead_of_drawn_flat():
    class Nothing:
        def elevation_m(self, q):
            return np.full(len(q), np.nan)

    with pytest.raises(LunaScopeError) as e:
        sample_patch(Nothing(), LAT, LON, 5.0, 100.0)
    assert e.value.code == "DEM_COVERAGE_INCOMPLETE"


def test_heights_too_large_for_the_packing_are_nodata_not_wrapped():
    class Huge(Slope):
        def elevation_m(self, q):
            return np.where(q @ self.n > self.n @ self.u + 1.0, 0.0, super().elevation_m(q)) + (q @ self.e) * 1e9

    z = decode(sample_patch(Huge(), LAT, LON, 5.0, 100.0))
    assert (z == NODATA).any()
    assert ((z == NODATA) | (np.abs(z) <= 32767)).all()


# ----------------------------------------------------------------------------- the endpoint
def client(tmp_path, **kw):
    return TestClient(create_app(ServiceConfig(data_dir=tmp_path, stack_kind="synthetic", **kw)))


def test_the_endpoint_serves_a_labelled_patch_for_the_synthetic_stack(tmp_path):
    with client(tmp_path) as c:
        r = c.get("/api/v1/terrain/patch", params={"lat_deg": -88, "lon_east_deg": 40, "radius_km": 8, "step_m": 100})
    assert r.status_code == 200
    b = r.json()
    assert b["result_state"] == "synthetic_demonstration"
    assert b["size"] == grid_size(8, 100) and b["dem_profile"] == "lola-80s-20m-adj"
    z = decode(b)
    assert z.shape == (b["size"], b["size"])
    # the synthetic ridge is 5 km to the east, 300 m high; the west side is flat
    mid = b["size"] // 2
    assert z[mid, mid + 50] * UNIT_M > 250 and z[mid, 0] == 0


def test_the_endpoint_refuses_bad_inputs_with_the_field_and_a_422(tmp_path):
    with client(tmp_path) as c:
        for params, field in [
            ({"lat_deg": -70, "lon_east_deg": 40}, "lat_deg"),
            ({"lat_deg": -88, "lon_east_deg": 400}, "lon_east_deg"),
            ({"lat_deg": -88, "lon_east_deg": 40, "radius_km": 90}, "radius_km"),
            ({"lat_deg": -88, "lon_east_deg": 40, "step_m": 5}, "step_m"),
            ({"lat_deg": -88, "lon_east_deg": 40, "dem_profile": "nope"}, "dem_profile"),
        ]:
            r = c.get("/api/v1/terrain/patch", params=params)
            assert r.status_code == 422, params
            assert r.json()["error"]["field"] == field
        assert c.get("/api/v1/terrain/patch", params={"lat_deg": -88}).status_code == 422  # a missing parameter


def test_a_live_service_without_terrain_files_says_so_instead_of_inventing_ground(tmp_path):
    with client(tmp_path) as c:
        pass
    app = create_app(ServiceConfig(data_dir=tmp_path, stack_kind="live", raw_dir=tmp_path / "no-raw"))
    with TestClient(app) as c:
        r = c.get("/api/v1/terrain/patch", params={"lat_deg": -88, "lon_east_deg": 40})
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "TERRAIN_UNAVAILABLE"
