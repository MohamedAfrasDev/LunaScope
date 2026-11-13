"""Write the service's OpenAPI document to docs/openapi.json (deterministic: sorted keys).

Usage: python scripts/export_openapi.py [--check]   (--check exits 1 if the committed file is stale)
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from lunascope.dem import REPO
from lunascope.main import create_app
from lunascope.stacks import ServiceConfig

TARGET = REPO / "docs" / "openapi.json"


def render() -> str:
    with tempfile.TemporaryDirectory() as d:
        app = create_app(ServiceConfig(data_dir=Path(d), stack_kind="synthetic", mode="replay"))
        return json.dumps(app.openapi(), indent=1, sort_keys=True) + "\n"


def main() -> int:
    text = render()
    if "--check" in sys.argv:
        ok = TARGET.exists() and TARGET.read_text(encoding="utf-8").replace("\r\n", "\n") == text
        print("openapi.json is current" if ok else "openapi.json is STALE: run scripts/export_openapi.py")
        return 0 if ok else 1
    TARGET.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {TARGET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
