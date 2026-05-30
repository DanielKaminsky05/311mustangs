#!/usr/bin/env python3
"""Shared helpers for profiling Toronto Open Data files for the 311 demo.

These scripts intentionally only require pandas + numpy from the local venv.
They write small markdown/CSV artifacts under docs/sandbox/outputs so they can be
rerun as datasets change.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "docs" / "data"
OUTPUT_DIR = ROOT / "docs" / "sandbox" / "outputs"


def ensure_output_dir(path: Path = OUTPUT_DIR) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_csv(path: Path, **kwargs: Any) -> pd.DataFrame:
    """Read CSV with forgiving defaults.

    Some Toronto Open Data CSV exports have a small number of malformed rows.
    First try the fast C parser; if tokenization fails, fall back to the Python
    parser and skip bad lines so feasibility profiling remains rerunnable.
    """
    try:
        return pd.read_csv(path, low_memory=False, **kwargs)
    except pd.errors.ParserError as exc:
        print(f"Fast CSV parse failed for {path}: {exc}")
        print("Retrying with engine='python', on_bad_lines='skip'.")
        fallback_kwargs = dict(kwargs)
        fallback_kwargs.setdefault("engine", "python")
        fallback_kwargs.setdefault("on_bad_lines", "skip")
        fallback_kwargs.setdefault("encoding", "latin1")
        return pd.read_csv(path, **fallback_kwargs)


def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [re.sub(r"\s+", "_", str(c).strip()).lower() for c in out.columns]
    return out


def parse_dates_inplace(df: pd.DataFrame, candidates: Iterable[str]) -> dict[str, dict[str, Any]]:
    stats: dict[str, dict[str, Any]] = {}
    for col in candidates:
        if col not in df.columns:
            continue
        parsed = pd.to_datetime(df[col], errors="coerce")
        valid = int(parsed.notna().sum())
        df[col + "__parsed"] = parsed
        stats[col] = {
            "valid": valid,
            "missing_or_invalid": int(len(df) - valid),
            "min": None if valid == 0 else str(parsed.min()),
            "max": None if valid == 0 else str(parsed.max()),
        }
    return stats


def column_profile(df: pd.DataFrame, max_examples: int = 5) -> pd.DataFrame:
    rows = []
    n = len(df)
    for col in df.columns:
        s = df[col]
        non_null = int(s.notna().sum())
        unique = int(s.nunique(dropna=True))
        examples = [str(x) for x in s.dropna().drop_duplicates().head(max_examples).tolist()]
        rows.append(
            {
                "column": col,
                "dtype": str(s.dtype),
                "non_null": non_null,
                "null": int(n - non_null),
                "null_pct": round((n - non_null) / n * 100, 2) if n else 0,
                "unique": unique,
                "example_values": " | ".join(examples),
            }
        )
    return pd.DataFrame(rows)


def value_counts(df: pd.DataFrame, col: str, n: int = 20) -> pd.DataFrame:
    if col not in df.columns:
        return pd.DataFrame(columns=[col, "count"])
    vc = df[col].fillna("<NULL>").astype(str).value_counts().head(n)
    return vc.rename_axis(col).reset_index(name="count")


def numeric_range(df: pd.DataFrame, col: str) -> dict[str, Any] | None:
    if col not in df.columns:
        return None
    s = pd.to_numeric(df[col], errors="coerce")
    if s.notna().sum() == 0:
        return None
    return {
        "valid": int(s.notna().sum()),
        "min": float(s.min()),
        "max": float(s.max()),
        "mean": float(s.mean()),
    }


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def toronto_latlon_quality(df: pd.DataFrame, lat_col: str, lon_col: str) -> dict[str, Any]:
    if lat_col not in df.columns or lon_col not in df.columns:
        return {"available": False}
    lat = pd.to_numeric(df[lat_col], errors="coerce")
    lon = pd.to_numeric(df[lon_col], errors="coerce")
    valid = lat.between(43.4, 44.0) & lon.between(-80.0, -78.8)
    return {
        "available": True,
        "valid_toronto_latlon": int(valid.sum()),
        "valid_pct": round(float(valid.mean() * 100), 2) if len(df) else 0,
        "lat_range": numeric_range(pd.DataFrame({lat_col: lat}), lat_col),
        "lon_range": numeric_range(pd.DataFrame({lon_col: lon}), lon_col),
    }


def dataframe_to_markdown(df: pd.DataFrame) -> str:
    """Small dependency-free markdown table renderer.

    pandas.DataFrame.to_markdown requires the optional tabulate package, which is
    intentionally not assumed in this sandbox venv.
    """
    if df.empty:
        return "_(empty)_"
    display = df.copy().astype(str)
    display = display.replace({"nan": "", "NaT": "", "None": ""})
    headers = [str(c) for c in display.columns]
    rows = display.values.tolist()

    def esc(value: object) -> str:
        return str(value).replace("\n", " ").replace("|", "\\|")

    lines = ["| " + " | ".join(esc(h) for h in headers) + " |"]
    lines.append("| " + " | ".join("---" for _ in headers) + " |")
    for row in rows:
        lines.append("| " + " | ".join(esc(v) for v in row) + " |")
    return "\n".join(lines)


def write_markdown_report(path: Path, title: str, sections: list[tuple[str, Any]]) -> None:
    lines = [f"# {title}", ""]
    for heading, content in sections:
        lines.extend([f"## {heading}", ""])
        if isinstance(content, pd.DataFrame):
            lines.append(dataframe_to_markdown(content))
        elif isinstance(content, (dict, list)):
            lines.append("```json")
            lines.append(json.dumps(content, indent=2, default=str))
            lines.append("```")
        else:
            lines.append(str(content))
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def save_artifacts(name: str, profile: pd.DataFrame, report_sections: list[tuple[str, Any]], output_dir: Path = OUTPUT_DIR) -> None:
    ensure_output_dir(output_dir)
    profile.to_csv(output_dir / f"{name}_columns.csv", index=False)
    write_markdown_report(output_dir / f"{name}_report.md", name.replace("_", " ").title(), report_sections)
    print(f"Wrote {output_dir / f'{name}_report.md'}")
    print(f"Wrote {output_dir / f'{name}_columns.csv'}")
