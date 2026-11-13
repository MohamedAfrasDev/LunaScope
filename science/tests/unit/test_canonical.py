from lunascope.canonical import hash_of, make_result_id, make_run_id


def test_key_order_does_not_change_hash():
    assert hash_of({"a": 1, "b": [1, 2]}) == hash_of({"b": [1, 2], "a": 1})


def test_value_change_changes_hash():
    assert hash_of({"a": 1}) != hash_of({"a": 2})


def test_run_id_independent_of_resource_order_but_not_roles():
    res = [{"role": "dem_near", "sha256": "aa"}, {"role": "lsk", "sha256": "bb"}]
    a = make_run_id({"x": 1}, {"eps": 0.01}, res, "alg")
    b = make_run_id({"x": 1}, {"eps": 0.01}, list(reversed(res)), "alg")
    c = make_run_id({"x": 1}, {"eps": 0.01}, [{"role": "dem_far", "sha256": "aa"}, res[1]], "alg")
    assert a == b and a != c


def test_run_id_covers_effective_settings_and_algorithm():
    base = make_run_id({"x": 1}, {"eps": 0.01}, [], "alg")
    assert base != make_run_id({"x": 1}, {"eps": 0.02}, [], "alg")
    assert base != make_run_id({"x": 1}, {"eps": 0.01}, [], "alg2")


def test_result_id_depends_on_inputs_not_artifact_order():
    r1 = make_result_id("run", {"geometry": ["g1"]}, ["a", "b"])
    assert r1 == make_result_id("run", {"geometry": ["g1"]}, ["b", "a"])
    assert r1 != make_result_id("run", {"geometry": ["g2"]}, ["a", "b"])
