"""Print the repository work log as Markdown, straight from git (so it cannot drift from the history).

Used for the eligibility record (SDR-001 D-12, spec risk #1): what was committed, when, and how
much, so the team lead can compare it with the scope of the organizer's written permission.
Usage:  python scripts/work_log.py > ../docs/permissions/PRE-EVENT-WORK-LOG.md
"""

from __future__ import annotations

import subprocess
from collections import defaultdict
from datetime import UTC, datetime

AREAS = [
    ("specification / documents", ("docs/", "LunaScope Product", "README")),
    ("web application (Next.js)", ("app/", "components/", "lib/", "tests/web", "package", "vitest", "public/")),
    ("science service (Python)", ("science/", "data/")),
]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True, encoding="utf-8").stdout


def area(path: str) -> str:
    for name, prefixes in AREAS:
        if path.startswith(prefixes):
            return name
    return "configuration / other"


def main() -> None:
    raw = git("log", "--reverse", "--numstat", "--format=@@%h|%aI|%an|%s")
    commits, cur = [], None
    for line in raw.splitlines():
        if line.startswith("@@"):
            h, when, who, subject = line[2:].split("|", 3)
            cur = {"hash": h, "when": datetime.fromisoformat(when), "who": who, "subject": subject,
                   "files": 0, "added": defaultdict(int)}
            commits.append(cur)
        elif line.strip() and cur is not None:
            a, _d, path = line.split("\t", 2)
            cur["files"] += 1
            cur["added"][area(path)] += int(a) if a.isdigit() else 0
    print("# Pre-event work log\n")
    print(f"Generated {datetime.now(UTC):%Y-%m-%d %H:%M UTC} from `git log`. Times are the commit author times "
          "with their own UTC offset. Lines are lines added, by area.\n")
    print("| Commit | Time | Author | What | Files | Spec/docs | Web | Science |")
    print("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for c in commits:
        a = c["added"]
        print(f"| `{c['hash']}` | {c['when']:%Y-%m-%d %H:%M %z} | {c['who']} | {c['subject']} | {c['files']} | "
              f"{a['specification / documents']} | {a['web application (Next.js)']} | {a['science service (Python)']} |")
    first, last = commits[0]["when"], commits[-1]["when"]
    print(f"\nFirst commit {first:%Y-%m-%d %H:%M %z}; latest {last:%Y-%m-%d %H:%M %z}; {len(commits)} commits.")


if __name__ == "__main__":
    main()
