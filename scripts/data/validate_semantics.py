#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
from fastembed import TextEmbedding


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def topk_scores(query: np.ndarray, matrix: np.ndarray, k: int = 3):
    sims = matrix @ query / (np.linalg.norm(matrix, axis=1) * np.linalg.norm(query) + 1e-12)
    idx = np.argsort(-sims)[:k]
    return idx, sims[idx]


def load_cases(path: Path) -> dict:
    return json.loads(path.read_text())


def embed_texts(model_name: str, texts: list[str]) -> tuple[np.ndarray, float]:
    model = TextEmbedding(model_name=model_name)
    t0 = time.perf_counter()
    vecs = [v.tolist() for v in model.embed(texts)]
    dt = time.perf_counter() - t0
    return np.array(vecs, dtype=np.float32), dt


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--cases", type=Path, default=Path("scripts/data/validation_cases.json"))
    p.add_argument("--taxonomy-parquet", type=Path, default=Path("var/tables/category_taxonomy.parquet"))
    p.add_argument("--model", default="BAAI/bge-small-en-v1.5")
    p.add_argument("--out-json", type=Path, default=Path("var/reports/semantic_validation.json"))
    p.add_argument("--out-md", type=Path, default=Path("var/reports/semantic_validation.md"))
    args = p.parse_args()

    cases = load_cases(args.cases)
    cat_cases = cases.get("category_cases", [])
    dup_cases = cases.get("duplicate_cases", [])
    thr = cases.get("thresholds", {})

    tax = pq.read_table(args.taxonomy_parquet).to_pandas()
    labels = (
        tax["service_request_type"].fillna("").astype(str)
        + " "
        + tax["division"].fillna("").astype(str)
        + " "
        + tax["section"].fillna("").astype(str)
    ).tolist()
    tax_texts = tax["structured_text"].fillna("").astype(str).tolist()

    tax_mat, tax_embed_s = embed_texts(args.model, tax_texts)

    # A) Category eval
    top1_hits = 0
    top3_hits = 0
    rr_sum = 0.0
    cat_failures = []
    query_times = []

    for c in cat_cases:
        q = c["query_text"]
        expected = [e.lower() for e in c["expected_any_of"]]
        qvec, dt = embed_texts(args.model, [q])
        query_times.append(dt)
        idx, sims = topk_scores(qvec[0], tax_mat, k=3)
        top_labels = [labels[i].lower() for i in idx]

        rank = None
        for r, lbl in enumerate(top_labels, start=1):
            if any(e in lbl for e in expected):
                rank = r
                break

        if rank == 1:
            top1_hits += 1
        if rank is not None:
            top3_hits += 1
            rr_sum += 1.0 / rank
        else:
            cat_failures.append({"id": c["id"], "query": q, "top_labels": top_labels, "sims": [float(x) for x in sims]})

    ncat = max(1, len(cat_cases))
    top1 = top1_hits / ncat
    top3 = top3_hits / ncat
    mrr = rr_sum / ncat

    # B) Duplicate robustness
    dup_pass = 0
    dup_details = []
    for d in dup_cases:
        vecs, _ = embed_texts(args.model, [d["text_a"], d["text_b"]])
        sim = cosine(vecs[0], vecs[1])
        ok = sim >= float(d.get("min_cosine", 0.7))
        dup_pass += 1 if ok else 0
        dup_details.append({"id": d["id"], "similarity": sim, "min_cosine": d.get("min_cosine"), "pass": ok})

    ndup = max(1, len(dup_cases))
    dup_ratio = dup_pass / ndup

    # C) Vector sanity
    norms = np.linalg.norm(tax_mat, axis=1)
    nonzero_ratio = float(np.mean(norms > 0)) if len(norms) else 0.0

    passed = (
        top1 >= float(thr.get("category_top1_min", 0.0))
        and top3 >= float(thr.get("category_top3_min", 0.0))
        and dup_ratio >= float(thr.get("duplicate_pass_ratio_min", 0.0))
        and nonzero_ratio >= float(thr.get("nonzero_vector_ratio_min", 1.0))
    )

    report = {
        "model": args.model,
        "counts": {"category_cases": len(cat_cases), "duplicate_cases": len(dup_cases), "taxonomy_rows": len(tax)},
        "metrics": {
            "category_top1": top1,
            "category_top3": top3,
            "category_mrr": mrr,
            "duplicate_pass_ratio": dup_ratio,
            "nonzero_vector_ratio": nonzero_ratio,
            "taxonomy_embed_seconds": tax_embed_s,
            "query_embed_mean_seconds": float(np.mean(query_times)) if query_times else 0.0,
        },
        "thresholds": thr,
        "passed": passed,
        "failures": {"category": cat_failures, "duplicate": [d for d in dup_details if not d["pass"]]},
        "duplicate_details": dup_details,
    }

    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    args.out_json.write_text(json.dumps(report, indent=2))

    md = [
        "# Semantic Validation Report",
        f"- Model: `{args.model}`",
        f"- Passed: **{passed}**",
        "",
        "## Metrics",
        f"- category_top1: {top1:.3f}",
        f"- category_top3: {top3:.3f}",
        f"- category_mrr: {mrr:.3f}",
        f"- duplicate_pass_ratio: {dup_ratio:.3f}",
        f"- nonzero_vector_ratio: {nonzero_ratio:.3f}",
        "",
        f"JSON: `{args.out_json}`",
    ]
    args.out_md.write_text("\n".join(md))

    print(json.dumps({"passed": passed, "out_json": str(args.out_json), "out_md": str(args.out_md)}, indent=2))
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
