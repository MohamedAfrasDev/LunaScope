import time

import numpy as np
import pytest

from lunascope import horizon_store
from lunascope.horizon import HorizonSettings, compute_horizon
from lunascope.observer import build_observer
from lunascope.terrain import Ridge


@pytest.fixture(scope="module")
def prof():
    o = build_observer(site_id="s", lat_deg=-89.5, lon_deg=0.0, convention="planetocentric",
                       lon_direction="east_positive", reference_radius_km=1737.4, ground_height_m=0.0,
                       ground_height_source="synthetic", observer_height_above_ground_m=2.0)
    t = Ridge(o, az_deg=90.0, half_width_deg=5.0, dist_km=5.0, length_km=1.0, height_m=300.0)
    return compute_horizon(o, t, HorizonSettings(radius_km=20.0, az_step_deg=0.1))


def test_round_trip_is_exact_and_fast(tmp_path, prof):
    horizon_store.save(prof, tmp_path)
    t0 = time.perf_counter()
    got = horizon_store.load(prof.cache_key(), tmp_path)
    assert time.perf_counter() - t0 < 0.3  # showcase read budget
    assert got is not None and got.cache_key() == prof.cache_key()
    for k in ("azimuth_deg", "horizon_el_deg", "argmax_distance_km", "sector_state"):
        assert np.array_equal(getattr(got, k), getattr(prof, k), equal_nan=True)


def test_miss_for_unknown_key_and_for_a_corrupted_file(tmp_path, prof):
    assert horizon_store.load("ab" * 32, tmp_path) is None
    p = horizon_store.save(prof, tmp_path)
    data = bytearray(p.read_bytes())
    data[len(data) // 2] ^= 0xFF
    p.write_bytes(bytes(data))
    assert horizon_store.load(prof.cache_key(), tmp_path) is None  # a miss, never a wrong profile


def test_key_must_be_hex(tmp_path):
    with pytest.raises(ValueError):
        horizon_store.load("../evil", tmp_path)
