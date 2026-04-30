"""
Run the ARC benchmark harness with the blinded dual-track solver.

Voice-readable behavior:
Give this script a folder of ARC JSON tasks. It runs the solver on each task, checks attempt one and attempt two against the public answer, and writes a result JSON. This is the file that turns solver claims into proof artifacts.

Example:
python engines/arc/run_public_benchmark.py --data-dir path/to/ARC-AGI-2/data/training --out reports/arc/training_result.json
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from engines.arc.benchmark_harness import run_benchmark
from engines.arc.blinded_dual_track_solver import solve_task_blinded


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, help="Folder containing ARC task JSON files.")
    parser.add_argument("--out", default="reports/arc/public_result.json", help="Where to write the result JSON.")
    args = parser.parse_args()

    result = run_benchmark(args.data_dir, args.out, solve_task_blinded)
    print("WROTE", args.out)
    print("items_total", result["items_total"])
    print("attempt1_correct", result["attempt1_correct"])
    print("attempt2_correct", result["attempt2_correct"])
    print("pass2_correct", result["pass2_correct"])
    print("pass2_accuracy", result["pass2_accuracy"])


if __name__ == "__main__":
    main()
