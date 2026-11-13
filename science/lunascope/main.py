"""FastAPI entry point. Phase 1 slice: health only; analysis endpoints land with the run store."""

from __future__ import annotations

import os

from fastapi import FastAPI

from . import ALGORITHM_VERSION
from .codes import ResultState

MODE = os.environ.get("LUNASCOPE_MODE", "live")  # live | replay


def create_app() -> FastAPI:
    app = FastAPI(title="LunaScope science service", version=ALGORITHM_VERSION)

    @app.get("/api/v1/health")
    def health() -> dict:
        return {
            "status": "ok",
            "mode": MODE,
            "algorithm_id": f"lunascope-science/{ALGORITHM_VERSION}",
            # No real resources are verified yet; everything computed here is synthetic.
            "result_state": ResultState.SYNTHETIC.value,
            "resources_ok": False,
        }

    return app


app = create_app()
