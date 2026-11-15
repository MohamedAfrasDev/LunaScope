"""Start the three reference runs once the service is up, so they are computed before anyone asks. Failures only print."""
import json
import os
import time
import urllib.request

BASE = f"http://127.0.0.1:{os.environ.get('PORT', '7860')}/api/v1"
HEAD = {"content-type": "application/json"}
if os.environ.get("LUNASCOPE_API_TOKEN"):
    HEAD["authorization"] = f"Bearer {os.environ['LUNASCOPE_API_TOKEN']}"


def call(path, data=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode() if data is not None else None, headers=HEAD)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


for ref in ("GR-001", "GR-002", "GR-003"):
    for attempt in range(6):
        try:
            run = call("/analyses", call(f"/references/{ref}")["request"])
            print("warm", ref, run.get("run_id"), run.get("status"), flush=True)
            break
        except Exception as e:  # the service may still be starting
            print("warm retry", ref, e, flush=True)
            time.sleep(15)
