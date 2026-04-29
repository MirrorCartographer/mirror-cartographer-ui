import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from engines.arc.benchmark_harness import run_benchmark


def mini_solver(task):
    meta = task.get("meta", {})
    if "attempt_1" in meta and "attempt_2" in meta:
        return {
            "attempt_1": meta["attempt_1"],
            "attempt_2": meta["attempt_2"],
            "proof": {"solver": "mini_solver", "stop_quality": meta.get("stop_quality", "synthetic")},
        }
    test_input = task["test"][0]["input"]
    return {"attempt_1": test_input, "attempt_2": test_input, "proof": {"solver": "mini_solver"}}


def test_benchmark_counts_pass_at_two(tmp_path):
    tasks = tmp_path / "tasks"
    tasks.mkdir()

    (tasks / "task_a.json").write_text(json.dumps({
        "train": [],
        "test": [{"input": [[1]], "output": [[2]]}],
        "meta": {"attempt_1": [[2]], "attempt_2": [[3]], "stop_quality": "courtroom_correct"},
    }), encoding="utf-8")

    (tasks / "task_b.json").write_text(json.dumps({
        "train": [],
        "test": [{"input": [[4]], "output": [[5]]}],
        "meta": {"attempt_1": [[6]], "attempt_2": [[5]], "stop_quality": "native_correct"},
    }), encoding="utf-8")

    (tasks / "task_c.json").write_text(json.dumps({
        "train": [],
        "test": [{"input": [[7]], "output": [[8]]}],
        "meta": {"attempt_1": [[7]], "attempt_2": [[7]], "stop_quality": "bad_duplicate"},
    }), encoding="utf-8")

    result = run_benchmark(str(tasks), str(tmp_path / "result.json"), mini_solver)

    assert result["items_total"] == 3
    assert result["attempt1_correct"] == 1
    assert result["attempt2_correct"] == 1
    assert result["pass2_correct"] == 2
    assert result["pass2_accuracy"] == 2 / 3
    assert result["failure_count"] == 1
