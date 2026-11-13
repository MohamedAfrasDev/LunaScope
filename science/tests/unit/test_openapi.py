import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_committed_openapi_document_is_current():
    r = subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "export_openapi.py"), "--check"],
                       capture_output=True, text=True, cwd=ROOT, check=False)
    assert r.returncode == 0, r.stdout + r.stderr
