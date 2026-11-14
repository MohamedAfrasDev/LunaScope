"""Build and check the offline fallback package (phase plan 3.2, spec 15.3, test case 16).

  python scripts/build_fallback.py build [--stack synthetic|live] [--out ../fallback] [--shift-days 5] [--timeout 3600]
  python scripts/build_fallback.py check <fallback-dir> [--stack synthetic|live]

`build` runs GR-001 (exactly what Home submits) and its date-shift variant through the real service
code in this process, then copies the store into <out>/data and writes a manifest of what it holds.
A live build needs network, the DEMs and the SPICE kernels; a synthetic build needs nothing and every
result in it is labelled as demonstration data. The package is only as real as the stack that built it.

`check` is the rehearsal: it opens the package in REPLAY mode with the network switched off at the
socket level, and confirms every packaged run is served, its artifact hash matches the manifest, and
nothing outside the package is asked for.
"""

from __future__ import annotations

import argparse
import json
import shutil
import socket
import sqlite3
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient

from lunascope import ALGORITHM_VERSION
from lunascope.canonical import sha256_hex
from lunascope.dem import REPO
from lunascope.main import create_app
from lunascope.reference import load_definition
from lunascope.stacks import ServiceConfig

DONE = ("complete", "complete_with_warnings")
START_PACKAGE = """# Offline fallback: start LunaScope with no network

This folder holds saved runs only. The service runs in REPLAY mode: it serves what is packaged and
refuses everything else (`REPLAY_ONLY`). The web app shows a "Replay mode" label on every page.

Built: {built} UTC by commit `{commit}`{dirty}, algorithm {algorithm}, stack **{stack}**.
{label}

## Start (two commands, from the repository root)

```bash
# 1. the service, replay mode, reading this package
LUNASCOPE_STACK={stack} LUNASCOPE_MODE=replay LUNASCOPE_DATA_DIR=fallback/data \\
  science/.venv/bin/python -m uvicorn lunascope.main:create_app --factory --port 8000   # Windows: science\\.venv\\Scripts\\python.exe
# 2. the web app (build once with `npm run build`)
npm run start -- --port 3000
```

Or with containers: `LUNASCOPE_MODE=replay LUNASCOPE_STACK={stack} LUNASCOPE_API_TOKEN=local docker compose -f deploy/compose.yml up`
after copying `fallback/data` into the `lunascope-data` volume.

Open http://localhost:3000 and press **Start the reference mission**: it opens the packaged GR-001 run.
Packaged runs: see FALLBACK-MANIFEST.json. Check the package: `python science/scripts/build_fallback.py check fallback`.
"""


def git(*a: str) -> str:
    return subprocess.run(["git", *a], cwd=REPO, capture_output=True, text=True, check=False).stdout.strip()


def wait_done(c: TestClient, run_id: str, timeout: float) -> dict:
    t0 = time.time()
    while True:
        r = c.get(f"/api/v1/analyses/{run_id}").json()
        if r["status"] in DONE:
            return r
        if r["status"] == "failed":
            raise SystemExit(f"run {run_id[:12]} failed: {r.get('error')}")
        if time.time() - t0 > timeout:
            raise SystemExit(f"run {run_id[:12]} still {r['status']} after {timeout:.0f} s")
        time.sleep(1.0)


def build(stack: str, out: Path, shift_days: int, timeout: float) -> int:
    out = out.resolve()
    if out.exists():
        shutil.rmtree(out)
    data = out / "data"
    work = out / "_work"
    cfg = ServiceConfig(data_dir=work, stack_kind=stack)
    defn = load_definition("GR-001")
    runs: list[dict] = []
    with TestClient(create_app(cfg)) as c:
        base = c.post("/api/v1/analyses", content=json.dumps(defn["request"]))
        if base.status_code not in (200, 202):
            raise SystemExit(f"GR-001 was refused: {base.status_code} {base.text[:300]}")
        base_id = base.json()["run_id"]
        wait_done(c, base_id, timeout)
        runs.append({"name": "GR-001", "run_id": base_id, "kind": "reference"})
        if shift_days:
            v = c.post(f"/api/v1/analyses/{base_id}/variants", content=json.dumps(
                {"variant_type": "date_shift", "changes": {"start_offset_s": shift_days * 86400}}))
            if v.status_code not in (200, 202):
                raise SystemExit(f"the date shift was refused: {v.status_code} {v.text[:300]}")
            wait_done(c, v.json()["run_id"], timeout)
            runs.append({"name": f"GR-001 {shift_days:+d} d", "run_id": v.json()["run_id"],
                         "kind": "date_shift", "parent_run_id": base_id})
        store = c.app.state.store
        entries = []
        for r in runs:
            row = store.get(r["run_id"])
            entries.append({**r, "result_id": row["result_id"], "result_state": row["result_state"],
                            "status": row["status"], "analysis_artifact_sha256": row["analysis_artifact"]})
    # checkpoint the WAL so the copied database file is complete on its own
    db = work / "store" / "runs.sqlite"
    con = sqlite3.connect(db)
    con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.close()
    (data / "store").mkdir(parents=True)
    shutil.copy2(db, data / "store" / "runs.sqlite")
    shutil.copytree(work / "store" / "artifacts", data / "store" / "artifacts")
    if (work / "horizons_cache").exists():  # raw provider responses, kept for provenance
        shutil.copytree(work / "horizons_cache", data / "horizons_cache")
    shutil.rmtree(work)

    states = {e["result_state"] for e in entries}
    synthetic = "synthetic_demonstration" in states
    manifest = {
        "schema": "lunascope.fallback/1", "built_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stack": stack, "algorithm_version": ALGORITHM_VERSION, "commit": git("rev-parse", "HEAD"),
        "dirty": bool(git("status", "--porcelain")), "result_states": sorted(states),
        "reference_definition_sha256": sha256_hex((REPO / "data" / "reference" / "GR-001.json").read_bytes()),
        "reference_status": defn["status"], "runs": entries}
    (out / "FALLBACK-MANIFEST.json").write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n",
                                                encoding="utf-8")
    label = ("**This package holds SYNTHETIC DEMONSTRATION data, not lunar results.** Build it with "
             "`--stack live` for real data." if synthetic else
             "Real data, unverified: no validation gate has closed. GR-001 is a "
             f"{defn['status']}: its sites are demonstration points until verified sites are chosen.")
    (out / "README.md").write_text(START_PACKAGE.format(
        built=manifest["built_utc"], commit=manifest["commit"][:12], dirty=" (uncommitted changes)" if manifest["dirty"] else "",
        algorithm=ALGORITHM_VERSION, stack=stack, label=label), encoding="utf-8")
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"built {out} ({size / 1e6:.1f} MB), {len(entries)} run(s), stack {stack}")
    return 0


LOOPBACK = {None, "", "localhost", "127.0.0.1", "::1", "0.0.0.0"}


class _NoNetwork:
    """Make any attempt to leave the machine fail loudly while the package is being rehearsed.
    Loopback stays open: the event loop and the test client talk to themselves through it."""

    def __enter__(self):
        self._orig = (socket.socket.connect, socket.create_connection, socket.getaddrinfo)
        connect, create, resolve = self._orig
        calls = self.calls = []

        def local(host) -> bool:
            return host in LOOPBACK

        def refuse(what: str):
            calls.append(what)
            raise OSError("network is switched off for the fallback rehearsal")

        def guarded_connect(sock, address, *a, **k):
            host = address[0] if isinstance(address, tuple) else address
            return connect(sock, address, *a, **k) if local(host) else refuse(f"connect {address}")

        def guarded_create(address, *a, **k):
            return create(address, *a, **k) if local(address[0]) else refuse(f"connect {address}")

        def guarded_resolve(host, *a, **k):
            return resolve(host, *a, **k) if local(host) else refuse(f"resolve {host}")

        socket.socket.connect = guarded_connect
        socket.create_connection = guarded_create
        socket.getaddrinfo = guarded_resolve
        return self

    def __exit__(self, *exc):
        socket.socket.connect, socket.create_connection, socket.getaddrinfo = self._orig


def check(package: Path, stack: str | None) -> int:
    package = package.resolve()
    manifest = json.loads((package / "FALLBACK-MANIFEST.json").read_text(encoding="utf-8"))
    stack = stack or manifest["stack"]
    failures: list[str] = []

    def need(ok: bool, msg: str) -> None:
        print(("PASS " if ok else "FAIL ") + msg)
        if not ok:
            failures.append(msg)

    work = package.parent / "_check_data"
    if work.exists():
        shutil.rmtree(work)
    shutil.copytree(package / "data", work)  # the service writes SQLite files; never touch the package
    try:
        with _NoNetwork() as net:
            cfg = ServiceConfig(data_dir=work, stack_kind=stack, mode="replay")
            with TestClient(create_app(cfg)) as c:
                h = c.get("/api/v1/health").json()
                need(h["mode"] == "replay" and h["stack"] == stack, f"service is in replay mode on the {stack} stack")
                for e in manifest["runs"]:
                    rid, name = e["run_id"], e["name"]
                    row = c.app.state.store.get(rid)
                    need(row is not None and row["analysis_artifact"] == e["analysis_artifact_sha256"],
                         f"{name}: stored artifact is the one in the manifest")
                    if row is None:
                        continue
                    sha = sha256_hex(c.app.state.store.get_artifact(row["analysis_artifact"]))
                    need(sha == e["analysis_artifact_sha256"], f"{name}: artifact bytes match their SHA-256")
                    for path in ("results", "provenance", "validation", "export"):
                        r = c.get(f"/api/v1/analyses/{rid}/{path}")
                        need(r.status_code == 200, f"{name}: GET {path} is served")
                    if e["kind"] == "reference":
                        again = c.post("/api/v1/analyses", content=json.dumps(load_definition("GR-001")["request"]))
                        need(again.status_code == 200 and again.json()["run_id"] == rid,
                             f"{name}: the Home button's request resolves to the packaged run")
                    if e["kind"] == "date_shift":
                        v = c.post(f"/api/v1/analyses/{e['parent_run_id']}/variants", content=json.dumps(
                            {"variant_type": "date_shift", "changes": {"start_offset_s": 5 * 86400}}))
                        need(v.status_code == 200 and v.json()["run_id"] == rid, f"{name}: the Time Machine shift is served")
                other = c.post(f"/api/v1/analyses/{manifest['runs'][0]['run_id']}/variants", content=json.dumps(
                    {"variant_type": "date_shift", "changes": {"start_offset_s": 3 * 86400}}))
                need(other.status_code == 409 and other.json()["error"]["code"] == "REPLAY_ONLY",
                     "an unpackaged shift is refused as REPLAY_ONLY, not computed")
            need(not net.calls, f"no network access was attempted ({len(net.calls)} attempts: {net.calls[:3]})")
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print(f"\n{'READY' if not failures else 'NOT READY'}: {len(failures)} failure(s)")
    return 1 if failures else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--stack", choices=("synthetic", "live"), default="synthetic")
    b.add_argument("--out", default=str(REPO / "fallback"))
    b.add_argument("--shift-days", type=int, default=5)
    b.add_argument("--timeout", type=float, default=3600.0)
    c = sub.add_parser("check")
    c.add_argument("package")
    c.add_argument("--stack", choices=("synthetic", "live"), default=None)
    a = ap.parse_args()
    return build(a.stack, Path(a.out), a.shift_days, a.timeout) if a.cmd == "build" else check(Path(a.package), a.stack)


if __name__ == "__main__":
    sys.exit(main())
