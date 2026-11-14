# LunaScope science service in REPLAY mode with the packaged real-data runs baked in.
# For a free container host: no DEM, no SPICE kernels and no network are needed, because replay serves
# only the saved runs (GR-001, its five-day shift and the dates search) and refuses everything else
# with REPLAY_ONLY. Build from the repository root:
#   docker build -f deploy/replay.Dockerfile -t lunascope-replay .
#   docker run -e LUNASCOPE_API_TOKEN=... -p 8000:8000 lunascope-replay
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1     LUNASCOPE_STACK=live LUNASCOPE_MODE=replay LUNASCOPE_DATA_DIR=/data LUNASCOPE_LOG=json

WORKDIR /app
COPY science/pyproject.toml science/pyproject.toml
RUN python - <<'PY' > /tmp/requirements.txt
import tomllib
print("
".join(tomllib.load(open("science/pyproject.toml", "rb"))["project"]["dependencies"]))
PY
RUN pip install -r /tmp/requirements.txt

COPY science/lunascope science/lunascope
COPY data data
COPY deploy/replay-package /app/replay-package
COPY deploy/replay-entrypoint.sh /app/replay-entrypoint.sh
ENV PYTHONPATH=/app/science

RUN useradd --system --uid 10001 lunascope && mkdir /data && chown lunascope /data && chmod +x /app/replay-entrypoint.sh
USER lunascope
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3   CMD python -c "import os,urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/api/v1/health' % os.environ.get('PORT','8000'), timeout=2).status == 200 else 1)"

CMD ["/app/replay-entrypoint.sh"]
