from __future__ import annotations

import argparse
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from engines.arc.benchmark_harness import run_benchmark
from engines.arc.blinded_dual_track_solver_v2 import solve_task_blinded_v2


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--out", default="reports/arc/result.json")
    args = parser.parse_args()

    result = run_benchmark(args.data_dir, args.out, solve_task_blinded_v2)
    print("WROTE", args.out)
    print("items_total", result["items_total"])
    print("attempt1_correct", result["attempt1_correct"])
    print("attempt2_correct", result["attempt2_correct"])
    print("pass2_correct", result["pass2_correct"])
    print("pass2_accuracy", result["pass2_accuracy"])


if __name__ == "__main__":
    main()
