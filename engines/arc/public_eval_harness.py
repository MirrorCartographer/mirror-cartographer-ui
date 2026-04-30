"""
ARC Cartographer public evaluation harness v8.

Voice-readable behavior:
This module is not a smarter solver. It is the official/public-task evaluation wrapper around the solver.

It can load ARC tasks from:
- a flat folder of one-task-per-file JSON files
- a challenge bundle keyed by task ID
- an optional separate solutions file for local scoring

It writes:
- pass-at-two submission-shaped JSON
- runtime and confidence logs
- failure-gallery records for public tasks with known outputs
- paper-track experiment logs

This is the bridge from toy-suite solving into reproducible public ARC evaluation.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
import datetime
import json
import time

Grid = List[List[int]]
Solver = Callable[[Dict[str, Any]], Dict[str, Any]]


@dataclass(frozen=True)
class RuntimeRecord:
    task_id: str
    seconds: float
    attempt_1_shape: Optional[Tuple[int, int]]
    attempt_2_shape: Optional[Tuple[int, int]]
    same_output: bool
    confidence_policy: str
    confidence_label: str
    error: Optional[str] = None


@dataclass(frozen=True)
class EvaluationSummary:
    dataset_label: str
    task_count: int
    solved_count: Optional[int]
    pass_at_two_accuracy: Optional[float]
    runtime_seconds_total: float
    runtime_seconds_mean: Optional[float]
    generated_at_utc: str
    claim_scope: str


def grid_shape(grid: Any) -> Optional[Tuple[int, int]]:
    if not isinstance(grid, list) or not grid:
        return None
    if not all(isinstance(row, list) for row in grid):
        return None
    return (len(grid), len(grid[0]) if grid[0] else 0)


def load_flat_task_dir(path: str) -> Dict[str, Dict[str, Any]]:
    root = Path(path)
    tasks: Dict[str, Dict[str, Any]] = {}
    for task_file in sorted(root.glob("*.json")):
        tasks[task_file.stem] = json.loads(task_file.read_text(encoding="utf-8"))
    return tasks


def load_challenge_bundle(path: str) -> Dict[str, Dict[str, Any]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Challenge bundle must be a JSON object keyed by task ID.")
    return payload


def load_tasks(path: str) -> Dict[str, Dict[str, Any]]:
    source = Path(path)
    if source.is_dir():
        return load_flat_task_dir(path)
    if source.is_file():
        payload = json.loads(source.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and "train" in payload and "test" in payload:
            return {source.stem: payload}
        if isinstance(payload, dict):
            return payload
    raise ValueError(f"Unsupported ARC task source: {path}")


def load_solutions(path: Optional[str]) -> Dict[str, Any]:
    if not path:
        return {}
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Solutions file must be a JSON object keyed by task ID.")
    return payload


def attach_solutions(tasks: Dict[str, Dict[str, Any]], solutions: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    if not solutions:
        return tasks
    attached = json.loads(json.dumps(tasks))
    for task_id, solution in solutions.items():
        if task_id not in attached:
            continue
        test_items = attached[task_id].setdefault("test", [])
        if isinstance(solution, list):
            for index, output in enumerate(solution):
                if index < len(test_items) and isinstance(test_items[index], dict):
                    test_items[index]["output"] = output
        elif isinstance(solution, dict) and "output" in solution and test_items:
            test_items[0]["output"] = solution["output"]
    return attached


def normalize_task_to_file(task_id: str, task: Dict[str, Any], out_dir: str) -> Path:
    root = Path(out_dir)
    root.mkdir(parents=True, exist_ok=True)
    path = root / f"{task_id}.json"
    path.write_text(json.dumps(task, indent=2), encoding="utf-8")
    return path


def normalize_challenge_bundle(tasks_path: str, out_dir: str) -> List[str]:
    tasks = load_tasks(tasks_path)
    written = []
    for task_id, task in sorted(tasks.items()):
        written.append(str(normalize_task_to_file(task_id, task, out_dir)))
    return written


def pass_at_two_prediction(attempt_1: Any, attempt_2: Any) -> List[Dict[str, Any]]:
    return [{"attempt_1": attempt_1, "attempt_2": attempt_2}]


def submission_from_predictions(predictions: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    submission: Dict[str, Any] = {}
    for task_id, solved in sorted(predictions.items()):
        submission[task_id] = pass_at_two_prediction(solved.get("attempt_1"), solved.get("attempt_2"))
    return submission


def confidence_label(solved: Dict[str, Any]) -> str:
    attempt_1 = solved.get("attempt_1")
    attempt_2 = solved.get("attempt_2")
    proof = solved.get("proof", {})
    audit = proof.get("audit", {}) if isinstance(proof, dict) else {}
    if attempt_1 == attempt_2:
        return "converged_same_output"
    if audit.get("same_output") is True:
        return "audit_converged"
    return "divergent_submit_both"


def exact_grid(a: Any, b: Any) -> bool:
    return a == b


def expected_outputs_for_task(task: Dict[str, Any]) -> List[Any]:
    outputs = []
    for item in task.get("test", []):
        if isinstance(item, dict) and "output" in item:
            outputs.append(item["output"])
    return outputs


def score_prediction(task: Dict[str, Any], solved: Dict[str, Any]) -> Optional[bool]:
    expected = expected_outputs_for_task(task)
    if not expected:
        return None
    # Current solver supports one test output. Keep interface explicit.
    target = expected[0]
    return exact_grid(solved.get("attempt_1"), target) or exact_grid(solved.get("attempt_2"), target)


def evaluate_public_tasks(
    *,
    tasks_path: str,
    solver: Solver,
    out_submission: str,
    out_runtime: str,
    out_experiment: str,
    solutions_path: Optional[str] = None,
    dataset_label: str = "public_arc_eval",
    confidence_policy: str = "If attempts converge, submit duplicate confidence; if divergent, submit both.",
) -> Dict[str, Any]:
    raw_tasks = load_tasks(tasks_path)
    tasks = attach_solutions(raw_tasks, load_solutions(solutions_path))
    predictions: Dict[str, Dict[str, Any]] = {}
    runtime_records: List[RuntimeRecord] = []
    failure_gallery: List[Dict[str, Any]] = []

    started_all = time.perf_counter()
    solved_count = 0
    scored_count = 0

    for task_id, task in sorted(tasks.items()):
        started = time.perf_counter()
        error = None
        try:
            solved = solver(task)
        except Exception as exc:
            solved = {"attempt_1": None, "attempt_2": None, "proof": {"error": str(exc)}}
            error = str(exc)
        seconds = time.perf_counter() - started
        predictions[task_id] = solved

        score = score_prediction(task, solved)
        if score is not None:
            scored_count += 1
            solved_count += int(score)
            if not score:
                failure_gallery.append({
                    "task_id": task_id,
                    "failure_label": "wrong_public_output",
                    "confidence_label": confidence_label(solved),
                    "attempt_1_shape": grid_shape(solved.get("attempt_1")),
                    "attempt_2_shape": grid_shape(solved.get("attempt_2")),
                })

        runtime_records.append(RuntimeRecord(
            task_id=task_id,
            seconds=seconds,
            attempt_1_shape=grid_shape(solved.get("attempt_1")),
            attempt_2_shape=grid_shape(solved.get("attempt_2")),
            same_output=solved.get("attempt_1") == solved.get("attempt_2"),
            confidence_policy=confidence_policy,
            confidence_label=confidence_label(solved),
            error=error,
        ))

    total_seconds = time.perf_counter() - started_all
    accuracy = solved_count / scored_count if scored_count else None
    summary = EvaluationSummary(
        dataset_label=dataset_label,
        task_count=len(tasks),
        solved_count=solved_count if scored_count else None,
        pass_at_two_accuracy=accuracy,
        runtime_seconds_total=total_seconds,
        runtime_seconds_mean=total_seconds / len(tasks) if tasks else None,
        generated_at_utc=datetime.datetime.now(datetime.UTC).isoformat(),
        claim_scope="Valid only for supplied tasks, supplied solutions if any, and the solver commit used for this run.",
    )

    submission = submission_from_predictions(predictions)
    Path(out_submission).parent.mkdir(parents=True, exist_ok=True)
    Path(out_submission).write_text(json.dumps(submission, indent=2), encoding="utf-8")

    runtime_payload = {
        "summary": asdict(summary),
        "runtime_records": [asdict(record) for record in runtime_records],
        "failure_gallery": failure_gallery,
    }
    Path(out_runtime).parent.mkdir(parents=True, exist_ok=True)
    Path(out_runtime).write_text(json.dumps(runtime_payload, indent=2), encoding="utf-8")

    experiment = render_experiment_log(summary, out_submission, out_runtime, solutions_path, len(failure_gallery))
    Path(out_experiment).parent.mkdir(parents=True, exist_ok=True)
    Path(out_experiment).write_text(experiment, encoding="utf-8")

    return {
        "summary": asdict(summary),
        "submission_path": out_submission,
        "runtime_path": out_runtime,
        "experiment_path": out_experiment,
        "failure_count": len(failure_gallery),
    }


def render_experiment_log(summary: EvaluationSummary, submission_path: str, runtime_path: str, solutions_path: Optional[str], failure_count: int) -> str:
    score_line = "unscored: no solutions supplied"
    if summary.pass_at_two_accuracy is not None:
        score_line = f"{summary.solved_count}/{summary.task_count} pass-at-two, accuracy {summary.pass_at_two_accuracy:.4f}"
    return f"""# ARC Public Evaluation Experiment

## Summary

Dataset label: {summary.dataset_label}

Task count: {summary.task_count}

Score: {score_line}

Runtime total seconds: {summary.runtime_seconds_total:.6f}

Runtime mean seconds: {summary.runtime_seconds_mean if summary.runtime_seconds_mean is not None else 'n/a'}

Failure gallery count: {failure_count}

## Files

Submission JSON: `{submission_path}`

Runtime JSON: `{runtime_path}`

Solutions supplied: {bool(solutions_path)}

## Claim boundary

{summary.claim_scope}

This experiment log is paper-track evidence only when paired with the exact code commit and generated output files.
"""
