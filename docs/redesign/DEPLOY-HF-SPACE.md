# Live science service on a free Hugging Face Space (so Compute works on the hosted site)

Goal: the hosted Atlas (Vercel) can compute new analyses, "Compute sky for this site" and "Place a point" with the real DEM, not just show
saved runs. Target: working within 3 hours. Nothing here changes the science, the labels or the product rules.

## 1. Why this, and what it replaces

- The Render service is the **replay** copy: no DEM, no SPICE kernels, saved runs only. That is why Compute says "offline copy".
- The live stack needs about 4.4 GB of files (`data/raw`: the two LOLA DEMs, the SPICE kernels, IAU and illumination files), 16 GB of RAM
  headroom for DEM reads, and a few minutes of CPU per run. A free Hugging Face Space (Docker, CPU basic: 2 vCPU, 16 GB RAM, about 50 GB
  ephemeral disk) holds all of that for free.
- R2 alone would not help: it stores files but cannot run the Python.

```
Browser -> Vercel (Next.js, /api/v1 proxy) -> Hugging Face Space (FastAPI, live)  -> JPL Horizons (internet, Sun/Earth geometry)
                                                    ^ on every cold start, downloads data/raw from a private HF dataset
cron-job.org pings /api/v1/health every 5 min so the Space does not sleep
```

Files added to the repository: `deploy/hf/Dockerfile`, `README.md` (the Space card), `entrypoint.sh`, `fetch_data.py`, `warm.py`, `upload_data.py`.

## 2. What you need (accounts and secrets, yours to create)

1. A Hugging Face account (free).
2. Two tokens from huggingface.co/settings/tokens: a **write** token (to upload the data, used once on your PC) and a **read** token (given to the Space).
3. Your Vercel project access (to change two environment variables).
4. Never paste a token in chat or commit it. Put it in an environment variable or in the Space's Secrets page.

## 3. Timeline (about 2.5 hours; the upload is the slow part, so it starts first)

### Step 1 (0:00 to 0:20): start the data upload (runs in the background for 20 to 60 minutes)
On your PC, in the repository folder:
```bash
pip install -U huggingface_hub
$env:HF_TOKEN = "hf_YOUR_WRITE_TOKEN"      # PowerShell (cmd.exe: set HF_TOKEN=hf_YOUR_WRITE_TOKEN)
python deploy/hf/upload_data.py YOUR-NAME/lunascope-data
```
It creates a **private** dataset and uploads `data/raw` (about 4.4 GB, resumable: if it stops, run it again). Leave it running and move on.

### Step 2 (0:20 to 0:50): create the Space
1. huggingface.co, New Space, name `lunascope-science`, SDK **Docker**, hardware **CPU basic (free)**, visibility **Public** (the service token protects it; a private Space cannot be reached by Vercel).
2. In the Space's Files, add two files at the top level: copy `deploy/hf/Dockerfile` as `Dockerfile` and `deploy/hf/README.md` as `README.md`.
3. In the Space's Settings, Variables and secrets:
   - Secret `LUNASCOPE_API_TOKEN`: a long random string you make up (also used in Step 4).
   - Secret `HF_TOKEN`: the **read** token.
   - Variable `LUNASCOPE_DATA_REPO`: `YOUR-NAME/lunascope-data`.
4. The Space builds from GitHub's `main` (pip install, a few minutes). If your GitHub repository is private, say so and change the clone line to use a token secret.

### Step 3 (0:50 to 1:30): first boot and check
1. Wait for the data upload to finish, then restart the Space. On boot it downloads `data/raw` (a few minutes), starts the service, and 20 seconds later starts the reference runs GR-001 to GR-003 in the background.
2. Open `https://YOUR-NAME-lunascope-science.hf.space/api/v1/health`. Expect `"mode":"live"`, `"stack":"live"` and `"resources_ok":true`. If `resources_ok` is false, the `failing` list names the missing file: fix the upload and restart.
3. The reference runs take several minutes each on 2 vCPUs. Check `GET /api/v1/analyses` (with the bearer token) or just wait: they appear complete.

### Step 4 (1:30 to 1:50): point the hosted app at it
In Vercel, Project, Settings, Environment Variables, Production:
- `SCIENCE_API_URL` = `https://YOUR-NAME-lunascope-science.hf.space` (no trailing slash)
- `SCIENCE_API_TOKEN` = the same string as the Space's `LUNASCOPE_API_TOKEN`

Redeploy. Open the site: the offline notes should be gone, and the Runs panel should open GR-001.

### Step 5 (1:50 to 2:10): keep it awake
Change the cron-job.org URL to the Space's `/api/v1/health` (every 5 minutes). Free Spaces sleep after about 48 hours with no traffic; the ping prevents that. The Render replay service can stay as a fallback or be deleted.

### Step 6 (2:10 to 2:30): test on the live site
- Open GR-001, select a site, enter Site sky (real terrain draws), Timeline and Metrics show numbers.
- "Compute sky for this site" on a site not in the run: it runs for seconds to minutes, then Timeline and Site sky work.
- "Place a point" adds a point and computes it.
- Open the site on a phone.

Spare 30 minutes for the problems in section 4.

## 4. What can go wrong, and the fix

| Symptom | Cause | Fix |
|---|---|---|
| Build fails on `rasterio` or `pyproj` | A wheel is missing for the base image | Use `python:3.12` (not slim), or add `libgdal` packages in the Dockerfile. |
| Boot loops, "LUNASCOPE_DATA_REPO is not set" | Variable missing | Add it in Space settings. |
| `snapshot_download` 401 | The Space secret `HF_TOKEN` is missing or not a read token | Re-create the read token and the secret. |
| Health says `resources_ok:false` | A file did not upload or is a different size | Re-run `upload_data.py`, then restart the Space. |
| Compute fails with a Horizons error | JPL Horizons rate limit or outage | Retry; the saved reference runs still open. Say so on the page if it persists. |
| A run is cut off at 900 s | Slow DEM reads on 2 vCPUs | Raise `timeout_s` or run fewer sites per request; the reference runs are warmed at boot so visitors rarely wait. |
| Vercel shows 401 or "unauthorized" | The two tokens differ | Make `SCIENCE_API_TOKEN` equal to the Space's `LUNASCOPE_API_TOKEN`. |
| First visit after a restart is slow | Cold start downloads 4.4 GB | Normal; the ping keeps it warm, and restarts are rare. |
| Runs disappear after a restart | The Space disk is ephemeral | They recompute on demand; `warm.py` restarts the three references. |

## 5. Limits you accept

- Free hardware: 2 vCPUs, so several runs at once are slow (`max_running` is 2).
- The Space is public, so the token is the only gate; keep it secret and long.
- The Space restarts occasionally; the first 5 to 10 minutes after a restart the three reference runs are being recomputed.
- Live runs depend on JPL Horizons over the internet.

## 6. Rollback

Set `SCIENCE_API_URL` back to the Render replay URL and redeploy. The site then shows the saved runs and the offline notes, as now.

## 7. Done when

The hosted site opens GR-001 from the live service, Site sky and Timeline work, "Compute sky for this site" returns a result for a site that is not in the run, and the cron-job health check is green.

## 8. If Docker Spaces are paid on your account: use the Gradio SDK Space

Hugging Face now locks the Docker SDK behind a paid plan for some accounts. A Gradio-SDK Space can run arbitrary Python, so the same
service runs from `deploy/hf/gradio-space/` instead:

1. New Space, SDK **Gradio**, template **Blank**, hardware **CPU Basic** (free). If only ZeroGPU is offered, stop: see section 9.
2. In the Space's Files, add these three files at the top level, copied from `deploy/hf/gradio-space/`: `README.md`, `requirements.txt`, `app.py`.
3. Settings, secrets and variables are the same as Step 2: secrets `LUNASCOPE_API_TOKEN` and `HF_TOKEN` (read), variable `LUNASCOPE_DATA_REPO`.
4. `app.py` clones the code from GitHub at start, opens the port at once, downloads the data in the background and then warms GR-001 to GR-003.
   Until the download finishes, `/api/v1/health` shows `resources_ok:false`; it turns true when the data is there.
5. Steps 3 to 6 above (check health, set the Vercel variables, keep-alive, test) are unchanged.

## 9. If neither Docker nor CPU Basic is available

Use a different free or cheap always-on host that can hold 4.4 GB and about 8 GB of RAM: an Oracle Cloud Always Free VM, or a small VPS
(about $4 to $6 a month). The Docker setup in `deploy/hf/` (or `deploy/service.Dockerfile` with `data/raw` mounted) runs there unchanged;
only the URL in Vercel changes.
