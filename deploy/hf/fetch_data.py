"""Download the raw terrain and kernel files from the private Hugging Face dataset into data/raw (skips files already there)."""
import os
from pathlib import Path

from huggingface_hub import snapshot_download

REPO = os.environ.get("LUNASCOPE_DATA_REPO", "")
RAW = Path("/home/user/app/data/raw")

if not REPO:
    raise SystemExit("LUNASCOPE_DATA_REPO is not set (for example your-name/lunascope-data)")
RAW.mkdir(parents=True, exist_ok=True)
snapshot_download(repo_id=REPO, repo_type="dataset", local_dir=str(RAW), token=os.environ.get("HF_TOKEN"))
print("data ready:", sorted(p.name for p in RAW.iterdir()))
