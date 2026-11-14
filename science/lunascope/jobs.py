"""Bounded job supervisor (spec 8.3, review I-05..I-07).

* At most `max_running` worker processes; queued work waits in the store (bounded at admission).
* Each attempt is a separate OS process, so a timeout genuinely stops the computation. The slot is
  released only after the process has exited.
* Attempts stage their output inside var/staging/<run_id>/<attempt>/; the supervisor publishes the
  artifact and then commits only if that attempt is still the current one.
* Failure policy: handled errors (exit 3) fail the run with their own code and are not retried;
  a crash (any other exit) is retried until MAX_ATTEMPTS; a timeout fails with TIMEOUT.
* On start-up, runs left 'running' by a dead process are requeued or failed (store.reconcile()).
"""

from __future__ import annotations

import json
import logging
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from .logs import log_event
from .stacks import ServiceConfig
from .store import RunStore


def default_worker_cmd(stage_dir: Path) -> list[str]:
    return [sys.executable, "-m", "lunascope.worker", str(stage_dir)]


@dataclass
class _Running:
    run_id: str
    attempt: int
    stage_dir: Path
    proc: subprocess.Popen
    started: float


class JobRunner:
    def __init__(self, store: RunStore, cfg: ServiceConfig,
                 worker_cmd: Callable[[Path], list[str]] = default_worker_cmd, poll_s: float = 0.2):
        self.store, self.cfg, self.worker_cmd, self.poll_s = store, cfg, worker_cmd, poll_s
        self._running: dict[str, _Running] = {}
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.reconciled: dict = {}
        self.on_tick: Callable[[], object] | None = None  # e.g. the alternatives-search pump

    # ------------------------------------------------------------------ lifecycle
    def start(self) -> None:
        self.reconciled = self.store.reconcile()
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="job-runner", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()
        if self._thread:
            self._thread.join(timeout=30)
        for r in list(self._running.values()):  # interrupted work is retried after a restart
            self._kill(r.proc)
            self.store.commit_failure(r.run_id, r.attempt, code="INTERRUPTED",
                                      detail="service stopped while running", outcome="killed", retry=True)
        self._running.clear()

    def notify(self) -> None:
        self._wake.set()

    def running_ids(self) -> list[str]:
        return list(self._running)

    # ------------------------------------------------------------------ loop
    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception:  # noqa: BLE001 - keep the supervisor alive; the store holds the truth
                import traceback
                traceback.print_exc()
            self._wake.wait(self.poll_s)
            self._wake.clear()

    def tick(self) -> None:
        for r in list(self._running.values()):
            self._poll(r)
        while len(self._running) < self.cfg.max_running:
            nxt = next((rid for rid in self.store.queued_ids() if rid not in self._running), None)
            if nxt is None:
                break
            if not self._launch(nxt):
                continue
        if self.on_tick is not None:
            self.on_tick()

    # ------------------------------------------------------------------ launching
    def _launch(self, run_id: str) -> bool:
        claimed = self.store.claim(run_id)
        if claimed is None:
            return False
        attempt, stage_dir = claimed
        row = self.store.require(run_id)
        eff = json.loads(row["effective_settings_json"])
        job = {"run_id": run_id, "algorithm_id": row["algorithm_id"],
               "request": json.loads(row["request_json"]), "effective_settings": eff["effective"],
               "resources": eff["resources"],
               "service": {"data_dir": str(self.cfg.data_dir), "stack_kind": self.cfg.stack_kind,
                           "raw_dir": str(self.cfg.raw_dir),
                           "kernel_dir": str(self.cfg.kernel_dir) if self.cfg.kernel_dir else None}}
        (stage_dir / "job.json").write_text(json.dumps(job), encoding="utf-8")
        try:
            proc = subprocess.Popen(self.worker_cmd(stage_dir), stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL)
        except OSError as e:
            self.store.commit_failure(run_id, attempt, code="WORKER_START_FAILED", detail=str(e))
            return True
        self._running[run_id] = _Running(run_id, attempt, stage_dir, proc, time.time())
        log_event("run_started", run_id=run_id, attempt=attempt)
        return True

    # ------------------------------------------------------------------ monitoring
    @staticmethod
    def _kill(proc: subprocess.Popen) -> None:
        if proc.poll() is not None:
            return
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=10)

    def _poll(self, r: _Running) -> None:
        prog = r.stage_dir / "progress.json"
        if prog.exists():
            try:
                p = json.loads(prog.read_text(encoding="utf-8"))
                self.store.set_progress(r.run_id, r.attempt, p["stage"], float(p["progress"]))
            except (ValueError, KeyError, OSError):
                pass  # a half-written progress file is simply read next tick
        rc = r.proc.poll()
        if rc is None:
            if time.time() - r.started > self.cfg.run_timeout_s:
                self._kill(r.proc)  # slot is freed only after confirmed exit
                log_event("run_timeout", level=logging.WARNING, run_id=r.run_id, attempt=r.attempt,
                          code="TIMEOUT", duration_s=round(time.time() - r.started, 2))
                self.store.commit_failure(r.run_id, r.attempt, code="TIMEOUT",
                                          detail=f"exceeded {self.cfg.run_timeout_s:.0f} s",
                                          outcome="killed")
                del self._running[r.run_id]
            return
        self._finish(r, rc)
        del self._running[r.run_id]

    def _finish(self, r: _Running, rc: int) -> None:
        if rc == 0:
            try:
                raw = (r.stage_dir / "result.json").read_bytes()
                result = json.loads(raw)
                if result["run_id"] != r.run_id:
                    raise ValueError("result belongs to a different run")
            except (OSError, ValueError, KeyError) as e:
                self.store.commit_failure(r.run_id, r.attempt, code="BAD_RESULT", detail=str(e))
                return
            try:
                sha = self.store.put_artifact(raw)  # artifact first, pointer second
                ok = self.store.commit_success(r.run_id, r.attempt, result_id=result["result_id"],
                                               artifact_sha=sha, status=result["status"],
                                               result_state=result["result_state"])
            except Exception as e:  # noqa: BLE001 - e.g. a duplicate result_id: fail the run, never wedge the slot
                self.store.commit_failure(r.run_id, r.attempt, code="RESULT_CONFLICT", detail=str(e))
                return
            log_event("run_finished", run_id=r.run_id, attempt=r.attempt, status=result["status"],
                      result_state=result["result_state"], warnings=result.get("warnings", []),
                      timing_s=result.get("timing_s"), duration_s=round(time.time() - r.started, 2))
            if ok:
                import shutil
                shutil.rmtree(r.stage_dir, ignore_errors=True)
            return
        err = r.stage_dir / "error.json"
        if rc == 3 and err.exists():
            try:
                e = json.loads(err.read_text(encoding="utf-8"))
            except ValueError:
                e = {"code": "INTERNAL_ERROR", "message": "unreadable error file"}
            log_event("run_failed", level=logging.WARNING, run_id=r.run_id, attempt=r.attempt,
                      code=e.get("code", "INTERNAL_ERROR"), duration_s=round(time.time() - r.started, 2))
            self.store.commit_failure(r.run_id, r.attempt, code=e.get("code", "INTERNAL_ERROR"),
                                      detail=e.get("message", ""))
            return
        log_event("run_crashed", level=logging.ERROR, run_id=r.run_id, attempt=r.attempt,
                  code="WORKER_CRASH", exit_code=rc)
        self.store.commit_failure(r.run_id, r.attempt, code="WORKER_CRASH", detail=f"exit code {rc}",
                                  outcome="failed", retry=True)
