"""
Command-line wrapper for ARC public evaluation harness v8.

Voice-readable behavior:
Use this to run the current solver on a flat folder, a single task JSON, or a challenge-bundle JSON. It writes a pass-at-two submission JSON, runtime log, and paper experiment log.

Example:
python engines/arc/run_public_eval.py --tasks data/challenges.json --solutions data/solutions.json --submission out/submission.json --runtime out/runtime.json --experiment out/experiment.md
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from engines.arc.blinded_dual_track_solver_v3 import solve_task_blinded_v3
from engines.arc.public_eval_harness import evaluate_public_tasks, normalize_challenge_bundle


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tasks", required=True)
    parser.add_argument("--solutions", default=None)
    parser.add_argument("--submission", default="out/arc_submission.json")
    parser.add_argument("--runtime", default="out/arc_runtime.json")
    parser.add_argument("--experiment", default="out/arc_experiment.md")
    parser.add_argument("--dataset-label", default="public_arc_eval")
    parser.add_argument("--adapt-out", default=None, help="Optional output folder for one-task-per-file normalized tasks.")
    args = parser.parse_args()

    if args.adapt_out:
        written = normalize_challenge_bundle(args.tasks, args.adapt_out)
        print("ADAPTED", len(written), "tasks into", args.adapt_out)

    result = evaluate_public_tasks(
        tasks_path=args.tasks,
        solutions_path=args.solutions,
        solver=solve_task_blinded_v3,
        out_submission=args.submission,
        out_runtime=args.runtime,
        out_experiment=args.experiment,
        dataset_label=args.dataset_label,
    )

    print("WROTE", result["submission_path"])
    print("WROTE", result["runtime_path"])
    print("WROTE", result["experiment_path"])
    print("SUMMARY", result["summary"])


if __name__ == "__main__":
    main()
