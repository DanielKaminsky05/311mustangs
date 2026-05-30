#!/usr/bin/env python3
"""Profile Watermain Breaks WGS84 shapefile attributes.

Purpose for the demo:
- known issue / auto-resolution evidence for flooded street or watermain reports
- historical spatial corpus with actual WGS84 lat/lon

This script reads the .dbf directly using Python stdlib so no GIS dependency is
required. If later you want geometry beyond POINT_X/POINT_Y, install pyshp:
  docs/sandbox/.venv/bin/pip install pyshp
"""

from __future__ import annotations

import argparse
import struct
from pathlib import Path
from typing import Any

import pandas as pd

from common_profile import DATA_DIR, OUTPUT_DIR, clean_columns, column_profile, numeric_range, save_artifacts, toronto_latlon_quality, value_counts


def _decode(raw: bytes) -> str:
    return raw.decode("latin1", errors="replace").strip().replace("\x00", "")


def read_dbf(path: Path, limit: int | None = None) -> pd.DataFrame:
    """Minimal dBase DBF reader for shapefile attribute tables."""
    with path.open("rb") as f:
        header = f.read(32)
        if len(header) < 32:
            raise ValueError(f"Invalid DBF header in {path}")
        num_records = struct.unpack("<I", header[4:8])[0]
        header_len = struct.unpack("<H", header[8:10])[0]
        record_len = struct.unpack("<H", header[10:12])[0]

        fields: list[dict[str, Any]] = []
        while True:
            desc = f.read(32)
            if not desc or desc[0] == 0x0D:
                break
            name = _decode(desc[0:11])
            ftype = chr(desc[11])
            length = desc[16]
            decimals = desc[17]
            fields.append({"name": name, "type": ftype, "length": length, "decimals": decimals})

        f.seek(header_len)
        rows: list[dict[str, Any]] = []
        target = min(num_records, limit) if limit else num_records
        for _ in range(target):
            rec = f.read(record_len)
            if len(rec) < record_len:
                break
            if rec[0:1] == b"*":
                continue
            pos = 1
            row: dict[str, Any] = {}
            for field in fields:
                raw = rec[pos : pos + field["length"]]
                pos += field["length"]
                text = _decode(raw)
                if text == "":
                    value: Any = None
                elif field["type"] in {"N", "F"}:
                    try:
                        value = float(text) if field["decimals"] else int(float(text))
                    except ValueError:
                        value = text
                elif field["type"] == "D" and len(text) == 8:
                    value = f"{text[0:4]}-{text[4:6]}-{text[6:8]}"
                else:
                    value = text
                row[field["name"]] = value
            rows.append(row)
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dbf", type=Path, default=DATA_DIR / "watermain-breaks" / "Breaks_1990_2016_wgs84.dbf")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--sample", type=int, default=25)
    parser.add_argument("--limit", type=int, default=None, help="Optional row limit for fast smoke tests")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    df = clean_columns(read_dbf(args.dbf, limit=args.limit))
    if "break_date" in df.columns:
        df["break_date__parsed"] = pd.to_datetime(df["break_date"], errors="coerce")

    latlon = toronto_latlon_quality(df, "point_y", "point_x")
    date_stats = {}
    if "break_date__parsed" in df.columns:
        valid = int(df["break_date__parsed"].notna().sum())
        date_stats["break_date"] = {
            "valid": valid,
            "missing_or_invalid": int(len(df) - valid),
            "min": None if valid == 0 else str(df["break_date__parsed"].min()),
            "max": None if valid == 0 else str(df["break_date__parsed"].max()),
        }

    overview = {
        "source_file": str(args.dbf),
        "rows": int(len(df)),
        "columns": list(df.columns),
        "date_stats": date_stats,
        "latlon_quality": latlon,
        "xcoord_range": numeric_range(df, "xcoord"),
        "ycoord_range": numeric_range(df, "ycoord"),
        "location_granularity": "Excellent: POINT_X/POINT_Y are WGS84 lon/lat attributes.",
        "demo_feasibility": {
            "known_water_issue_auto_resolution": "HIGH for historical proof and geospatial matching demos",
            "current_active_issue_detection": "LOW/MEDIUM because data ends at 2016; use as historical known-break corpus or seed a synthetic active record near a real coordinate",
            "spatial_grounding": "HIGH - actual WGS84 coordinates available without geocoding",
        },
    }

    profile = column_profile(df)
    sections: list[tuple[str, object]] = [
        ("Overview", overview),
        ("Column profile", profile),
        ("Breaks by year", value_counts(df, "break_year", 40)),
    ]

    sample_cols = [c for c in ["break_date", "break_year", "point_x", "point_y", "xcoord", "ycoord"] if c in df.columns]
    samples = df[sample_cols].dropna(subset=[c for c in ["point_x", "point_y"] if c in df.columns]).head(args.sample)
    samples.to_csv(args.output_dir / "watermain_breaks_demo_candidates.csv", index=False)
    sections.append(("Sample geospatial demo candidates", samples))

    save_artifacts("watermain_breaks", profile, sections, args.output_dir)


if __name__ == "__main__":
    main()
