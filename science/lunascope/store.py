"""Run store: SQLite (WAL) for metadata + content-addressed files for artifacts (spec 8, 10).

Guarantees:
  * run_id is UNIQUE; admission is one transaction (check capacity, insert) so concurrent identical
    submits admit exactly one run and every other caller attaches to it;
  * only the caller whose INSERT created the row may schedule work;
  * every execution is an attempt with a number; completion commits only if that attempt is still
    current (a stale or killed attempt cannot publish);
  * artifacts are write-once and named by their SHA-256; reads re-verify the hash.
Repository interface is deliberately small so a hosted database can replace SQLite later.
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
import threading
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .errors import RESOURCE_INTEGRITY_FAILED, LunaScopeError

QUEUE_FULL = "QUEUE_FULL"
NOT_FOUND = "NOT_FOUND"
MAX_ATTEMPTS = 2
ANALYSIS_CACHE_SIZE = 8  # parsed finished analyses kept in memory (a 7-day, 3-site run is a few MB)

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
  run_id            TEXT PRIMARY KEY,
  result_id         TEXT UNIQUE,
  request_hash      TEXT NOT NULL,
  resource_digest   TEXT NOT NULL,
  algorithm_id      TEXT NOT NULL,
  request_json      TEXT NOT NULL,
  effective_settings_json TEXT NOT NULL,
  stack_kind        TEXT NOT NULL,
  status            TEXT NOT NULL,
  stage             TEXT,
  progress          REAL,
  current_attempt   INTEGER NOT NULL DEFAULT 0,
  result_state      TEXT NOT NULL,
  analysis_artifact TEXT,
  created_utc       TEXT NOT NULL,
  finished_utc      TEXT,
  error_code        TEXT,
  error_detail      TEXT
);
CREATE INDEX IF NOT EXISTS runs_status ON runs(status);
CREATE TABLE IF NOT EXISTS attempts (
  run_id      TEXT NOT NULL REFERENCES runs(run_id),
  attempt     INTEGER NOT NULL,
  started_utc TEXT NOT NULL,
  ended_utc   TEXT,
  outcome     TEXT NOT NULL,
  staging_dir TEXT NOT NULL,
  PRIMARY KEY (run_id, attempt)
);
CREATE TABLE IF NOT EXISTS searches (
  search_id     TEXT PRIMARY KEY,
  parent_run_id TEXT NOT NULL REFERENCES runs(run_id),
  objective     TEXT NOT NULL,
  created_utc   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS search_items (
  search_id TEXT NOT NULL REFERENCES searches(search_id),
  offset_s  INTEGER NOT NULL,
  run_id    TEXT REFERENCES runs(run_id),  -- NULL until the child is admitted (bounded batches)
  PRIMARY KEY (search_id, offset_s)
);
CREATE TABLE IF NOT EXISTS run_links (
  child_run_id  TEXT NOT NULL REFERENCES runs(run_id),
  parent_run_id TEXT NOT NULL REFERENCES runs(run_id),
  variant_type  TEXT NOT NULL,
  changed_fields TEXT NOT NULL,
  PRIMARY KEY (child_run_id, parent_run_id)
);
"""


def now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class Admission:
    run: dict
    created: bool  # True only for the caller whose insert created the row: it alone enqueues work


class RunStore:
    def __init__(self, root: Path, *, max_queued: int = 8):
        self.root = Path(root)
        self.max_queued = max_queued
        self.artifacts = self.root / "artifacts"
        self.staging = self.root / "staging"
        for d in (self.root, self.artifacts, self.staging):
            d.mkdir(parents=True, exist_ok=True)
        self._analysis_cache: dict[str, dict] = {}
        self._cache_lock = threading.Lock()
        self.db_path = self.root / "runs.sqlite"
        with self._conn() as c:
            c.executescript(SCHEMA)

    @contextlib.contextmanager
    def _conn(self):
        c = sqlite3.connect(self.db_path, timeout=10, isolation_level=None)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA foreign_keys=ON")
        c.execute("PRAGMA busy_timeout=10000")
        try:
            yield c
        finally:
            c.close()

    # ------------------------------------------------------------------ admission
    def admit(self, *, run_id: str, request_hash: str, resource_digest: str, algorithm_id: str,
              request_json: str, effective_json: str, stack_kind: str, result_state: str) -> Admission:
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            try:
                row = c.execute("SELECT * FROM runs WHERE run_id=?", (run_id,)).fetchone()
                if row is not None:
                    c.execute("COMMIT")
                    return Admission(dict(row), False)
                queued = c.execute("SELECT COUNT(*) FROM runs WHERE status='queued'").fetchone()[0]
                if queued >= self.max_queued:
                    c.execute("ROLLBACK")
                    raise LunaScopeError(QUEUE_FULL, f"{queued} runs are already queued", retryable=True)
                c.execute(
                    "INSERT INTO runs(run_id, request_hash, resource_digest, algorithm_id, request_json,"
                    " effective_settings_json, stack_kind, status, progress, result_state, created_utc)"
                    " VALUES(?,?,?,?,?,?,?, 'queued', 0.0, ?, ?)",
                    (run_id, request_hash, resource_digest, algorithm_id, request_json,
                     effective_json, stack_kind, result_state, now()))
                row = c.execute("SELECT * FROM runs WHERE run_id=?", (run_id,)).fetchone()
                c.execute("COMMIT")
                return Admission(dict(row), True)
            except BaseException:
                with contextlib.suppress(sqlite3.OperationalError):
                    c.execute("ROLLBACK")
                raise

    # ------------------------------------------------------------------ reads
    def get(self, run_id: str) -> dict | None:
        with self._conn() as c:
            row = c.execute("SELECT * FROM runs WHERE run_id=?", (run_id,)).fetchone()
        return None if row is None else dict(row)

    def require(self, run_id: str) -> dict:
        row = self.get(run_id)
        if row is None:
            raise LunaScopeError(NOT_FOUND, f"no run {run_id[:16]}...")
        return row

    def counts(self) -> dict:
        with self._conn() as c:
            rows = c.execute("SELECT status, COUNT(*) n FROM runs GROUP BY status").fetchall()
        return {r["status"]: r["n"] for r in rows}

    def queued_ids(self) -> list[str]:
        with self._conn() as c:
            return [r["run_id"] for r in c.execute(
                "SELECT run_id FROM runs WHERE status='queued' ORDER BY created_utc, run_id")]

    # ------------------------------------------------------------------ variants
    def link(self, *, child_run_id: str, parent_run_id: str, variant_type: str,
             changed_fields: list[str]) -> None:
        """Record that `child` is a variant of `parent` (spec 8.4). Idempotent: the same link
        submitted twice is one row, and a link never changes once written."""
        with self._conn() as c:
            c.execute("INSERT OR IGNORE INTO run_links(child_run_id, parent_run_id, variant_type,"
                      " changed_fields) VALUES(?,?,?,?)",
                      (child_run_id, parent_run_id, variant_type, json.dumps(sorted(changed_fields))))

    def _links(self, where: str, run_id: str) -> list[dict]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT l.child_run_id, l.parent_run_id, l.variant_type, l.changed_fields,"
                " r.status, r.request_json, r.created_utc FROM run_links l JOIN runs r ON r.run_id ="
                f" l.{'child_run_id' if where == 'parent_run_id' else 'parent_run_id'}"
                f" WHERE l.{where}=? ORDER BY r.created_utc, r.run_id", (run_id,)).fetchall()
        return [{"child_run_id": r["child_run_id"], "parent_run_id": r["parent_run_id"],
                 "variant_type": r["variant_type"], "changed_fields": json.loads(r["changed_fields"]),
                 "status": r["status"], "created_utc": r["created_utc"],
                 "start_utc": json.loads(r["request_json"])["mission"]["start_utc"]} for r in rows]

    def children(self, parent_run_id: str) -> list[dict]:
        """Variants of a run, with the child's status and start time."""
        return self._links("parent_run_id", parent_run_id)

    def parents(self, child_run_id: str) -> list[dict]:
        """Runs this one is a variant of (status and start time are the parent's)."""
        return self._links("child_run_id", child_run_id)

    # ------------------------------------------------------------------ alternatives searches
    def create_search(self, *, search_id: str, parent_run_id: str, objective: str, offsets_s: list[int]) -> bool:
        """Record a search and every date it will test. Idempotent: the id is derived from the parent
        and the dates, so the same search submitted twice is one search. Returns True if created."""
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            cur = c.execute("INSERT OR IGNORE INTO searches(search_id, parent_run_id, objective, created_utc)"
                            " VALUES(?,?,?,?)", (search_id, parent_run_id, objective, now()))
            created = cur.rowcount == 1
            if created:
                c.executemany("INSERT INTO search_items(search_id, offset_s) VALUES(?,?)",
                              [(search_id, o) for o in offsets_s])
            c.execute("COMMIT")
        return created

    def get_search(self, search_id: str) -> dict | None:
        with self._conn() as c:
            row = c.execute("SELECT * FROM searches WHERE search_id=?", (search_id,)).fetchone()
            if row is None:
                return None
            items = c.execute(
                "SELECT i.offset_s, i.run_id, r.status, r.error_code, r.error_detail FROM search_items i"
                " LEFT JOIN runs r ON r.run_id = i.run_id WHERE i.search_id=? ORDER BY i.offset_s",
                (search_id,)).fetchall()
        return {**dict(row), "items": [dict(i) for i in items]}

    def searches_of(self, parent_run_id: str) -> list[str]:
        with self._conn() as c:
            return [r["search_id"] for r in c.execute(
                "SELECT search_id FROM searches WHERE parent_run_id=? ORDER BY created_utc, search_id",
                (parent_run_id,))]

    def unfinished_searches(self) -> list[str]:
        """Searches with at least one date not yet admitted as a run."""
        with self._conn() as c:
            return [r["search_id"] for r in c.execute(
                "SELECT DISTINCT i.search_id FROM search_items i JOIN searches s USING(search_id)"
                " WHERE i.run_id IS NULL AND i.offset_s != 0 ORDER BY s.created_utc")]

    def assign_search_item(self, search_id: str, offset_s: int, run_id: str) -> None:
        with self._conn() as c:
            c.execute("UPDATE search_items SET run_id=? WHERE search_id=? AND offset_s=? AND run_id IS NULL",
                      (run_id, search_id, offset_s))

    # ------------------------------------------------------------------ attempts
    def claim(self, run_id: str) -> tuple[int, Path] | None:
        """queued -> running with a NEW attempt number, or None if it is no longer queued."""
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            cur = c.execute(
                "UPDATE runs SET status='running', current_attempt=current_attempt+1, stage='starting',"
                " progress=0.0 WHERE run_id=? AND status='queued'", (run_id,))
            if cur.rowcount != 1:
                c.execute("ROLLBACK")
                return None
            attempt = c.execute("SELECT current_attempt FROM runs WHERE run_id=?", (run_id,)).fetchone()[0]
            stage_dir = self.staging / run_id / str(attempt)
            c.execute("INSERT INTO attempts(run_id, attempt, started_utc, outcome, staging_dir)"
                      " VALUES(?,?,?, 'running', ?)", (run_id, attempt, now(), str(stage_dir)))
            c.execute("COMMIT")
        shutil.rmtree(stage_dir, ignore_errors=True)
        stage_dir.mkdir(parents=True, exist_ok=True)
        return attempt, stage_dir

    def set_progress(self, run_id: str, attempt: int, stage: str, progress: float) -> None:
        with self._conn() as c:
            c.execute("UPDATE runs SET stage=?, progress=? WHERE run_id=? AND current_attempt=?"
                      " AND status='running'", (stage, progress, run_id, attempt))

    def commit_success(self, run_id: str, attempt: int, *, result_id: str, artifact_sha: str,
                       status: str, result_state: str) -> bool:
        """Publish only if this attempt is still the current running one (stale attempts lose)."""
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            cur = c.execute(
                "UPDATE runs SET status=?, result_id=?, analysis_artifact=?, result_state=?,"
                " stage='done', progress=1.0, finished_utc=? WHERE run_id=? AND current_attempt=?"
                " AND status='running'", (status, result_id, artifact_sha, result_state, now(),
                                           run_id, attempt))
            ok = cur.rowcount == 1
            if ok:
                c.execute("UPDATE attempts SET outcome='committed', ended_utc=? WHERE run_id=? AND attempt=?",
                          (now(), run_id, attempt))
            c.execute("COMMIT" if ok else "ROLLBACK")
        return ok

    def commit_failure(self, run_id: str, attempt: int, *, code: str, detail: str,
                       outcome: str = "failed", retry: bool = False) -> str | None:
        """Record a failed attempt. If retry and attempts remain the run goes back to the queue.
        Returns the new status, or None if the attempt was stale."""
        with self._conn() as c:
            c.execute("BEGIN IMMEDIATE")
            row = c.execute("SELECT current_attempt, status FROM runs WHERE run_id=?", (run_id,)).fetchone()
            if row is None or row["current_attempt"] != attempt or row["status"] != "running":
                c.execute("ROLLBACK")
                return None
            c.execute("UPDATE attempts SET outcome=?, ended_utc=? WHERE run_id=? AND attempt=?",
                      (outcome, now(), run_id, attempt))
            if retry and attempt < MAX_ATTEMPTS:
                new = "queued"
                c.execute("UPDATE runs SET status='queued', stage=NULL, progress=0.0 WHERE run_id=?", (run_id,))
            else:
                new = "failed"
                code = "ATTEMPT_LIMIT" if retry else code
                c.execute("UPDATE runs SET status='failed', error_code=?, error_detail=?, finished_utc=?"
                          " WHERE run_id=?", (code, detail[:2000], now(), run_id))
            c.execute("COMMIT")
        shutil.rmtree(self.staging / run_id / str(attempt), ignore_errors=True)
        return new

    def reconcile(self) -> dict:
        """Startup: anything still 'running' belonged to a dead process. Retry or fail it, and
        remove staging for every attempt that did not commit."""
        out = {"requeued": 0, "failed": 0}
        with self._conn() as c:
            stale = [dict(r) for r in c.execute("SELECT run_id, current_attempt FROM runs WHERE status='running'")]
        for r in stale:
            new = self.commit_failure(r["run_id"], r["current_attempt"], code="INTERRUPTED",
                                      detail="service restarted while running", outcome="killed", retry=True)
            if new == "queued":
                out["requeued"] += 1
            elif new == "failed":
                out["failed"] += 1
        with self._conn() as c:
            keep = {(r["run_id"], str(r["attempt"])) for r in c.execute(
                "SELECT run_id, attempt FROM attempts WHERE outcome='running'")}
        for run_dir in self.staging.iterdir() if self.staging.exists() else []:
            for att in run_dir.iterdir() if run_dir.is_dir() else []:
                if (run_dir.name, att.name) not in keep:
                    shutil.rmtree(att, ignore_errors=True)
            if run_dir.is_dir() and not any(run_dir.iterdir()):
                run_dir.rmdir()
        return out

    # ------------------------------------------------------------------ artifacts
    def put_artifact(self, data: bytes) -> str:
        sha = hashlib.sha256(data).hexdigest()
        path = self._artifact_path(sha)
        if path.exists():
            return sha
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
        finally:
            with contextlib.suppress(FileNotFoundError):
                os.remove(tmp)
        return sha

    def _artifact_path(self, sha: str) -> Path:
        return self.artifacts / sha[:2] / f"{sha}.json"

    def get_artifact(self, sha: str) -> bytes:
        p = self._artifact_path(sha)
        if not p.exists():
            raise LunaScopeError(RESOURCE_INTEGRITY_FAILED, f"artifact {sha[:12]} is missing")
        data = p.read_bytes()
        if hashlib.sha256(data).hexdigest() != sha:
            raise LunaScopeError(RESOURCE_INTEGRITY_FAILED, f"artifact {sha[:12]} fails its checksum")
        return data

    def get_analysis(self, run_id: str) -> dict:
        """The finished analysis. Artifacts are write-once and content-addressed, so a parsed copy
        is kept per artifact SHA-256 after one verified read (phase plan 2.3). Callers must treat
        the returned dict as read-only: it is shared."""
        row = self.require(run_id)
        sha = row["analysis_artifact"]
        if sha is None:
            raise LunaScopeError("NOT_READY", f"run {run_id[:16]}... is {row['status']}")
        with self._cache_lock:
            hit = self._analysis_cache.pop(sha, None)
            if hit is not None:
                self._analysis_cache[sha] = hit  # most recently used last
                return hit
        parsed = json.loads(self.get_artifact(sha))
        with self._cache_lock:
            self._analysis_cache[sha] = parsed
            while len(self._analysis_cache) > ANALYSIS_CACHE_SIZE:
                self._analysis_cache.pop(next(iter(self._analysis_cache)))
        return parsed

    def cached_artifacts(self) -> list[str]:
        with self._cache_lock:
            return list(self._analysis_cache)
