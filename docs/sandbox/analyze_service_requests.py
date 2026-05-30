#!/usr/bin/env python3
"""Profile 311 Service Requests - Customer Initiated (SR2026.csv).

Purpose for the demo:
- main historical corpus for embedding/vector duplicate detection
- category/section/division distributions for priority/scoring rules
- candidate low-priority schedulable work and duplicate-like clusters
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import pandas as pd

from common_profile import DATA_DIR, OUTPUT_DIR, clean_columns, column_profile, parse_dates_inplace, save_artifacts, value_counts


def read_service_requests_csv(path: Path) -> pd.DataFrame:
    """Read SR2026.csv while repairing known unquoted commas.

    The file has 9 logical columns, but values like "Environment, Climate &
    Forestry" are not quoted, causing ordinary CSV parsers to see 10 columns.
    The first 7 fields and final section field are stable, so any middle extras
    are joined back into the Division column.
    """
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
    df = pd.DataFrame(rows, columns=header)
    df.attrs["csv_repaired_rows"] = repaired
    df.attrs["csv_short_rows_padded"] = short
    return df


def classify_demo_bucket(service_type: str) -> str:
    text = str(service_type).lower()
    high = ["blocked", "flood", "sewer", "water", "hazard", "traffic signal", "debris on road", "sinkhole"]
    low = ["graffiti", "litter", "bin", "garbage", "waste", "sign", "pothole", "noise"]
    if any(k in text for k in high):
        return "potential_human_or_urgent"
    if any(k in text for k in low):
        return "potential_demo_low_priority"
    return "other"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DATA_DIR / "service-requests" / "SR2026.csv")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--sample", type=int, default=20)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    raw_df = read_service_requests_csv(args.input)
    csv_repaired_rows = raw_df.attrs.get("csv_repaired_rows", 0)
    csv_short_rows_padded = raw_df.attrs.get("csv_short_rows_padded", 0)
    df = clean_columns(raw_df)
    date_stats = parse_dates_inplace(df, ["creation_date"])

    if "service_request_type" in df.columns:
        df["demo_bucket"] = df["service_request_type"].map(classify_demo_bucket)

    overview = {
        "source_file": str(args.input),
        "rows": int(len(df)),
        "columns": list(df.columns),
        "date_stats": date_stats,
        "csv_repaired_rows": int(csv_repaired_rows),
        "csv_short_rows_padded": int(csv_short_rows_padded),
        "has_exact_lat_lon": False,
        "location_granularity": "Postal FSA / intersection fields only; useful for embeddings and category priors, weaker for meter-level geospatial matching.",
        "demo_feasibility": {
            "embedding_training_or_index": "HIGH - 190k+ textual/category records",
            "duplicate_detection": "MEDIUM - semantic duplicate demos possible, but precise distance is limited unless intersection fields are geocoded",
            "priority_priors": "HIGH - use service type/division/section/status/category frequency as deterministic features",
            "scheduling_locations": "LOW/MEDIUM - requires geocoding intersections or synthetic coordinates for demo operations",
        },
    }

    profile = column_profile(df)
    sections: list[tuple[str, object]] = [
        ("Overview", overview),
        ("Column profile", profile),
        ("Top service request types", value_counts(df, "service_request_type", 30)),
        ("Top divisions", value_counts(df, "division", 20)),
        ("Top sections", value_counts(df, "section", 20)),
        ("Top statuses", value_counts(df, "status", 20)),
        ("Demo buckets", value_counts(df, "demo_bucket", 20)),
    ]

    if "demo_bucket" in df.columns:
        sample_cols = [c for c in ["creation_date", "status", "first_3_chars_of_postal_code", "intersection_street_1", "intersection_street_2", "ward", "service_request_type", "division", "section", "demo_bucket"] if c in df.columns]
        samples = df[df["demo_bucket"] != "other"][sample_cols].head(args.sample)
        samples.to_csv(args.output_dir / "service_requests_demo_candidates.csv", index=False)
        sections.append(("Sample demo candidate records", samples))

    save_artifacts("service_requests", profile, sections, args.output_dir)


if __name__ == "__main__":
    main()
