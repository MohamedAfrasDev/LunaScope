"""Run the alternatives (dates) search on the LIVE stack and record the tested-dates strip.

  LUNASCOPE_CONTACT=<email or url> python scripts/real_search.py [--from-days 1 --to-days 7 --step 1]

It starts the science service in-process on the live stack (real JPL Horizons, cached verbatim; the pinned
LOLA DEMs and SPICE kernels), creates the frozen GR-001 baseline (a cache hit if it already ran), then asks
for one date shift per tested date through the ordinary search endpoint. Nothing is special-cased: each date
is an ordinary immutable run. Writes docs/runs/evidence/GR-001-dates-search.json and prints the strip.
"""

from __future__ import annotations

import argparse
import json
import sys
import time

from fastapi.testclient import TestClient

from lunascope.canonical import canonical_bytes
from lunascope.dem import REPO
from lunascope.main import create_app
from lunascope.reference import definition_request, load_definition
from lunascope.stacks import ServiceConfig

OUT = REPO / "docs" / "runs" / "evidence" / "GR-001-dates-search.json"


def wait(client: TestClient, url: str, done, what: str, timeout: float = 3600) -> dict:
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout:
        body = client.get(url).json()
        state = done(body)
        if state is not None:
            return body
        line = json.dumps(body.get("counts") or body.get("status"))
        if line != last:
            print(f"  {what}: {line}", flush=True)
            last = line
        time.sleep(5)
    raise TimeoutError(what)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-days", type=int, default=1)
    ap.add_argument("--to-days", type=int, default=7)
    ap.add_argument("--step", type=int, default=1)
    a = ap.parse_args()

    cfg = ServiceConfig(data_dir=REPO / "var", stack_kind="live")
    req = definition_request(load_definition("GR-001"))
    with TestClient(create_app(cfg)) as c:
        r = c.post("/api/v1/analyses", content=req.model_dump_json(), headers={"content-type": "application/json"})
        r.raise_for_status()
        run_id = r.json()["run_id"]
        print("baseline", run_id[:12], r.json()["status"], flush=True)
        wait(c, f"/api/v1/analyses/{run_id}",
             lambda b: True if b["status"] in ("complete", "complete_with_warnings", "failed") else None, "baseline")
        v = c.post(f"/api/v1/analyses/{run_id}/variants",
                   json={"variant_type": "alternatives_search",
                         "changes": {"from_days": a.from_days, "to_days": a.to_days, "step_days": a.step}})
        v.raise_for_status()
        url = f"/api/v1/analyses/{run_id}/searches/{v.json()['search_id']}"
        strip = wait(c, url, lambda b: True if all(r_["state"] in ("complete", "complete_with_warnings", "baseline", "failed")
                                                    for r_ in b["dates"]) else None, "search")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(canonical_bytes(strip))
    for row in strip["dates"]:
        cells = ", ".join(f"{s['site_id'].split('-')[-1]}:{s['site_status']}" for s in row["sites"]) or row["state"]
        print(f"{row['start_utc']}  {row['state']:<18} {row['verdict'] or '-':<8} {cells}")
    print("wrote", OUT.relative_to(REPO))
    return 0


if __name__ == "__main__":
    sys.exit(main())
