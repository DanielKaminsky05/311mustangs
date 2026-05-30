#!/usr/bin/env python3
"""Profile Utility Cut Permits.

Purpose for the demo:
- scheduling conflict/avoidance layer: do not send a crew into active construction/utility work
- evidence for delaying or rerouting low-priority operations
"""

from __future__ import annotations

import argparse
from pathlib import Path

from common_profile import DATA_DIR, OUTPUT_DIR, clean_columns, column_profile, parse_dates_inplace, read_csv, save_artifacts, value_counts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DATA_DIR / "util-cuts" / "Utility Cut Permits Data.csv")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--sample", type=int, default=25)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    df = clean_columns(read_csv(args.input))
    date_stats = parse_dates_inplace(df, ["proposed_from_date", "proposed_to_date"])

    if {"proposed_from_date__parsed", "proposed_to_date__parsed"}.issubset(df.columns):
        df["permit_window_days"] = (df["proposed_to_date__parsed"] - df["proposed_from_date__parsed"]).dt.days
    if "display_desc" in df.columns:
        df["has_display_location"] = df["display_desc"].notna() & (df["display_desc"].astype(str).str.strip() != "")

    overview = {
        "source_file": str(args.input),
        "rows": int(len(df)),
        "columns": list(df.columns),
        "date_stats": date_stats,
        "has_exact_lat_lon": False,
        "location_granularity": "GEO_ID plus DISPLAY_DESC street segment; no lat/lon in CSV. Good for address/street conflict demos, needs geocoding for spatial joins.",
        "demo_feasibility": {
            "scheduling_conflicts": "HIGH - rich permit date windows and street segment descriptions",
            "graph_dependencies": "HIGH - can create BLOCKED_BY_UTILITY_CUT edges from active permits",
            "route_avoidance": "MEDIUM - exact coordinates require geocoding or synthetic demo coordinate assignment",
        },
    }

    profile = column_profile(df)
    sections: list[tuple[str, object]] = [
        ("Overview", overview),
        ("Column profile", profile),
        ("Top permit statuses", value_counts(df, "permit_status", 20)),
        ("Top installation types", value_counts(df, "installation_type_desc", 30)),
        ("Top wards", value_counts(df, "city_ward", 30)),
        ("Top districts", value_counts(df, "district", 20)),
        ("Rows with display location", value_counts(df, "has_display_location", 5)),
    ]

    sample_cols = [c for c in ["permit_number", "proposed_from_date", "proposed_to_date", "client_name", "geo_id", "display_desc", "permit_status", "installation_type_desc", "city_ward", "district", "permit_window_days"] if c in df.columns]
    useful = df[df.get("has_display_location", True)][sample_cols].head(args.sample)
    useful.to_csv(args.output_dir / "utility_cuts_demo_candidates.csv", index=False)
    sections.append(("Sample conflict demo candidates", useful))

    save_artifacts("utility_cuts", profile, sections, args.output_dir)


if __name__ == "__main__":
    main()
