# Sandbox Output Reports Index

Generated feasibility reports from the dataset profiling scripts.

## Reports

- [Service Requests](./outputs/service_requests_report.md) — 311 Service Requests corpus feasibility, columns, category distributions, and demo candidates.
- [Noise Exemptions](./outputs/noise_exemptions_report.md) — Noise exemption permit feasibility for noise complaint auto-resolution/escalation.
- [Utility Cuts](./outputs/utility_cuts_report.md) — Utility cut permit feasibility for scheduling conflicts and graph dependency constraints.
- [Solid Waste](./outputs/solid_waste_report.md) — Solid waste pickup schedule feasibility for missed collection auto-resolution.
- [Watermain Breaks](./outputs/watermain_breaks_report.md) — Watermain break geospatial feasibility for known-issue matching and flooded street demos.

## Companion CSV artifacts

Each report also has generated CSV artifacts in [`outputs/`](./outputs/):

- `*_columns.csv` — column-level completeness/profile
- `*_demo_candidates.csv` — sample rows likely useful for scripted demo cases

## Regenerate

From the repo root:

```bash
docs/sandbox/.venv/bin/python docs/sandbox/run_all_profiles.py
```
