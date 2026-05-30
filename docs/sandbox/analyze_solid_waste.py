#!/usr/bin/env python3
"""Profile Solid Waste Collection Schedule.

Purpose for the demo:
- auto-resolve or de-prioritize missed pickup complaints if the reported date does not match the zone schedule
- provide deterministic evidence from collection calendar rows
"""

from __future__ import annotations

import argparse
from pathlib import Path

from common_profile import DATA_DIR, OUTPUT_DIR, clean_columns, column_profile, parse_dates_inplace, read_csv, save_artifacts, value_counts


def truthy_collection(value: object) -> bool:
    return str(value).strip().upper() in {"T", "TRUE", "1", "Y", "YES"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DATA_DIR / "solid-waste" / "pickup-schedule-2026.csv")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    df = clean_columns(read_csv(args.input))
    date_stats = parse_dates_inplace(df, ["weekstarting"])

    collection_cols = [c for c in ["greenbin", "garbage", "recycling", "yardwaste", "christmastree"] if c in df.columns]
    for col in collection_cols:
        df[col + "_bool"] = df[col].map(truthy_collection)
    if collection_cols:
        df["active_stream_count"] = sum(df[col + "_bool"].astype(int) for col in collection_cols)

    overview = {
        "source_file": str(args.input),
        "rows": int(len(df)),
        "columns": list(df.columns),
        "date_stats": date_stats,
        "has_exact_lat_lon": False,
        "location_granularity": "Calendar/zone code only, not address geometry. Requires caller zone lookup or scripted demo zone selection.",
        "demo_feasibility": {
            "missed_garbage_auto_resolution": "MEDIUM/HIGH - excellent deterministic schedule table if demo supplies Calendar/zone",
            "geospatial_matching": "LOW - no address/lat/lon in this file",
            "citizen_response": "HIGH - easy to explain next pickup date and stream eligibility",
        },
    }

    profile = column_profile(df)
    sections: list[tuple[str, object]] = [
        ("Overview", overview),
        ("Column profile", profile),
        ("Top calendars", value_counts(df, "calendar", 50)),
    ]
    for col in collection_cols:
        sections.append((f"{col} collection flags", value_counts(df, col, 10)))

    sample_cols = [c for c in ["calendar", "weekstarting", "greenbin", "garbage", "recycling", "yardwaste", "christmastree", "active_stream_count"] if c in df.columns]
    samples = df[sample_cols].head(40)
    samples.to_csv(args.output_dir / "solid_waste_demo_candidates.csv", index=False)
    sections.append(("Sample schedule rows", samples))

    save_artifacts("solid_waste", profile, sections, args.output_dir)


if __name__ == "__main__":
    main()
