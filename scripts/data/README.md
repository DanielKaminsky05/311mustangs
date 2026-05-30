# Data pipeline scripts

This folder contains utilities for the one-time 311 pipeline artifacts.

## Scripts

- `build_311_index.py` — one-time builder (SR2026 normalize -> NIM embeddings -> parquet artifacts)
- `inspect_parquet_health.py` — validates parquet/vector artifacts produced by the one-time pipeline build
- `smoke_fastembed.py` — quick local embedding smoke test (no NIM required)
- `validate_semantics.py` — semantic quality/robustness checks with thresholded pass/fail

---

## Quick run order

1. (Optional) run FastEmbed smoke test locally.
2. Run full NIM pipeline build on Spark.
3. Run parquet health validation.
4. Run semantic validation and review report.

---

## Setup + run (DGX Spark)

### 1) Create/activate env

Using uv venv (recommended if already set up):

```bash
cd scripts/data
uv sync || uv pip install -r requirements.pipeline.txt
cd ../..
```

Or plain venv:

```bash
python3.12 -m venv rapids-env
source rapids-env/bin/activate
pip install --upgrade pip
pip install -r scripts/data/requirements.pipeline.txt
```

### 2) Start local NIM embedding service

Run your NIM embedding container/service on Spark and expose an OpenAI-compatible endpoint.

Expected endpoints:
- `GET http://127.0.0.1:8000/v1/models`
- `POST http://127.0.0.1:8000/v1/embeddings`

### 3) Configure env vars

```bash
export NIM_BASE_URL=http://127.0.0.1:8000/v1
export EMBEDDING_MODEL=nvidia/nv-embedqa-e5-v5
```

### 4) Preflight NIM connectivity

```bash
curl -s "$NIM_BASE_URL/models" | jq
curl -s "$NIM_BASE_URL/embeddings" \
  -H 'content-type: application/json' \
  -d '{"model":"'"$EMBEDDING_MODEL"'","input":["hello world"]}' | jq '.data[0].embedding | length'
```

If preflight fails, fix NIM before running pipeline.

### 5) Run one-time build

```bash
python scripts/data/build_311_index.py \
  --input-csv docs/data/service-requests/SR2026.csv \
  --out-dir var \
  --nim-base-url "$NIM_BASE_URL" \
  --embedding-model "$EMBEDDING_MODEL" \
  --batch-size 128
```

### 6) Validate parquet artifacts

```bash
python scripts/data/inspect_parquet_health.py --var-dir var
```

Non-zero exit code means artifact health failure.

### 7) (Optional) FastEmbed smoke test first

Use this before NIM runs to quickly verify script wiring:

```bash
python scripts/data/smoke_fastembed.py \
  --input-csv docs/data/service-requests/SR2026.csv \
  --out-parquet var/smoke/embeddings.parquet \
  --limit 200
```

Then run a quick structural check on main artifact dir:

```bash
python scripts/data/inspect_parquet_health.py --var-dir var
```

---

## NIM request format used by script

`build_311_index.py` calls:

```json
{
  "model": "<EMBEDDING_MODEL>",
  "input": ["text1", "text2", "..."]
}
```

and expects `data[].embedding` in response.

---

## Dependencies

`requirements.pipeline.txt` includes:
- `pyarrow`, `numpy`, `pandas`, `requests`
- `cudf-cu13` (NVIDIA RAPIDS path)

---

## Build behavior summary

`build_311_index.py`:
1. Repairs SR2026 CSV malformed division rows
2. Normalizes fields and builds deterministic `structured_text`
3. Builds category taxonomy table
4. Calls local NIM embeddings endpoint in batches
5. Writes parquet artifacts + manifest

---

## Test scripts

- `smoke_fastembed.py`: wiring smoke test (local embeddings, small sample)
- `inspect_parquet_health.py`: structural artifact checks (schema/files/dim consistency)
- `validate_semantics.py`: semantic quality checks (Top-K category match + duplicate robustness)

## Semantic validation (quality + robustness)

Validation cases are in:
- `scripts/data/validation_cases.json`

Run:

```bash
python scripts/data/validate_semantics.py \
  --cases scripts/data/validation_cases.json \
  --taxonomy-parquet var/tables/category_taxonomy.parquet \
  --model BAAI/bge-small-en-v1.5
```

Outputs:
- `var/reports/semantic_validation.json`
- `var/reports/semantic_validation.md`

Checks include:
- category retrieval quality (Top-1, Top-3, MRR)
- duplicate robustness (paraphrase/typo cosine thresholds)
- vector sanity (non-zero vectors)
- thresholded pass/fail with non-zero exit code on failure

## Output artifacts

- `var/tables/service_requests_normalized.parquet`
- `var/tables/service_requests_active.parquet`
- `var/tables/category_taxonomy.parquet`
- `var/embeddings/service_requests_all.parquet`
- `var/embeddings/service_requests_active.parquet`
- `var/embeddings/category_taxonomy.parquet`
- `var/manifests/index_manifest.json`
