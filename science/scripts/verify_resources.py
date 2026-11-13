"""Hash every pinned resource file against its manifest (slow: the DEMs are ~4.5 GB).

Usage: python scripts/verify_resources.py   (exit 0 only if every file is present and matches)
"""

from __future__ import annotations

import json
import sys

from lunascope.registry import check_all, summary


def main() -> int:
    statuses = check_all(verify=True)
    for s in statuses:
        for f in s.files:
            print(f"{s.resource_id:28s} {f.name:32s} {f.status} {f.detail}")
    out = summary(statuses)
    print(json.dumps(out))
    return 0 if out["resources_ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
