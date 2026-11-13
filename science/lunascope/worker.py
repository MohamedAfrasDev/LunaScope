"""Child-process entry point for one analysis attempt.

The supervisor (jobs.py) starts this in a separate process so a timeout can terminate it for real
(a running thread or future cannot be cancelled). It reads job.json from the staging directory and
writes only inside it: progress.json while running, then result.json (success) or error.json
(handled failure, exit code 3). Anything else is a crash, which the supervisor may retry.
"""

from __future__ import annotations

import json
import sys
import time
import traceback
from pathlib import Path

EXIT_OK, EXIT_HANDLED = 0, 3


def _write(path: Path, obj) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
    tmp.replace(path)


def run_analysis(job: dict, progress) -> dict:
    from .canonical import hash_of, make_result_id
    from .pipeline import run_site, run_with_sensitivity
    from .stacks import ServiceConfig, build_stack, run_config_from_canonical

    svc = job["service"]
    cfg_svc = ServiceConfig(data_dir=Path(svc["data_dir"]), stack_kind=svc["stack_kind"],
                            raw_dir=Path(svc["raw_dir"]),
                            kernel_dir=Path(svc["kernel_dir"]) if svc.get("kernel_dir") else None)
    canon = job["request"]
    cfg, sites = run_config_from_canonical(canon)
    stack, alt = build_stack(cfg_svc, canon["terrain"]["dem_profile"])
    sens = canon["options"]["sensitivity"]
    bundles, t0 = [], time.time()
    for i, site in enumerate(sites):
        progress(f"site {i + 1}/{len(sites)}: {site.site_id}", i / len(sites))
        b = (run_with_sensitivity(site, cfg, stack, alt_terrain_factory=alt) if sens
             else run_site(site, cfg, stack))
        bundles.append(b)
    progress("assembling", 0.97)
    synthetic = any(b["result_state"] == "synthetic_demonstration" for b in bundles)
    warnings = sorted({w for b in bundles for w in b["warnings"]})
    result_id = make_result_id(job["run_id"], {"site_results": [b["result_id"] for b in bundles]},
                               [hash_of({"site": b["request"]["site"]["site_id"], "status": b["site_status"]})
                                for b in bundles])
    return {
        "schema": "lunascope.analysis/1", "run_id": job["run_id"], "result_id": result_id,
        "status": "complete_with_warnings" if warnings else "complete",
        "result_state": "synthetic_demonstration" if synthetic else "real_data_unverified",
        "validated_scopes": [], "verified": False, "algorithm_id": job["algorithm_id"],
        "request": canon, "effective_settings": job["effective_settings"], "resources": job["resources"],
        "coverage_fraction": 1.0, "warnings": warnings, "sites": bundles,
        "timing_s": {"total_s": time.time() - t0}}


def main(stage_dir: str) -> int:
    d = Path(stage_dir)
    try:
        job = json.loads((d / "job.json").read_text(encoding="utf-8"))

        def progress(stage: str, frac: float) -> None:
            _write(d / "progress.json", {"stage": stage, "progress": frac})

        result = run_analysis(job, progress)
        _write(d / "result.json", result)
        return EXIT_OK
    except Exception as e:  # noqa: BLE001 - last line of defence: any failure becomes error.json
        code = getattr(e, "code", "INTERNAL_ERROR")
        _write(d / "error.json", {"code": code, "message": str(getattr(e, "message", e))[:1500],
                                  "retryable": bool(getattr(e, "retryable", False)),
                                  "trace": traceback.format_exc()[-3000:]})
        return EXIT_HANDLED


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
