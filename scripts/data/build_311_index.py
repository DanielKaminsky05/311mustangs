#!/usr/bin/env python3
"""Build one-time 311 parquet + embedding artifacts using local NVIDIA NIM.

Assumes OpenAI-compatible embeddings endpoint at {NIM_BASE_URL}/embeddings.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import requests


EXPECTED_COLUMNS = [
    "creation_date",
    "status",
    "first_3_chars_of_postal_code",
    "intersection_street_1",
    "intersection_street_2",
    "ward",
    "service_request_type",
    "division",
    "section",
]


def read_service_requests_csv(path: Path) -> tuple[pd.DataFrame, dict]:
    with path.open("r", encoding="latin1", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = []
        repaired = 0
        short = 0
        for row in reader:
            if len(row) == len(header):
                rows.append(row)
            elif len(row) > len(header):
                rows.append(row[:7] + [", ".join(part.strip() for part in row[7:-1])] + [row[-1]])
                repaired += 1
            else:
                rows.append(row + [""] * (len(header) - len(row)))
                short += 1
    raw = pd.DataFrame(rows, columns=header)
    raw.columns = [c.strip().lower().replace(" ", "_") for c in raw.columns]
    return raw, {"csv_repaired_rows": repaired, "csv_short_rows_padded": short}


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    for c in EXPECTED_COLUMNS:
        if c not in df.columns:
            df[c] = None

    df = df[EXPECTED_COLUMNS].copy()
    for c in df.columns:
        df[c] = df[c].astype(str).str.strip().replace({"": None, "nan": None})

    df["creation_date"] = pd.to_datetime(df["creation_date"], errors="coerce", utc=True)
    df["record_id"] = [f"sr2026-{i+1:06d}" for i in range(len(df))]

    fsa = df["first_3_chars_of_postal_code"].fillna("").str.upper().str.strip()
    df["postal_code_or_fsa"] = fsa.where((fsa != "") & (fsa != "INTERSECTION"), None)

    has_i1 = df["intersection_street_1"].fillna("").str.strip() != ""
    has_i2 = df["intersection_street_2"].fillna("").str.strip() != ""
    has_fsa = df["postal_code_or_fsa"].fillna("").str.strip() != ""
    df["location_type"] = "unknown"
    df.loc[has_i1 & has_i2, "location_type"] = "intersection"
    df.loc[(~(has_i1 & has_i2)) & has_fsa, "location_type"] = "fsa"

    df["is_active"] = df["status"].fillna("").isin(["New", "In Progress"])
    df["category_key"] = (
        df["service_request_type"].fillna("")
        + "__"
        + df["division"].fillna("")
        + "__"
        + df["section"].fillna("")
    ).str.lower()

    def to_text(r: pd.Series) -> str:
        parts = [
            f"Service request type: {r.get('service_request_type') or 'unknown'}.",
            f"Division: {r.get('division') or 'unknown'}.",
            f"Section: {r.get('section') or 'unknown'}.",
            f"Status: {r.get('status') or 'unknown'}.",
        ]
        ward = r.get("ward")
        if ward:
            parts.append(f"Ward: {ward}.")
        i1, i2 = r.get("intersection_street_1"), r.get("intersection_street_2")
        if i1 and i2:
            parts.append(f"Intersection: {i1} and {i2}.")
        elif r.get("postal_code_or_fsa"):
            parts.append(f"Postal area: {r.get('postal_code_or_fsa')}.")
        return " ".join(parts)

    df["structured_text"] = df.apply(to_text, axis=1)
    df["structured_text_hash"] = df["structured_text"].map(lambda s: hashlib.sha256(s.encode("utf-8")).hexdigest())
    return df


def build_taxonomy(df: pd.DataFrame) -> pd.DataFrame:
    g = (
        df.groupby(["service_request_type", "division", "section"], dropna=False)
        .agg(historical_count=("record_id", "count"), active_count=("is_active", "sum"))
        .reset_index()
    )
    g = g.fillna("")
    g["category_id"] = (
        g["division"].str.lower().str.replace(" ", "-")
        + "__"
        + g["section"].str.lower().str.replace(" ", "-")
        + "__"
        + g["service_request_type"].str.lower().str.replace(" ", "-")
    )
    g["structured_text"] = (
        "Service request category: "
        + g["service_request_type"]
        + ". Division: "
        + g["division"]
        + ". Section: "
        + g["section"]
        + "."
    )
    g["structured_text_hash"] = g["structured_text"].map(lambda s: hashlib.sha256(s.encode("utf-8")).hexdigest())
    return g


def nim_embed(base_url: str, model: str, texts: list[str], timeout: int) -> list[list[float]]:
    r = requests.post(
        f"{base_url.rstrip('/')}/embeddings",
        json={"model": model, "input": texts},
        timeout=timeout,
    )
    r.raise_for_status()
    data = r.json().get("data", [])
    data = sorted(data, key=lambda x: x.get("index", 0))
    return [item["embedding"] for item in data]


def embed_frame(df: pd.DataFrame, id_col: str, text_col: str, base_url: str, model: str, batch_size: int, timeout: int) -> pd.DataFrame:
    ids = df[id_col].tolist()
    texts = df[text_col].tolist()
    hashes = df["structured_text_hash"].tolist()

    out_ids: list[str] = []
    out_embs: list[list[float]] = []
    out_hashes: list[str] = []

    for i in range(0, len(texts), batch_size):
        chunk_ids = ids[i : i + batch_size]
        chunk_texts = texts[i : i + batch_size]
        chunk_hashes = hashes[i : i + batch_size]
        vectors = nim_embed(base_url, model, chunk_texts, timeout=timeout)
        if len(vectors) != len(chunk_ids):
            raise RuntimeError(f"Embedding size mismatch at batch starting {i}")
        out_ids.extend(chunk_ids)
        out_embs.extend(vectors)
        out_hashes.extend(chunk_hashes)

    dim = len(out_embs[0]) if out_embs else 0
    built_at = datetime.now(UTC).isoformat()
    return pd.DataFrame(
        {
            "id": out_ids,
            "embedding": out_embs,
            "embedding_model": model,
            "embedding_dim": dim,
            "structured_text_hash": out_hashes,
            "built_at": built_at,
        }
    )


def write_parquet(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pandas(df, preserve_index=False)
    pq.write_table(table, path)


def ensure_nim_up(base_url: str, timeout: int) -> None:
    r = requests.get(f"{base_url.rstrip('/')}/models", timeout=timeout)
    r.raise_for_status()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input-csv", type=Path, default=Path("docs/data/service-requests/SR2026.csv"))
    p.add_argument("--out-dir", type=Path, default=Path("var"))
    p.add_argument("--nim-base-url", default=os.getenv("NIM_BASE_URL", "http://127.0.0.1:8000/v1"))
    p.add_argument("--embedding-model", default=os.getenv("EMBEDDING_MODEL", "nvidia/nv-embedqa-e5-v5"))
    p.add_argument("--batch-size", type=int, default=128)
    p.add_argument("--timeout-seconds", type=int, default=120)
    args = p.parse_args()

    ensure_nim_up(args.nim_base_url, args.timeout_seconds)

    raw, repair = read_service_requests_csv(args.input_csv)
    norm = normalize(raw)
    active = norm[norm["is_active"]].copy()
    taxonomy = build_taxonomy(norm)

    emb_all = embed_frame(norm, "record_id", "structured_text", args.nim_base_url, args.embedding_model, args.batch_size, args.timeout_seconds)
    emb_active = embed_frame(active, "record_id", "structured_text", args.nim_base_url, args.embedding_model, args.batch_size, args.timeout_seconds)
    emb_tax = embed_frame(taxonomy, "category_id", "structured_text", args.nim_base_url, args.embedding_model, args.batch_size, args.timeout_seconds)

    write_parquet(norm, args.out_dir / "tables/service_requests_normalized.parquet")
    write_parquet(active, args.out_dir / "tables/service_requests_active.parquet")
    write_parquet(taxonomy, args.out_dir / "tables/category_taxonomy.parquet")

    write_parquet(emb_all, args.out_dir / "embeddings/service_requests_all.parquet")
    write_parquet(emb_active, args.out_dir / "embeddings/service_requests_active.parquet")
    write_parquet(emb_tax, args.out_dir / "embeddings/category_taxonomy.parquet")

    manifest = {
        "built_at": datetime.now(UTC).isoformat(),
        "source_csv": str(args.input_csv),
        "embedding_backend": "nim-local",
        "nim_base_url": args.nim_base_url,
        "embedding_model": args.embedding_model,
        "embedding_dim": int(emb_all["embedding_dim"].iloc[0]) if len(emb_all) else 0,
        "counts": {
            "service_requests": int(len(norm)),
            "active_service_requests": int(len(active)),
            "category_taxonomy": int(len(taxonomy)),
            "csv_repaired_rows": int(repair["csv_repaired_rows"]),
            "csv_short_rows_padded": int(repair["csv_short_rows_padded"]),
        },
        "outputs": {
            "normalized": "tables/service_requests_normalized.parquet",
            "active": "tables/service_requests_active.parquet",
            "taxonomy": "tables/category_taxonomy.parquet",
            "emb_all": "embeddings/service_requests_all.parquet",
            "emb_active": "embeddings/service_requests_active.parquet",
            "emb_taxonomy": "embeddings/category_taxonomy.parquet",
        },
    }

    out_manifest = args.out_dir / "manifests/index_manifest.json"
    out_manifest.parent.mkdir(parents=True, exist_ok=True)
    out_manifest.write_text(json.dumps(manifest, indent=2))

    print("✅ build complete")
    print(json.dumps(manifest["counts"], indent=2))


if __name__ == "__main__":
    main()
