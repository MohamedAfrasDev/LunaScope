
from lunascope.registry import (
    HASH_MISMATCH,
    MISSING,
    OK,
    REMOTE,
    SIZE_MISMATCH,
    check_all,
    check_resource,
    summary,
)

M = {"resource_id": "t", "role": "dem", "readiness": "x", "filename": "a.bin"}


def _m(data=b"abc"):
    import hashlib
    return {**M, "size_bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def test_present_and_matching(tmp_path):
    (tmp_path / "a.bin").write_bytes(b"abc")
    assert check_resource(_m(), tmp_path, verify=True).ok


def test_missing_size_and_hash_failures_are_distinct(tmp_path):
    assert check_resource(_m(), tmp_path).files[0].status == MISSING
    (tmp_path / "a.bin").write_bytes(b"abcd")
    assert check_resource(_m(), tmp_path).files[0].status == SIZE_MISMATCH
    (tmp_path / "a.bin").write_bytes(b"abd")
    assert check_resource(_m(), tmp_path).files[0].status == OK  # size only: cheap check
    assert check_resource(_m(), tmp_path, verify=True).files[0].status == HASH_MISMATCH


def test_remote_service_is_not_claimed_verified(tmp_path):
    st = check_resource({"resource_id": "h", "kind": "remote_service", "product_id": "H"}, tmp_path)
    assert st.files[0].status == REMOTE


def test_kernel_manifest_looks_in_spice_subdir(tmp_path):
    (tmp_path / "spice").mkdir()
    (tmp_path / "spice" / "k.tls").write_bytes(b"abc")
    m = {"resource_id": "k", "kernels": [{"filename": "k.tls", "size_bytes": 3}]}
    assert check_resource(m, tmp_path).ok


def test_every_repo_manifest_loads_and_summary_names_failures(tmp_path):
    out = check_all(tmp_path)  # empty raw dir: the file-backed manifests must fail, the service one not
    s = summary(out)
    assert not s["resources_ok"] and "horizons-api" not in s["failing"] and s["checked"] >= 4
