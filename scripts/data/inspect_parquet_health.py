#!/usr/bin/env python3
"""Lightweight health checks for one-time 311 parquet artifacts.

Usage:
  python scripts/data/inspect_parquet_health.py --var-dir var
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import pyarrow.parquet as pq
except Exception:  # pragma: no cover
    pq = None


REQUIRED_FILES = [
    "tables/service_requests_normalized.parquet",
    "tables/category_taxonomy.parquet",
    "tables/service_requests_active.parquet",
    "embeddings/service_requests_all.parquet",
    "embeddings/service_requests_active.parquet",
    "embeddings/category_taxonomy.parquet",
]


@dataclass
class CheckResult:
    name: str
    ok: bool
    details: str


def fail(msg: str) -> None:
    print(f"❌ {msg}")
    sys.exit(1)


def read_table(path: Path):
    if pq is None:
        fail("pyarrow is required: pip install pyarrow")
    return pq.read_table(path)


def has_columns(table, cols: list[str]) -> tuple[bool, list[str]]:
    names = set(table.column_names)
    missing = [c for c in cols if c not in names]
    return len(missing) == 0, missing


def check_required_files(var_dir: Path) -> list[CheckResult]:
    out: list[CheckResult] = []
    for rel in REQUIRED_FILES:
        p = var_dir / rel
        out.append(CheckResult(rel, p.exists(), "present" if p.exists() else "missing"))
    return out


def check_normalized_table(path: Path) -> list[CheckResult]:
    t = read_table(path)
    out: list[CheckResult] = [CheckResult("normalized.rows", t.num_rows > 0, f"rows={t.num_rows}")]

    expected = [
        "record_id",
        "creation_date",
        "status",
        "service_request_type",
        "division",
        "section",
        "structured_text",
        "structured_text_hash",
    ]
    ok, missing = has_columns(t, expected)
    out.append(CheckResult("normalized.required_columns", ok, "ok" if ok else f"missing={missing}"))
    return out


def _embedding_dim_first_value(table) -> int | None:
    if "embedding" not in table.column_names or table.num_rows == 0:
        return None
    col = table.column("embedding")
    first = col[0].as_py()
    if isinstance(first, list):
        return len(first)
    return None


def check_embedding_table(path: Path, name: str) -> list[CheckResult]:
    t = read_table(path)
    out: list[CheckResult] = [CheckResult(f"{name}.rows", t.num_rows > 0, f"rows={t.num_rows}")]

    expected = ["id", "embedding", "embedding_model", "embedding_dim", "structured_text_hash"]
    ok, missing = has_columns(t, expected)
    out.append(CheckResult(f"{name}.required_columns", ok, "ok" if ok else f"missing={missing}"))
    if not ok:
        return out

    sample_dim = _embedding_dim_first_value(t)
    out.append(
        CheckResult(
            f"{name}.sample_vector_dim",
            sample_dim is not None and sample_dim > 0,
            f"dim={sample_dim}",
        )
    )

    # verify embedding_dim column consistency on sampled rows
    dim_col = t.column("embedding_dim")
    limit = min(100, t.num_rows)
    vals = [dim_col[i].as_py() for i in range(limit)]
    distinct = sorted(set(vals))
    consistent = len(distinct) == 1
    out.append(CheckResult(f"{name}.embedding_dim_consistent_sample", consistent, f"distinct={distinct}"))

    if sample_dim is not None and consistent:
        out.append(
            CheckResult(
                f"{name}.sample_dim_matches_declared",
                int(distinct[0]) == sample_dim,
                f"declared={distinct[0]} sample={sample_dim}",
            )
        )

    return out


def check_manifest(var_dir: Path) -> list[CheckResult]:
    path = var_dir / "manifests" / "index_manifest.json"
    if not path.exists():
        return [CheckResult("manifest.present", False, "missing var/manifests/index_manifest.json")]

    raw = json.loads(path.read_text())
    indexes = raw.get("indexes") if isinstance(raw, dict) else None
    ok = isinstance(indexes, list) and len(indexes) >= 3
    out = [CheckResult("manifest.indexes", ok, f"count={len(indexes) if isinstance(indexes, list) else 0}")]

    for i, idx in enumerate(indexes or []):
        backend_ok = idx.get("backend") in {"cuvs", "faiss-gpu", "faiss"}
        out.append(CheckResult(f"manifest.index[{i}].backend", backend_ok, f"backend={idx.get('backend')}"))
    return out


def print_results(results: list[CheckResult]) -> int:
    failed = 0
    for r in results:
        icon = "✅" if r.ok else "❌"
        print(f"{icon} {r.name}: {r.details}")
        if not r.ok:
            failed += 1
    return failed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--var-dir", type=Path, default=Path("var"))
    args = parser.parse_args()

    var_dir = args.var_dir
    results: list[CheckResult] = []

    # 1) files
    results.extend(check_required_files(var_dir))

    # Stop early if essentials missing
    if any((not r.ok) for r in results):
        failed = print_results(results)
        fail(f"health check failed: {failed} checks failed")

    # 2) schema/content checks
    results.extend(check_normalized_table(var_dir / "tables/service_requests_normalized.parquet"))
    results.extend(check_embedding_table(var_dir / "embeddings/service_requests_all.parquet", "emb_all"))
    results.extend(check_embedding_table(var_dir / "embeddings/service_requests_active.parquet", "emb_active"))
    results.extend(check_embedding_table(var_dir / "embeddings/category_taxonomy.parquet", "emb_taxonomy"))

    # 3) optional manifest checks
    results.extend(check_manifest(var_dir))

    failed = print_results(results)
    if failed:
        fail(f"health check failed: {failed} checks failed")

    print("\n🎉 parquet health check passed")


if __name__ == "__main__":
    main()
