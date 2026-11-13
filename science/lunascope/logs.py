"""Structured JSON logging: one line per event with run ID, stage, timing and warning codes.

Logs never carry request bodies, site coordinates or tokens: only identifiers, codes and numbers.
Enable with LUNASCOPE_LOG=json (stderr). Without it the logger has no handler and stays silent.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time

LOGGER = logging.getLogger("lunascope")
_ALLOWED = ("run_id", "attempt", "stage", "code", "duration_s", "status", "result_state", "warnings",
            "timing_s", "outcome", "exit_code", "queue", "cid")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        out = {"ts": round(record.created, 3), "level": record.levelname.lower(),
               "event": record.getMessage()}
        out.update({k: v for k, v in getattr(record, "fields", {}).items() if k in _ALLOWED})
        return json.dumps(out, separators=(",", ":"), default=str)


def configure_logging() -> None:
    if os.environ.get("LUNASCOPE_LOG", "").lower() != "json" or LOGGER.handlers:
        return
    h = logging.StreamHandler(sys.stderr)
    h.setFormatter(JsonFormatter())
    LOGGER.addHandler(h)
    LOGGER.setLevel(logging.INFO)
    LOGGER.propagate = False


def log_event(event: str, *, level: int = logging.INFO, **fields) -> None:
    LOGGER.log(level, event, extra={"fields": fields})


def now() -> float:
    return time.time()
