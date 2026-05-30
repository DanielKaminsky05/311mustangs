# Data sandbox profilers

Rerunnable Python scripts for gauging feasibility of each Toronto Open Data source in `docs/data/`.

Use the local venv:

```bash
docs/sandbox/.venv/bin/python docs/sandbox/run_all_profiles.py
```

Or run one source at a time:

```bash
docs/sandbox/.venv/bin/python docs/sandbox/analyze_service_requests.py
docs/sandbox/.venv/bin/python docs/sandbox/analyze_noise_exemptions.py
docs/sandbox/.venv/bin/python docs/sandbox/analyze_utility_cuts.py
docs/sandbox/.venv/bin/python docs/sandbox/analyze_solid_waste.py
docs/sandbox/.venv/bin/python docs/sandbox/analyze_watermain_breaks.py
```

Outputs are written to `docs/sandbox/outputs/`:

- `*_report.md`: human-readable feasibility report
- `*_columns.csv`: column completeness/profile
- `*_demo_candidates.csv`: sample rows that look useful for demo cases

No extra dependencies are required beyond the existing `numpy` and `pandas` venv. The watermain script reads the DBF directly with Python stdlib. If later you need shapefile geometry beyond the DBF `POINT_X`/`POINT_Y` fields, install `pyshp`.
