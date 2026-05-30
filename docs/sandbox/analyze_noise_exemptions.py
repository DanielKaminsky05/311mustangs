#!/usr/bin/env python3
"""Profile Noise Exemption Permits.

Purpose for the demo:
- auto-resolve construction/noise complaints when a permit covers the location/time
- escalate bylaw/noise complaints when no permit is found
"""

from __future__ import annotations

import argparse
from pathlib import Path

from common_profile import DATA_DIR, OUTPUT_DIR, clean_columns, column_profile, parse_dates_inplace, read_csv, save_artifacts, value_counts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DATA_DIR / "noise-exemptions" / "Noise Exemption Permits - January 1 2024 to May 20 2025.csv")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--sample", type=int, default=25)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    df = clean_columns(read_csv(args.input))
    date_stats = parse_dates_inplace(df, ["issue_date", "expected_end_date", "actual_end_date"])

    if "address" in df.columns:
        df["has_address"] = df["address"].notna() & (df["address"].astype(str).str.strip() != "")
    if {"issue_date__parsed", "expected_end_date__parsed"}.issubset(df.columns):
        df["permit_window_days"] = (df["expected_end_date__parsed"] - df["issue_date__parsed"]).dt.days

    overview = {
        "source_file": str(args.input),
        "rows": int(len(df)),
        "columns": list(df.columns),
        "date_stats": date_stats,
        "has_exact_lat_lon": False,
        "location_granularity": "Street address only; geocoding needed for meter-level matching, but address/name matching is enough for scripted demo cases.",
        "demo_feasibility": {
            "noise_auto_resolution": "HIGH - permit type/address/date window directly supports evidence-backed auto-resolve",
            "bylaw_escalation_without_permit": "HIGH - negative lookup can escalate if no active permit matches",
            "scheduling_constraints": "MEDIUM - date window useful; hours_of_operation/public_conditions sparse must be checked",
        },
    }

    profile = column_profile(df)
    sections: list[tuple[str, object]] = [
        ("Overview", overview),
        ("Column profile", profile),
        ("Top permit types", value_counts(df, "permit_type", 30)),
        ("Top wards", value_counts(df, "ward", 30)),
        ("Rows with address", value_counts(df, "has_address", 5)),
        ("Top operating names", value_counts(df, "operating_name", 20)),
    ]

    sample_cols = [c for c in ["licence_number", "permit_type", "operating_name", "client_name", "address", "ward", "issue_date", "expected_end_date", "actual_end_date", "hours_of_operation", "public_conditions"] if c in df.columns]
    useful = df[df.get("has_address", True)][sample_cols].head(args.sample)
    useful.to_csv(args.output_dir / "noise_exemptions_demo_candidates.csv", index=False)
    sections.append(("Sample permit demo candidates", useful))

    save_artifacts("noise_exemptions", profile, sections, args.output_dir)


if __name__ == "__main__":
    main()
