# sandbox outputs index

Description: Generated feasibility artifacts from sandbox profiling scripts.
Purpose: Quickly locate report and CSV outputs per dataset.

Components:
- `service_requests_report.md` + `service_requests_columns.csv` + `service_requests_demo_candidates.csv`
- `noise_exemptions_report.md` + `noise_exemptions_columns.csv` + `noise_exemptions_demo_candidates.csv`
- `utility_cuts_report.md` + `utility_cuts_columns.csv` + `utility_cuts_demo_candidates.csv`
- `solid_waste_report.md` + `solid_waste_columns.csv` + `solid_waste_demo_candidates.csv`
- `watermain_breaks_report.md` + `watermain_breaks_columns.csv` + `watermain_breaks_demo_candidates.csv`

Regenerate:
- `docs/sandbox/.venv/bin/python docs/sandbox/run_all_profiles.py`

Related Indexes:
- `../INDEX.md` - sandbox source scripts
