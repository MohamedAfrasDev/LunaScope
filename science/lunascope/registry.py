"""Resource registry (spec 8.x, phase plan 1.3): every numerical resource is listed in a manifest
and checked at startup. No resource is used without a manifest entry.

Startup checks are cheap (file present, size matches). A full SHA-256 is optional because the DEMs
are gigabytes; the run path verifies pins by hash digest and `verify=True` hashes everything.
A passing check means the bytes match a pin. It does not mean the resource is scientifically approved.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .dem import MANIFESTS, RAW, sha256_file
from .errors import RESOURCE_INTEGRITY_FAILED, LunaScopeError

OK, MISSING, SIZE_MISMATCH, HASH_MISMATCH, REMOTE = (
    "ok", "missing", "size_mismatch", "hash_mismatch", "remote_service")


@dataclass
class FileCheck:
    name: str
    status: str
    detail: str = ""


@dataclass
class ResourceStatus:
    resource_id: str
    role: str
    readiness: str
    files: list[FileCheck] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return all(f.status in (OK, REMOTE) for f in self.files)

    def to_dict(self) -> dict:
        return {"resource_id": self.resource_id, "role": self.role, "readiness": self.readiness,
                "ok": self.ok, "files": [vars(f) for f in self.files]}


def _expected_files(m: dict, raw_dir: Path) -> list[tuple[str, Path, int | None, str | None]]:
    """(name, path, size, sha256) per file a manifest pins. A service manifest pins none."""
    if m.get("kind") == "remote_service":
        return []
    if "kernels" in m:
        return [(k["filename"], raw_dir / "spice" / k["filename"], k.get("size_bytes"), k.get("sha256"))
                for k in m["kernels"]]
    out = [(m["filename"], raw_dir / m["filename"], m.get("size_bytes"), m.get("sha256"))]
    label = (m.get("integrity") or {}).get("label_file")
    if label:
        out.append((label["filename"], raw_dir / label["filename"], label.get("size_bytes"),
                    label.get("sha256")))
    return out


def check_resource(m: dict, raw_dir: Path = RAW, *, verify: bool = False) -> ResourceStatus:
    st = ResourceStatus(m.get("resource_id", "?"), m.get("role", "?"), m.get("readiness", "?"))
    if m.get("kind") == "remote_service":
        st.files.append(FileCheck(m.get("product_id", st.resource_id), REMOTE,
                                  "not checked here: responses are cached and hash-checked per request"))
    for name, path, size, sha in _expected_files(m, raw_dir):
        if not path.is_file():
            st.files.append(FileCheck(name, MISSING, str(path)))
        elif size is not None and path.stat().st_size != size:
            st.files.append(FileCheck(name, SIZE_MISMATCH, f"{path.stat().st_size} != {size}"))
        elif verify and sha and sha256_file(path) != sha:
            st.files.append(FileCheck(name, HASH_MISMATCH, "SHA-256 differs from the pin"))
        else:
            st.files.append(FileCheck(name, OK))
    return st


def load_manifests(manifest_dir: Path = MANIFESTS) -> list[dict]:
    out = []
    for p in sorted(manifest_dir.glob("*.json")):
        m = json.loads(p.read_text(encoding="utf-8"))
        if not m.get("resource_id"):
            raise LunaScopeError(RESOURCE_INTEGRITY_FAILED, f"manifest {p.name} has no resource_id")
        out.append(m)
    return out


def check_all(raw_dir: Path = RAW, manifest_dir: Path = MANIFESTS, *, verify: bool = False) -> list[ResourceStatus]:
    return [check_resource(m, raw_dir, verify=verify) for m in load_manifests(manifest_dir)]


def summary(statuses: list[ResourceStatus]) -> dict:
    bad = [s.resource_id for s in statuses if not s.ok]
    return {"resources_ok": not bad, "checked": len(statuses), "failing": bad}
