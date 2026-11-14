# LunaScope science service. Build from the repository root:
#   docker build -f deploy/service.Dockerfile -t lunascope-service .
# The code locates data/ relative to the package (REPO = two levels above lunascope/), so the image
# keeps the repository layout: /app/science and /app/data. DEM and SPICE files are NOT in the image
# (gigabytes): mount them at /app/data/raw for a live stack; replay mode needs neither.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    LUNASCOPE_DATA_DIR=/data LUNASCOPE_LOG=json

WORKDIR /app
COPY science/pyproject.toml science/pyproject.toml
# dependencies first, so code changes do not reinstall them
RUN python - <<'PY' > /tmp/requirements.txt
import tomllib
print("\n".join(tomllib.load(open("science/pyproject.toml", "rb"))["project"]["dependencies"]))
PY
RUN pip install -r /tmp/requirements.txt

COPY science/lunascope science/lunascope
COPY data data
ENV PYTHONPATH=/app/science

RUN useradd --system --uid 10001 lunascope && mkdir /data && chown lunascope /data
USER lunascope
VOLUME /data
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=2).status == 200 else 1)"

CMD ["python", "-m", "uvicorn", "lunascope.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
