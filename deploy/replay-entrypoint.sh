#!/bin/sh
# Start the science service in REPLAY mode on a writable copy of the packaged real-data runs.
# The container disk is ephemeral on free hosts, so the store is copied in on every start; replay never
# computes, so nothing is lost. A missing token is refused: an open service would serve the demo to anyone.
set -eu
if [ -z "${LUNASCOPE_API_TOKEN:-}" ]; then
  echo "LUNASCOPE_API_TOKEN is not set; refusing to start" >&2
  exit 2
fi
mkdir -p "$LUNASCOPE_DATA_DIR"
rm -rf "$LUNASCOPE_DATA_DIR/store"
cp -r /app/replay-package/data/store "$LUNASCOPE_DATA_DIR/store"
exec python -m uvicorn lunascope.main:create_app --factory --host 0.0.0.0 --port "${PORT:-8000}"
