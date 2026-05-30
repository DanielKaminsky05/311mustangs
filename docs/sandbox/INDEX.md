# sandbox index

Description: Local Python sandbox for profiling Toronto Open Data feeds used by the demo.
Purpose: Recompute lightweight feasibility artifacts that inform dataset selection and demo scenarios.

Components:
- `README.md` — how to run one or all profilers with the local venv.
- `common_profile.py` — shared IO/profiling/report helpers; reads from `docs/data` and writes to `docs/sandbox/outputs`.
- `run_all_profiles.py` — batch runner for all per-dataset profiling scripts.
- `analyze_service_requests.py` — 311 service-request feasibility profiling.
- `analyze_noise_exemptions.py` — noise-exemption dataset profiling.
- `analyze_utility_cuts.py` — utility-cut dataset profiling.
- `analyze_solid_waste.py` — solid-waste dataset profiling.
- `analyze_watermain_breaks.py` — watermain-break DBF profiling.
- `outputs/` — generated reports and companion CSV artifacts.

Important boundaries:
- `.venv/` and `__pycache__/` are local/runtime artifacts and should not be indexed or treated as source.

Related Indexes:
- `../INDEX.md` - top-level docs navigation
- `outputs/INDEX.md` - generated artifact map
