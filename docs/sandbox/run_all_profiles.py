#!/usr/bin/env python3
"""Run all dataset feasibility profilers."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS = [
    "analyze_service_requests.py",
    "analyze_noise_exemptions.py",
    "analyze_utility_cuts.py",
    "analyze_solid_waste.py",
    "analyze_watermain_breaks.py",
]


def main() -> None:
    here = Path(__file__).resolve().parent
    for script in SCRIPTS:
        print(f"\n=== Running {script} ===", flush=True)
        subprocess.run([sys.executable, str(here / script)], check=True)


if __name__ == "__main__":
    main()
