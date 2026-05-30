#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from fastembed import TextEmbedding


def read_and_repair(path: Path, limit: int) -> pd.DataFrame:
    with path.open("r", encoding="latin1", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = []
        for row in reader:
            if len(rows) >= limit:
                break
            if len(row) == len(header):
                rows.append(row)
            elif len(row) > len(header):
                rows.append(row[:7] + [", ".join(part.strip() for part in row[7:-1])] + [row[-1]])
            else:
                rows.append(row + [""] * (len(header) - len(row)))
    df = pd.DataFrame(rows, columns=header)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    return df


def build_text(df: pd.DataFrame) -> pd.DataFrame:
    for c in [
        "status",
        "ward",
        "service_request_type",
        "division",
        "section",
        "intersection_street_1",
        "intersection_street_2",
    ]:
        if c not in df.columns:
            df[c] = ""
        df[c] = df[c].fillna("").astype(str).str.strip()

    def row_text(r: pd.Series) -> str:
        base = f"Service request type: {r['service_request_type']}. Division: {r['division']}. Section: {r['section']}. Status: {r['status']}."
        if r["ward"]:
            base += f" Ward: {r['ward']}."
        if r["intersection_street_1"] and r["intersection_street_2"]:
            base += f" Intersection: {r['intersection_street_1']} and {r['intersection_street_2']}."
        return base

    out = df.copy()
    out["record_id"] = [f"smoke-{i+1:06d}" for i in range(len(out))]
    out["structured_text"] = out.apply(row_text, axis=1)
    out["structured_text_hash"] = out["structured_text"].map(lambda s: hashlib.sha256(s.encode()).hexdigest())
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input-csv", type=Path, default=Path("docs/data/service-requests/SR2026.csv"))
    p.add_argument("--out-parquet", type=Path, default=Path("var/smoke/embeddings.parquet"))
    p.add_argument("--limit", type=int, default=200)
    p.add_argument("--model", default="BAAI/bge-small-en-v1.5")
    args = p.parse_args()

    df = build_text(read_and_repair(args.input_csv, args.limit))
    model = TextEmbedding(model_name=args.model)
    vectors = list(model.embed(df["structured_text"].tolist()))
    vectors = [v.tolist() for v in vectors]
    dim = len(vectors[0]) if vectors else 0

    out = pd.DataFrame(
        {
            "id": df["record_id"],
            "embedding": vectors,
            "embedding_model": args.model,
            "embedding_dim": dim,
            "structured_text_hash": df["structured_text_hash"],
        }
    )
    args.out_parquet.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.Table.from_pandas(out, preserve_index=False), args.out_parquet)

    report = {
        "rows": int(len(out)),
        "embedding_dim": dim,
        "out_parquet": str(args.out_parquet),
        "model": args.model,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
