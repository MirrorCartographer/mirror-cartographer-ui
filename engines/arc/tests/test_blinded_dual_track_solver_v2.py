from engines.arc.blinded_dual_track_solver_v2 import (
    alternating_tile_2x2_to_6x6,
    self_mask_expand,
    solve_task_blinded_v2,
)


def test_alternating_tile_2x2_to_6x6_matches_smoke_task_00576224():
    assert alternating_tile_2x2_to_6x6([[3, 2], [7, 8]]) == [
        [3, 2, 3, 2, 3, 2],
        [7, 8, 7, 8, 7, 8],
        [2, 3, 2, 3, 2, 3],
        [8, 7, 8, 7, 8, 7],
        [3, 2, 3, 2, 3, 2],
        [7, 8, 7, 8, 7, 8],
    ]


def test_self_mask_expand_matches_smoke_task_007bbfb7():
    assert self_mask_expand([[7, 0, 7], [7, 0, 7], [7, 7, 0]]) == [
        [7, 0, 7, 0, 0, 0, 7, 0, 7],
        [7, 0, 7, 0, 0, 0, 7, 0, 7],
        [7, 7, 0, 0, 0, 0, 7, 7, 0],
        [7, 0, 7, 0, 0, 0, 7, 0, 7],
        [7, 0, 7, 0, 0, 0, 7, 0, 7],
        [7, 7, 0, 0, 0, 0, 7, 7, 0],
        [7, 0, 7, 7, 0, 7, 0, 0, 0],
        [7, 0, 7, 7, 0, 7, 0, 0, 0],
        [7, 7, 0, 7, 7, 0, 0, 0, 0],
    ]


def test_solver_v2_solves_00576224_style_task():
    task = {
        "train": [
            {
                "input": [[7, 9], [4, 3]],
                "output": [
                    [7, 9, 7, 9, 7, 9],
                    [4, 3, 4, 3, 4, 3],
                    [9, 7, 9, 7, 9, 7],
                    [3, 4, 3, 4, 3, 4],
                    [7, 9, 7, 9, 7, 9],
                    [4, 3, 4, 3, 4, 3],
                ],
            },
            {
                "input": [[8, 6], [6, 4]],
                "output": [
                    [8, 6, 8, 6, 8, 6],
                    [6, 4, 6, 4, 6, 4],
                    [6, 8, 6, 8, 6, 8],
                    [4, 6, 4, 6, 4, 6],
                    [8, 6, 8, 6, 8, 6],
                    [6, 4, 6, 4, 6, 4],
                ],
            },
        ],
        "test": [{
            "input": [[3, 2], [7, 8]],
            "output": [
                [3, 2, 3, 2, 3, 2],
                [7, 8, 7, 8, 7, 8],
                [2, 3, 2, 3, 2, 3],
                [8, 7, 8, 7, 8, 7],
                [3, 2, 3, 2, 3, 2],
                [7, 8, 7, 8, 7, 8],
            ],
        }],
    }
    result = solve_task_blinded_v2(task)
    assert result["attempt_1"] == task["test"][0]["output"]
    assert result["attempt_2"] == task["test"][0]["output"]
    assert result["proof"]["audit"]["same_output"] is True


def test_solver_v2_solves_007bbfb7_style_task():
    task = {
        "train": [
            {
                "input": [[6, 6, 0], [6, 0, 0], [0, 6, 6]],
                "output": self_mask_expand([[6, 6, 0], [6, 0, 0], [0, 6, 6]]),
            },
            {
                "input": [[4, 0, 4], [0, 0, 0], [0, 4, 0]],
                "output": self_mask_expand([[4, 0, 4], [0, 0, 0], [0, 4, 0]]),
            },
        ],
        "test": [{
            "input": [[7, 0, 7], [7, 0, 7], [7, 7, 0]],
            "output": self_mask_expand([[7, 0, 7], [7, 0, 7], [7, 7, 0]]),
        }],
    }
    result = solve_task_blinded_v2(task)
    assert result["attempt_1"] == task["test"][0]["output"]
    assert result["attempt_2"] == task["test"][0]["output"]
    assert result["proof"]["audit"]["same_output"] is True
