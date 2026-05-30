# DGX Spark Python environment

How the Python environments on the ASUS GX10 (DGX Spark, NVIDIA GB10 Grace Blackwell, aarch64) are structured for this project, and how to add or update dependencies without breaking each other.

## Hardware and OS

- Host: `asus@gx10-4a58`
- Architecture: aarch64 (ARM64) — most x86-64 wheels are NOT compatible.
- Python on the box: 3.12 (already used by the vLLM venv).
- Docker is installed and required. NemoClaw runs containerized OpenShell sandboxes under the hood — team members do **not** author Dockerfiles; the `nemoclaw` CLI manages containers.

## Inference runtime — Ollama (primary), vLLM (fallback)

We serve **two models from one Ollama process** on the GX10, one for each use case:

| Model | Size (Q4) | Use case | Called by |
|---|---|---|---|
| `gemma4:26b` | ~16 GB | WhatsApp intake agent — asks follow-up questions, extracts facts (description / location / safety answers), populates the structured ticket payload | NemoClaw sandbox (routed inference via `inference.local`) |
| `nemotron:70b` | ~40 GB | Backend reasoning — explains audited decisions, narrates evidence packs for operators | FastAPI embed-service (direct Ollama API) |

Both models stay resident in GB10's 128 GB unified memory (~56 GB combined) with `OLLAMA_KEEP_ALIVE=-1` so the demo never pays cold-start latency. If `gemma4:26b` is not multimodal in the variant we pull, image input handling stays optional and never blocks intake — text-only reports remain a valid path (see `whatsapp-integration.md`).

vLLM (`vllm-env`) is **kept installed as a fallback** in case Ollama hits a model-loading or throughput problem during the demo. It is not the primary runtime. Do not divert time to vLLM unless Ollama actively fails.

## Why three venvs

vLLM, RAPIDS/cuDF, and the small FastAPI embed-service have conflicting transitive pins (torch, flash-attn, numba, cuda-python, numpy). Forcing them into one venv breaks at install time. Three small venvs give independent failure domains: if one breaks Saturday night, the other two keep working.

## Environment layout

```
/home/asus/
├── 311mustangsOpenClaw/
│   └── vllm-env/                 # venv #1 — vLLM serving (already exists, do not touch)
├── 311mustangs/                  # git clone of this repo
│   ├── .venv/                    # venv #2 — embed-service (FastAPI + httpx + faiss-cpu + sqlite)
│   ├── rapids-env/               # venv #3 — data pipeline (cudf-cu13 + sentence-transformers)
│   └── var/                      # build outputs: 311mustangs.sqlite, *.faiss indexes
```

## The three venvs

### 1. `vllm-env` — vLLM fallback runtime (NOT primary)

| | |
|---|---|
| **Path** | `/home/asus/311mustangsOpenClaw/vllm-env/` |
| **Activate** | `source /home/asus/311mustangsOpenClaw/vllm-env/bin/activate` |
| **Purpose** | Fallback inference runtime if Ollama hits a model or throughput problem. Not used in the default demo path. |
| **Contents (pinned)** | `vllm==0.22.0`, plus its transitive torch / CUDA pins. |
| **Who edits it** | Only the person owning LLM serving. **Do not pip-install other libraries into this venv** — vLLM's deps are touchy and reinstalling on aarch64 is expensive. |
| **Process started here** | `vllm serve <model> --host 0.0.0.0 --port 8001` (only if Ollama fails) |

### 2. `.venv` — embed-service / API wrapper

| | |
|---|---|
| **Path** | `/home/asus/311mustangs/.venv/` |
| **Activate** | `cd /home/asus/311mustangs && source .venv/bin/activate` |
| **Purpose** | The HTTP service that exposes `/embed`, `/search`, `/explain` on the LAN. Dev laptops (backend + frontend) call this. |
| **Contents** | `fastapi`, `uvicorn[standard]`, `httpx`, `faiss-cpu` (loads indexes built by `rapids-env`), `pydantic`, `pydantic-settings`, plus whatever embedding-client lib we settle on. |
| **Who edits it** | Anyone working on the embed-service code. |
| **Process started here** | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |

### 3. `rapids-env` — data pipeline (one-time + refresh)

| | |
|---|---|
| **Path** | `/home/asus/311mustangs/rapids-env/` |
| **Activate** | `cd /home/asus/311mustangs && source rapids-env/bin/activate` |
| **Purpose** | Runs the one-time RAPIDS/cuDF ingestion + structured-text builder + embedding generation + FAISS/cuVS index build. Outputs to `var/`. |
| **Contents** | `cudf-cu13` (from `--extra-index-url https://pypi.nvidia.com`), `numpy`, `pandas`, `pyarrow`, `sentence-transformers` (fallback if NIM/NeMo not in play yet), plus an embedding-model client. |
| **Who edits it** | The DGX/data path owner. |
| **Processes run here** | `python scripts/data/build_demo_db.py ...` (see `docs/planning/spark-usage.md`) |

## Initial setup (one-time, per venv)

Run from the GX10 over SSH.

### Bootstrap `.venv` (embed-service)

```bash
cd /home/asus/311mustangs
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi 'uvicorn[standard]' httpx faiss-cpu pydantic pydantic-settings
pip freeze > requirements.embed-service.txt
deactivate
```

### Bootstrap `rapids-env` (data pipeline)

First confirm aarch64 wheels exist on the NVIDIA index (this has not been verified on this box yet):

```bash
cd /home/asus/311mustangs
python3.12 -m venv rapids-env
source rapids-env/bin/activate
pip install --upgrade pip
pip install --dry-run --extra-index-url=https://pypi.nvidia.com cudf-cu13
```

If `--dry-run` resolves cleanly, install for real:

```bash
pip install --extra-index-url=https://pypi.nvidia.com cudf-cu13
pip install numpy pandas pyarrow sentence-transformers
pip freeze > requirements.rapids.txt
deactivate
```

If `--dry-run` fails (no aarch64 wheel published), we fall back to running RAPIDS through the NGC container (`nvcr.io/nvidia/rapidsai/base:<tag>-cuda12-py312-arm64`) as a one-shot, with the venv only used for the embedding/index-build glue. That decision is not finalized — flag to Shane before changing direction.

### `vllm-env` is already set up

Do **not** bootstrap it. Do **not** pip-install into it.

## Adding a dependency

1. Identify which venv the new dep belongs in (one of the three above).
2. Activate that venv.
3. `pip install <package>`.
4. Regenerate that venv's pinned requirements file:
   ```bash
   pip freeze > requirements.<venv-name>.txt
   ```
5. Commit the updated requirements file.

Never `pip install` without activating a venv first. Never install a dep across venv boundaries.

## Updating a dependency

```bash
source <venv>/bin/activate
pip install -U <package>
pip freeze > requirements.<venv-name>.txt
deactivate
```

If the update touches torch / CUDA / numba / numpy / cuda-python in `rapids-env`, run the data pipeline script end-to-end before committing — these are the libraries most likely to silently break the GPU path.

Never update anything in `vllm-env` mid-hackathon. It works. Leave it.

## Recovering a broken venv

Because `.venv` and `rapids-env` each have a checked-in `requirements.<name>.txt`, recovery is:

```bash
rm -rf <venv>/
python3.12 -m venv <venv>
source <venv>/bin/activate
pip install -r requirements.<venv>.txt
deactivate
```

`vllm-env` is the exception — there is no checked-in requirements file because it was installed manually (likely from source or a special wheel index). If `vllm-env` breaks, get Shane.

## NemoClaw and Docker

NemoClaw is installed on the host and uses Docker (via OpenShell) to sandbox the WhatsApp intake agent. The team does not write Docker syntax. The lifecycle is:

```bash
nemoclaw onboard ...        # set up the sandbox
nemoclaw <subcommand>       # day-to-day operations
```

Docker itself must be running and the `asus` user must be in the `docker` group:

```bash
sudo usermod -aG docker $USER && newgrp docker
```

## Networking note

Services must bind to `0.0.0.0`, not `127.0.0.1`, so dev laptops on the LAN (and NemoClaw's OpenShell sandbox) can reach them:

| Service | Bind | Port |
|---|---|---|
| Ollama (both models) | `0.0.0.0` | `11434` (default) |
| FastAPI embed-service | `0.0.0.0` | `8000` |
| vLLM (fallback only) | `0.0.0.0` | `8001` |

The GX10's LAN hostname / IP and CORS allowlist are TBD — see Shane.

## Still pending (not yet decided)

- Whether RAPIDS aarch64 pip wheels exist for `cudf-cu13` (or we fall back to the NGC container).
- Embedding model choice for the data pipeline (sentence-transformers default, NIM/NeMo upgrade if time allows).
- LAN networking specifics: static IP/hostname, CORS origins.
- Embed-service endpoint contract: exact request/response schemas for `/embed`, `/search`, `/explain`.
- How NemoClaw's OpenShell sandbox addresses the host's Ollama (likely `host.docker.internal:11434` or the docker bridge gateway IP).
