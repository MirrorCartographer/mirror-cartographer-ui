"""
Mirror Cartographer ARC benchmark harness.

Voice-readable behavior:
This file loads ARC-style JSON tasks from a folder, runs a solver, compares attempt one and attempt two against known public outputs, and writes a result JSON. It proves benchmark mechanics only when run on a dataset. It does not prove ARC accuracy by existing.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Dict, List
import datetime
import hashlib
import json
import traceback

Grid = List[List[int]]


def stable_hash_obj(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def load_tasks_from_dir(data_dir: str) -> Dict[str, Dict[str, Any]]:
    root = Path(data_dir)
    tasks: Dict[str, Dict[str, Any]] = {}
    for path in sorted(root.glob("*.json")):
        with open(path, "r", encoding="utf-8") as f:
            tasks[path.stem] = json.load(f)
    return tasks


def exact_grid(a: Any, b: Any) -> bool:
    return a == b


def default_failure_label(proof: Dict[str, Any], expected: Grid, attempt_1: Grid, attempt_2: Grid) -> str:
    if attempt_1 == attempt_2:
        return "duplicate_wrong_attempts"
    audit = proof.get("audit", {}) if isinstance(proof, dict) else {}
    quality = audit.get("convergence_quality") or proof.get("stop_quality")
    if quality and "convergence" in str(quality):
        return "false_convergence"
    if quality and "divergence" in str(quality):
        return "divergence_both_wrong"
    return "unclassified_wrong_output"


def benchmark_solver(tasks: Dict[str, Dict[str, Any]], solver: Callable[[Dict[str, Any]], Dict[str, Any]]) -> Dict[str, Any]:
    items_total = 0
    pass2_correct = 0
    attempt1_correct = 0
    attempt2_correct = 0
    convergence_total = 0
    convergence_correct = 0
    failures = []
    per_task = {}

    for task_id, task in tasks.items():
        try:
            solved = solver(task)
        except Exception as e:
            failures.append({
                "task_id": task_id,
                "error": str(e),
                "traceback": traceback.format_exc(),
                "failure_label": "solver_exception",
            })
            continue

        test_items = task.get("test", [])
        if not test_items:
            continue

        expected = test_items[0].get("output")
        if expected is None:
            failures.append({"task_id": task_id, "failure_label": "missing_public_output"})
            continue

        a1 = solved.get("attempt_1")
        a2 = solved.get("attempt_2")
        proof = solved.get("proof", {})

        items_total += 1
        c1 = exact_grid(a1, expected)
        c2 = exact_grid(a2, expected)
        cp = c1 or c2
        same = a1 == a2

        attempt1_correct += int(c1)
        attempt2_correct += int(c2)
        pass2_correct += int(cp)
        convergence_total += int(same)
        convergence_correct += int(same and cp)

        record = {
            "task_id": task_id,
            "attempt_1_correct": c1,
            "attempt_2_correct": c2,
            "pass2_correct": cp,
            "same_output": same,
            "expected_hash": stable_hash_obj(expected),
            "attempt_1_hash": stable_hash_obj(a1),
            "attempt_2_hash": stable_hash_obj(a2),
            "proof_summary": proof,
        }
        if not cp:
            record["failure_label"] = default_failure_label(proof, expected, a1, a2)
            failures.append(record)

        per_task[task_id] = record

    return {
        "timestamp_utc": datetime.datetime.now(datetime.UTC).isoformat(),
        "items_total": items_total,
        "attempt1_correct": attempt1_correct,
        "attempt2_correct": attempt2_correct,
        "pass2_correct": pass2_correct,
        "attempt1_accuracy": attempt1_correct / items_total if items_total else None,
        "attempt2_accuracy": attempt2_correct / items_total if items_total else None,
        "pass2_accuracy": pass2_correct / items_total if items_total else None,
        "convergence_total": convergence_total,
        "convergence_correct": convergence_correct,
        "convergence_accuracy": convergence_correct / convergence_total if convergence_total else None,
        "failure_count": len(failures),
        "failures": failures,
        "per_task": per_task,
        "claim_scope": "Valid only for the supplied local dataset and solver version.",
    }


def write_result(result: Dict[str, Any], out_path: str) -> None:
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)


def run_benchmark(data_dir: str, out_path: str, solver: Callable[[Dict[str, Any]], Dict[str, Any]]) -> Dict[str, Any]:
    tasks = load_tasks_from_dir(data_dir)
    result = benchmark_solver(tasks, solver)
    result["dataset_path"] = data_dir
    result["task_count"] = len(tasks)
    write_result(result, out_path)
    return result
