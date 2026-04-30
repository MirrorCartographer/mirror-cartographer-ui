from engines.arc.blinded_dual_track_solver import solve_task_blinded


def test_blinded_tracks_independently_converge_on_color_transfer():
    task = {
        "train": [
            {"input": [[1, 0], [0, 1]], "output": [[2, 0], [0, 2]]},
            {"input": [[1, 1], [0, 0]], "output": [[2, 2], [0, 0]]},
        ],
        "test": [{"input": [[0, 1], [1, 0]], "output": [[0, 2], [2, 0]]}],
    }

    result = solve_task_blinded(task)

    assert result["attempt_1"] == [[0, 2], [2, 0]]
    assert result["attempt_2"] == [[0, 2], [2, 0]]
    assert result["proof"]["audit"]["same_output"] is True
    assert result["proof"]["audit"]["both_tracks_blinded_before_lock"] is True
    assert result["proof"]["audit_events"][0]["event"] == "hostile_track_locked"
    assert result["proof"]["audit_events"][1]["event"] == "native_track_locked"
    assert result["proof"]["audit_events"][2]["event"] == "post_lock_convergence_audit"


def test_blinded_tracks_can_diverge_without_contamination():
    task = {
        "train": [
            {"input": [[1, 0, 0], [0, 0, 0], [0, 0, 0]], "output": [[0, 0, 1], [0, 0, 0], [0, 0, 0]]},
            {"input": [[2, 0, 0], [0, 0, 0], [0, 0, 0]], "output": [[0, 0, 2], [0, 0, 0], [0, 0, 0]]},
        ],
        "test": [{"input": [[3, 0, 0], [0, 0, 0], [0, 0, 0]], "output": [[0, 0, 3], [0, 0, 0], [0, 0, 0]]}],
    }

    result = solve_task_blinded(task)

    assert result["proof"]["audit"]["both_tracks_blinded_before_lock"] is True
    assert result["proof"]["audit_events"][0]["event"] == "hostile_track_locked"
    assert result["proof"]["audit_events"][1]["event"] == "native_track_locked"
    assert result["proof"]["audit_events"][2]["event"] == "post_lock_convergence_audit"
