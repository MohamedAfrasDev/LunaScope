"""Upload data/raw (the DEM and SPICE files, about 4.4 GB) to a PRIVATE Hugging Face dataset. Run on the machine that has them.

    pip install huggingface_hub
    PowerShell:  $env:HF_TOKEN = "hf_xxx"   (a token with write access; never commit it)
    cmd.exe:     set HF_TOKEN=hf_xxx
    python deploy/hf/upload_data.py your-name/lunascope-data
"""
import os
import sys
from pathlib import Path

from huggingface_hub import HfApi

repo = sys.argv[1]
raw = Path(__file__).resolve().parents[2] / "data" / "raw"
api = HfApi(token=os.environ["HF_TOKEN"])
api.create_repo(repo, repo_type="dataset", private=True, exist_ok=True)
patterns = ["LDEM_80S_20M.IMG", "LDEM_80S_20M.IMG.done", "LDEM_80S_20M.LBL", "LDEM_80S_20MPP_ADJ.TIF", "LDEM_80S_20MPP_ADJ.TIF.done", "spice/*", "iau/**", "illumination/**"]
# upload_large_folder resumes and retries; older huggingface_hub versions only have upload_folder
upload = getattr(api, "upload_large_folder", None)
if upload:
    upload(repo_id=repo, repo_type="dataset", folder_path=str(raw), allow_patterns=patterns)
else:
    api.upload_folder(repo_id=repo, repo_type="dataset", folder_path=str(raw), allow_patterns=patterns)
print("uploaded to", repo)
