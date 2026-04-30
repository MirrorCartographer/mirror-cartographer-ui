import json
from pathlib import Path

from engines.arc.public_eval_harness import (
    attach_solutions,
    evaluate_public_tasks,
    load_tasks,
    normalize_challenge_bundle,
    submission_from_predictions,
)


def identity_solver(task):
    test_input = task["test"][0]["input"]
    return {
        "attempt_1": test_input,
        "attempt_2": test_input,
        "proof": {"solver": "identity_test_solver", "audit": {"same_output": True}},
    }


def test_load_tasks_accepts_challenge_bundle(tmp_path: Path):
    bundle = {
        "task_a": {"train": [], "test": [{"input": [[1]]}]},
        "task_b": {"train": [], "test": [{"input": [[2]]}]},
    }
    path = tmp_path / "challenges.json"
    path.write_text(json.dumps(bundle), encoding="utf-8")

    tasks = load_tasks(str(path))

    assert sorted(tasks) == ["task_a", "task_b"]


def test_attach_solutions_adds_public_outputs():
    tasks = {"task_a": {"train": [], "test": [{"input": [[1]]}]}}
    solutions = {"task_a": [[[1]]]}

    attached = attach_solutions(tasks, solutions)

    assert attached["task_a"]["test"][0]["output"] == [[1]]


def test_submission_from_predictions_is_pass_at_two_shaped():
    submission = submission_from_predictions({
        "task_a": {"attempt_1": [[1]], "attempt_2": [[2]]}
    })

    assert submission == {"task_a": [{"attempt_1": [[1]], "attempt_2": [[2]]}]}


def test_normalize_challenge_bundle_writes_one_task_per_file(tmp_path: Path):
    bundle = {"task_a": {"train": [], "test": [{"input": [[1]]}]}}
    source = tmp_path / "bundle.json"
    out_dir = tmp_path / "normalized"
    source.write_text(json.dumps(bundle), encoding="utf-8")

    written = normalize_challenge_bundle(str(source), str(out_dir))

    assert len(written) == 1
    assert Path(written[0]).name == "task_a.json"
    assert json.loads(Path(written[0]).read_text(encoding="utf-8"))["test"][0]["input"] == [[1]]


def test_evaluate_public_tasks_writes_submission_runtime_and_experiment(tmp_path: Path):
    bundle = {"task_a": {"train": [], "test": [{"input": [[1]]}]}}
    solutions = {"task_a": [[[1]]]}
    tasks_path = tmp_path / "challenges.json"
    solutions_path = tmp_path / "solutions.json"
    submission_path = tmp_path / "submission.json"
    runtime_path = tmp_path / "runtime.json"
    experiment_path = tmp_path / "experiment.md"
    tasks_path.write_text(json.dumps(bundle), encoding="utf-8")
    solutions_path.write_text(json.dumps(solutions), encoding="utf-8")

    result = evaluate_public_tasks(
        tasks_path=str(tasks_path),
        solutions_path=str(solutions_path),
        solver=identity_solver,
        out_submission=str(submission_path),
        out_runtime=str(runtime_path),
        out_experiment=str(experiment_path),
        dataset_label="unit_public_eval",
    )

    assert result["summary"]["task_count"] == 1
    assert result["summary"]["solved_count"] == 1
    assert result["summary"]["pass_at_two_accuracy"] == 1.0
    assert submission_path.exists()
    assert runtime_path.exists()
    assert experiment_path.exists()
    assert "ARC Public Evaluation Experiment" in experiment_path.read_text(encoding="utf-8")
