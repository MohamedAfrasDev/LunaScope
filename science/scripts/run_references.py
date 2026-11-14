"""Run reference definitions (for example GR-002 and GR-003) on the LIVE stack through the ordinary service path.

  LUNASCOPE_CONTACT=<email or url> python scripts/run_references.py GR-002 GR-003

Persists the runs, skylines and Horizons responses under var/, so a later `build_fallback.py build --seed-from ../var`
packages them without asking JPL again. One run at a time (each loads an 894 MB DEM window).
"""

from __future__ import annotations

import sys
import time

from fastapi.testclient import TestClient

from lunascope.dem import REPO
from lunascope.main import create_app
from lunascope.reference import definition_request, load_definition
from lunascope.stacks import ServiceConfig


def main(ids: list[str]) -> int:
    cfg = ServiceConfig(data_dir=REPO / "var", stack_kind="live", max_running=1)
    with TestClient(create_app(cfg)) as c:
        for rid in ids:
            req = definition_request(load_definition(rid))
            r = c.post("/api/v1/analyses", content=req.model_dump_json(), headers={"content-type": "application/json"})
            r.raise_for_status()
            run_id = r.json()["run_id"]
            print(rid, run_id[:12], r.json()["status"], flush=True)
            t0, last = time.time(), None
            while True:
                b = c.get(f"/api/v1/analyses/{run_id}").json()
                if b["status"] != last:
                    print(f"  {rid}: {b['status']} ({time.time() - t0:.0f} s)", flush=True)
                    last = b["status"]
                if b["status"] in ("complete", "complete_with_warnings", "failed"):
                    break
                time.sleep(5)
            if b["status"] == "failed":
                print("  FAILED:", b.get("error"), flush=True)
                return 1
            res = c.get(f"/api/v1/analyses/{run_id}/results").json()
            for s in res["sites"]:
                print("  ", s["request"]["site"]["site_id"], s["site_status"], flush=True) if "request" in s else None
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["GR-002", "GR-003"]))
