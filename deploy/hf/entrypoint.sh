#!/bin/sh
# Start the live science service on a Hugging Face Space. The disk is ephemeral, so the DEM and SPICE files are fetched on every
# cold start (a few minutes), then the three reference runs are warmed in the background so the first visitor finds them ready.
set -eu
if [ -z "${LUNASCOPE_API_TOKEN:-}" ]; then
  echo "LUNASCOPE_API_TOKEN is not set; refusing to start (an open service would be free compute for anyone)" >&2
  exit 2
fi
cd /home/user/app
python deploy/hf/fetch_data.py
(sleep 20 && python deploy/hf/warm.py) &
exec python -m uvicorn lunascope.main:create_app --factory --host 0.0.0.0 --port "${PORT:-7860}"
