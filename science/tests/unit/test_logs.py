import json
import logging

from lunascope.logs import LOGGER, JsonFormatter, log_event


def test_one_json_line_with_only_allowed_fields(caplog):
    h = logging.Handler()
    lines = []
    h.emit = lambda rec: lines.append(JsonFormatter().format(rec)) 
    LOGGER.addHandler(h)
    LOGGER.setLevel(logging.INFO)
    try:
        log_event("run_finished", run_id="r" * 64, status="complete", warnings=["UNVERIFIED"],
                  lat_deg=-89.5, api_token="secret")
    finally:
        LOGGER.removeHandler(h)
    rec = json.loads(lines[0])
    assert rec["event"] == "run_finished" and rec["warnings"] == ["UNVERIFIED"]
    assert "lat_deg" not in rec and "api_token" not in rec  # coordinates and secrets never logged
