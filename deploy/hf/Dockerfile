# LunaScope science service in LIVE mode on a free Hugging Face Space (CPU basic: 2 vCPU, 16 GB RAM, ephemeral disk).
# The Space repository holds only this file and README.md (see docs/redesign/DEPLOY-HF-SPACE.md). The code is cloned from GitHub at
# build time; the DEM and SPICE files (about 4.4 GB, not in git) are downloaded from a private Hugging Face dataset at first start.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 user
USER user

ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    LUNASCOPE_STACK=live LUNASCOPE_MODE=live LUNASCOPE_DATA_DIR=/home/user/data LUNASCOPE_LOG=json \
    PYTHONPATH=/home/user/app/science PORT=7860
WORKDIR /home/user

# a changed branch head busts the cache, so a rebuild picks up new commits
ARG REPO_URL=https://github.com/MohamedAfrasDev/LunaScope.git
ARG REPO_REF=main
ADD https://api.github.com/repos/MohamedAfrasDev/LunaScope/git/refs/heads/main /tmp/ref.json
RUN git clone --depth 1 --branch ${REPO_REF} ${REPO_URL} app

RUN python - <<'PY' > /tmp/requirements.txt
import tomllib
print("\n".join(tomllib.load(open("app/science/pyproject.toml", "rb"))["project"]["dependencies"]))
PY
RUN pip install -r /tmp/requirements.txt huggingface_hub

RUN mkdir -p /home/user/data /home/user/app/data/raw
EXPOSE 7860
CMD ["sh", "/home/user/app/deploy/hf/entrypoint.sh"]
