"""LunaScope science service on a free Gradio-SDK Space (Docker Spaces are paid). It is not a Gradio app: this file clones the code from
GitHub, downloads the DEM and SPICE files in the background from a private dataset, warms the reference runs, and serves the FastAPI
service itself on port 7860, which is all a Space needs."""
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO_URL = os.environ.get("LUNASCOPE_REPO_URL", "https://github.com/MohamedAfrasDev/LunaScope.git")
REPO_REF = os.environ.get("LUNASCOPE_REPO_REF", "main")
HOME = Path.home()
SRC = HOME / "lunascope-src"
PORT = int(os.environ.get("PORT", "7860"))

if not os.environ.get("LUNASCOPE_API_TOKEN"):
    raise SystemExit("LUNASCOPE_API_TOKEN is not set; refusing to start (an open service would be free compute for anyone)")

if not SRC.exists():
    subprocess.run(["git", "clone", "--depth", "1", "--branch", REPO_REF, REPO_URL, str(SRC)], check=True)
RAW = SRC / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

os.environ.setdefault("LUNASCOPE_STACK", "live")
os.environ.setdefault("LUNASCOPE_MODE", "live")
os.environ.setdefault("LUNASCOPE_DATA_DIR", str(HOME / "data"))
os.environ.setdefault("LUNASCOPE_LOG", "json")
sys.path.insert(0, str(SRC / "science"))


def fetch_then_warm() -> None:
    """Download data/raw (minutes), then start the three reference runs. Runs beside the server so the port opens at once."""
    repo = os.environ.get("LUNASCOPE_DATA_REPO", "")
    if not repo:
        print("LUNASCOPE_DATA_REPO is not set: no terrain data, so only saved behaviour will work", flush=True)
        return
    from huggingface_hub import snapshot_download

    snapshot_download(repo_id=repo, repo_type="dataset", local_dir=str(RAW), token=os.environ.get("HF_TOKEN"))
    print("data ready:", sorted(p.name for p in RAW.iterdir()), flush=True)
    import json
    import urllib.request

    time.sleep(10)
    base = f"http://127.0.0.1:{PORT}/api/v1"
    head = {"content-type": "application/json", "authorization": f"Bearer {os.environ['LUNASCOPE_API_TOKEN']}"}

    def call(path, data=None):
        req = urllib.request.Request(base + path, data=json.dumps(data).encode() if data is not None else None, headers=head)
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)

    for ref in ("GR-001", "GR-002", "GR-003"):
        for _ in range(6):
            try:
                run = call("/analyses", call(f"/references/{ref}")["request"])
                print("warm", ref, run.get("run_id"), run.get("status"), flush=True)
                break
            except Exception as e:  # noqa: BLE001
                print("warm retry", ref, e, flush=True)
                time.sleep(15)


threading.Thread(target=fetch_then_warm, daemon=True).start()

import uvicorn  # noqa: E402
from lunascope.main import create_app  # noqa: E402

uvicorn.run(create_app(), host="0.0.0.0", port=PORT)
