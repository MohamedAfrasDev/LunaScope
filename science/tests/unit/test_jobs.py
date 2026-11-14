"""Supervisor behaviour with FAKE worker processes (tiny `python -c` scripts) so timeouts, crashes
and concurrency run in seconds. The real worker is covered by test_service.py."""

import json
import sys
import time

import pytest

from lunascope.jobs import JobRunner
from lunascope.stacks import ServiceConfig
from lunascope.store import RunStore

PRELUDE = "import json,sys,time,pathlib\nd=pathlib.Path(sys.argv[1]); job=json.loads((d/'job.json').read_text())\n"
OK = PRELUDE + ("(d/'result.json').write_text(json.dumps({'run_id':job['run_id'],'result_id':'res-'+job['run_id'][:6],"
                "'status':'complete','result_state':'synthetic_demonstration'}))\n")
SLOW_OK = PRELUDE + ("(d/'progress.json').write_text(json.dumps({'stage':'site 1/1: x','progress':0.5}))\n"
                     "time.sleep(1.5)\n"
                     "(d/'result.json').write_text(json.dumps({'run_id':job['run_id'],'result_id':'r-'+job['run_id'][:8],"
                     "'status':'complete','result_state':'synthetic_demonstration'}))\n")
SLEEP = PRELUDE + "time.sleep(60)\n"
BRIEF = PRELUDE + ("time.sleep(1.0)\n(d/'result.json').write_text(json.dumps({'run_id':job['run_id'],'result_id':'r-'+job['run_id'][:8],"
                   "'status':'complete','result_state':'synthetic_demonstration'}))\n")
CRASH = "import sys; sys.exit(7)\n"
HANDLED = PRELUDE + ("(d/'error.json').write_text(json.dumps({'code':'DEM_COVERAGE_INCOMPLETE','message':'no tile'}))\n"
                     "sys.exit(3)\n")
WRONG = PRELUDE + ("(d/'result.json').write_text(json.dumps({'run_id':'someone-else','result_id':'r-'+job['run_id'][:8],"
                   "'status':'complete','result_state':'s'}))\n")


def cmd(code):
    return lambda d: [sys.executable, "-c", code, str(d)]


def make(tmp_path, code, **kw):
    cfg = ServiceConfig(data_dir=tmp_path, stack_kind="synthetic", **kw)
    store = RunStore(tmp_path / "s", max_queued=cfg.max_queued)
    return store, JobRunner(store, cfg, worker_cmd=cmd(code), poll_s=0.05), cfg


def submit(store, rid):
    store.admit(run_id=rid, request_hash="h", resource_digest="r", algorithm_id="a", request_json="{}",
                effective_json='{"effective":{},"resources":[]}', stack_kind="synthetic",
                result_state="synthetic_demonstration")


def drive(runner, store, rids, until, timeout=40.0):
    t0 = time.time()
    seen_max = 0
    while time.time() - t0 < timeout:
        runner.tick()
        seen_max = max(seen_max, len(runner._running))
        if until([store.get(r) for r in rids]):
            return seen_max
        time.sleep(0.05)
    raise AssertionError(f"timed out: {[store.get(r)['status'] for r in rids]}")


def done(rows):
    return all(r["status"] in ("complete", "failed") for r in rows)


def test_success_publishes_the_artifact_and_cleans_staging(tmp_path):
    store, runner, _ = make(tmp_path, OK)
    submit(store, "a" * 64)
    drive(runner, store, ["a" * 64], done)
    row = store.get("a" * 64)
    assert row["status"] == "complete" and row["result_id"] == "res-aaaaaa" and row["analysis_artifact"]
    assert store.get_artifact(row["analysis_artifact"])
    assert not (store.staging / ("a" * 64) / "1").exists()


def test_progress_from_the_worker_reaches_the_store_while_it_runs(tmp_path):
    store, runner, _ = make(tmp_path, SLOW_OK)
    submit(store, "b" * 64)
    drive(runner, store, ["b" * 64], lambda rows: rows[0]["stage"] == "site 1/1: x")
    assert store.get("b" * 64)["status"] == "running" and store.get("b" * 64)["progress"] == 0.5
    drive(runner, store, ["b" * 64], done)


def test_never_more_than_max_running_processes_at_once(tmp_path):
    store, runner, _ = make(tmp_path, BRIEF, max_running=2)
    ids = [f"{i}" * 64 for i in range(5)]
    for r in ids:
        submit(store, r)
    peak = drive(runner, store, ids, done, timeout=60)
    assert peak == 2 and all(store.get(r)["status"] == "complete" for r in ids)


def test_timeout_kills_the_process_frees_the_slot_and_does_not_retry(tmp_path):
    store, runner, _ = make(tmp_path, SLEEP, timeout_s=1.0)
    submit(store, "c" * 64)
    procs = []

    def grab(rows):
        procs.extend(r.proc for r in runner._running.values() if r.proc not in procs)
        return done(rows)

    drive(runner, store, ["c" * 64], grab)
    row = store.get("c" * 64)
    assert row["status"] == "failed" and row["error_code"] == "TIMEOUT" and row["current_attempt"] == 1
    assert procs and procs[0].poll() is not None  # the OS process is really gone
    assert runner._running == {}  # slot freed only after the exit


def test_a_crashing_worker_is_retried_then_given_up_on(tmp_path):
    store, runner, _ = make(tmp_path, CRASH)
    submit(store, "d" * 64)
    drive(runner, store, ["d" * 64], done)
    row = store.get("d" * 64)
    assert row["status"] == "failed" and row["error_code"] == "ATTEMPT_LIMIT" and row["current_attempt"] == 2


def test_a_handled_error_keeps_its_code_and_is_not_retried(tmp_path):
    store, runner, _ = make(tmp_path, HANDLED)
    submit(store, "e" * 64)
    drive(runner, store, ["e" * 64], done)
    row = store.get("e" * 64)
    assert row["status"] == "failed" and row["error_code"] == "DEM_COVERAGE_INCOMPLETE"
    assert row["current_attempt"] == 1


def test_a_result_for_another_run_is_refused(tmp_path):
    store, runner, _ = make(tmp_path, WRONG)
    submit(store, "f" * 64)
    drive(runner, store, ["f" * 64], done)
    assert store.get("f" * 64)["error_code"] == "BAD_RESULT" and store.get("f" * 64)["analysis_artifact"] is None


def test_start_up_recovers_runs_left_running_by_a_dead_process(tmp_path):
    store, runner, _ = make(tmp_path, OK)
    submit(store, "1" * 64)
    store.claim("1" * 64)  # a previous process claimed it and died
    runner.start()
    try:
        t0 = time.time()
        while store.get("1" * 64)["status"] != "complete" and time.time() - t0 < 30:
            time.sleep(0.1)
    finally:
        runner.stop()
    row = store.get("1" * 64)
    assert row["status"] == "complete" and row["current_attempt"] == 2
    assert runner.reconciled == {"requeued": 1, "failed": 0}


def test_stopping_the_service_kills_workers_and_requeues_their_runs(tmp_path):
    store, runner, _ = make(tmp_path, SLEEP)
    submit(store, "2" * 64)
    runner.start()
    t0 = time.time()
    while "2" * 64 not in runner.running_ids() and time.time() - t0 < 20:
        time.sleep(0.05)
    proc = runner._running["2" * 64].proc
    runner.stop()
    assert proc.poll() is not None
    assert store.get("2" * 64)["status"] == "queued"


@pytest.mark.parametrize("n", [3])
def test_queue_capacity_is_enforced_at_admission_not_by_the_workers(tmp_path, n):
    store, _runner, _ = make(tmp_path, SLEEP, max_queued=n)
    for i in range(n):
        submit(store, f"{i}" * 64)
    with pytest.raises(Exception) as e:
        submit(store, "z" * 64)
    assert getattr(e.value, "code", "") == "QUEUE_FULL"


def test_a_refused_progress_write_never_fails_the_run(tmp_path, monkeypatch):
    """Windows refuses to replace progress.json while the supervisor has it open (WinError 5)."""
    from lunascope import worker

    def refuse(path, obj):
        raise PermissionError(5, "Access is denied")
    monkeypatch.setattr(worker, "_write", refuse)
    worker.write_progress(tmp_path, "site 1/3", 0.3)  # must not raise
    monkeypatch.undo()
    worker.write_progress(tmp_path, "site 2/3", 0.6)
    assert json.loads((tmp_path / "progress.json").read_text())["progress"] == 0.6
