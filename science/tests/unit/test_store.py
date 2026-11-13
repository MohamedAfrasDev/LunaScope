import hashlib
import threading

import pytest

from lunascope.errors import RESOURCE_INTEGRITY_FAILED, LunaScopeError
from lunascope.store import MAX_ATTEMPTS, QUEUE_FULL, RunStore


def adm(store, rid, **kw):
    return store.admit(run_id=rid, request_hash="h" + rid, resource_digest="r", algorithm_id="a",
                       request_json="{}", effective_json="{}", stack_kind="synthetic",
                       result_state="synthetic_demonstration", **kw)


@pytest.fixture
def store(tmp_path):
    return RunStore(tmp_path / "s", max_queued=3)


def test_first_admit_creates_second_attaches(store):
    a = adm(store, "r1")
    b = adm(store, "r1")
    assert a.created and not b.created and a.run["run_id"] == b.run["run_id"] == "r1"
    assert a.run["status"] == "queued" and store.counts() == {"queued": 1}


def test_concurrent_identical_submits_admit_exactly_one(store):
    results = []

    def go():
        results.append(adm(store, "same").created)

    ts = [threading.Thread(target=go) for _ in range(12)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert results.count(True) == 1 and len(results) == 12 and store.counts() == {"queued": 1}


def test_queue_is_bounded_but_existing_runs_still_attach(store):
    for i in range(3):
        adm(store, f"r{i}")
    with pytest.raises(LunaScopeError) as e:
        adm(store, "r-new")
    assert e.value.code == QUEUE_FULL and e.value.retryable
    assert not adm(store, "r1").created  # attaching needs no capacity
    assert store.counts() == {"queued": 3}


def test_claim_is_exclusive_and_numbers_attempts(store):
    adm(store, "r1")
    first = store.claim("r1")
    assert first is not None and first[0] == 1 and first[1].is_dir()
    assert store.claim("r1") is None  # no longer queued
    assert store.get("r1")["status"] == "running"


def test_success_commits_only_for_the_current_attempt(store):
    adm(store, "r1")
    store.claim("r1")
    sha = store.put_artifact(b'{"x":1}')
    assert store.commit_success("r1", 99, result_id="x", artifact_sha=sha, status="complete",
                                result_state="synthetic_demonstration") is False  # stale attempt
    assert store.get("r1")["status"] == "running"
    assert store.commit_success("r1", 1, result_id="res", artifact_sha=sha, status="complete",
                                result_state="synthetic_demonstration")
    row = store.get("r1")
    assert row["status"] == "complete" and row["result_id"] == "res" and row["analysis_artifact"] == sha
    assert store.commit_success("r1", 1, result_id="again", artifact_sha=sha, status="complete",
                                result_state="x") is False  # cannot publish twice


def test_a_killed_attempt_cannot_publish_after_a_retry_started(store):
    adm(store, "r1")
    store.claim("r1")
    assert store.commit_failure("r1", 1, code="X", detail="d", outcome="killed", retry=True) == "queued"
    store.claim("r1")  # attempt 2 is now current
    sha = store.put_artifact(b"{}")
    assert not store.commit_success("r1", 1, result_id="late", artifact_sha=sha, status="complete",
                                    result_state="s")
    assert store.get("r1")["status"] == "running" and store.get("r1")["current_attempt"] == 2


def test_retry_policy_gives_up_after_the_attempt_limit(store):
    adm(store, "r1")
    for attempt in range(1, MAX_ATTEMPTS + 1):
        assert store.claim("r1")[0] == attempt
        new = store.commit_failure("r1", attempt, code="WORKER_CRASH", detail="boom", retry=True)
    assert new == "failed"
    row = store.get("r1")
    assert row["status"] == "failed" and row["error_code"] == "ATTEMPT_LIMIT"


def test_handled_failures_are_not_retried(store):
    adm(store, "r1")
    store.claim("r1")
    assert store.commit_failure("r1", 1, code="DEM_COVERAGE_INCOMPLETE", detail="x") == "failed"
    assert store.get("r1")["error_code"] == "DEM_COVERAGE_INCOMPLETE"


def test_reconcile_requeues_then_fails_interrupted_work_and_cleans_staging(store):
    adm(store, "r1")
    adm(store, "r2")
    _, d1 = store.claim("r1")
    (d1 / "partial.tmp").write_text("x")
    store.claim("r2")
    store.commit_failure("r2", 1, code="X", detail="", retry=True)  # r2 -> queued
    _, _ = store.claim("r2")  # r2 attempt 2 running
    out = store.reconcile()
    assert out == {"requeued": 1, "failed": 1}  # r1 (attempt 1) requeued, r2 (attempt 2) failed
    assert store.get("r1")["status"] == "queued" and store.get("r2")["status"] == "failed"
    assert not d1.exists()  # staging of the dead attempt is gone


def test_progress_only_applies_to_the_current_running_attempt(store):
    adm(store, "r1")
    store.claim("r1")
    store.set_progress("r1", 1, "site 1/3", 0.33)
    store.set_progress("r1", 7, "stale", 0.99)
    row = store.get("r1")
    assert row["stage"] == "site 1/3" and row["progress"] == pytest.approx(0.33)


def test_artifacts_are_content_addressed_write_once_and_verified_on_read(store):
    sha = store.put_artifact(b'{"a":1}')
    assert sha == hashlib.sha256(b'{"a":1}').hexdigest() == store.put_artifact(b'{"a":1}')
    assert store.get_artifact(sha) == b'{"a":1}'
    p = store._artifact_path(sha)
    p.write_bytes(b'{"a":2}')
    with pytest.raises(LunaScopeError) as e:
        store.get_artifact(sha)
    assert e.value.code == RESOURCE_INTEGRITY_FAILED
    p.unlink()
    with pytest.raises(LunaScopeError):
        store.get_artifact(sha)


def test_get_analysis_before_completion_is_not_ready(store):
    adm(store, "r1")
    with pytest.raises(LunaScopeError) as e:
        store.get_analysis("r1")
    assert e.value.code == "NOT_READY"
    with pytest.raises(LunaScopeError) as e:
        store.require("missing")
    assert e.value.code == "NOT_FOUND"
