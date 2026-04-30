from engines.arc.blinded_dual_track_solver_v5 import (
    fill_enclosed_background,
    make_enclosed_background_fill_rule,
    solve_task_blinded_v5,
)


def test_fill_enclosed_background_fills_only_trapped_cells():
    grid = [
        [0, 0, 0, 0, 0],
        [0, 3, 3, 3, 0],
        [0, 3, 0, 3, 0],
        [0, 3, 3, 3, 0],
        [0, 0, 0, 0, 0],
    ]

    assert fill_enclosed_background(grid, fill_color=4) == [
        [0, 0, 0, 0, 0],
        [0, 3, 3, 3, 0],
        [0, 3, 4, 3, 0],
        [0, 3, 3, 3, 0],
        [0, 0, 0, 0, 0],
    ]


def test_make_enclosed_background_fill_rule_learns_fill_color():
    train = [
        {
            "input": [
                [0, 0, 0, 0, 0],
                [0, 3, 3, 3, 0],
                [0, 3, 0, 3, 0],
                [0, 3, 3, 3, 0],
                [0, 0, 0, 0, 0],
            ],
            "output": [
                [0, 0, 0, 0, 0],
                [0, 3, 3, 3, 0],
                [0, 3, 4, 3, 0],
                [0, 3, 3, 3, 0],
                [0, 0, 0, 0, 0],
            ],
        }
    ]
    rule = make_enclosed_background_fill_rule(train)
    assert rule is not None
    assert rule([
        [0, 0, 0, 0, 0, 0],
        [0, 3, 3, 3, 3, 0],
        [0, 3, 0, 0, 3, 0],
        [0, 3, 3, 3, 3, 0],
        [0, 0, 0, 0, 0, 0],
    ]) == [
        [0, 0, 0, 0, 0, 0],
        [0, 3, 3, 3, 3, 0],
        [0, 3, 4, 4, 3, 0],
        [0, 3, 3, 3, 3, 0],
        [0, 0, 0, 0, 0, 0],
    ]


def test_solver_v5_solves_00d62c1b_style_task():
    task = {
        "train": [
            {
                "input": [
                    [0, 0, 0, 0, 0],
                    [0, 3, 3, 3, 0],
                    [0, 3, 0, 3, 0],
                    [0, 3, 3, 3, 0],
                    [0, 0, 0, 0, 0],
                ],
                "output": [
                    [0, 0, 0, 0, 0],
                    [0, 3, 3, 3, 0],
                    [0, 3, 4, 3, 0],
                    [0, 3, 3, 3, 0],
                    [0, 0, 0, 0, 0],
                ],
            },
            {
                "input": [
                    [0, 0, 0, 0, 0, 0],
                    [0, 3, 3, 3, 3, 0],
                    [0, 3, 0, 0, 3, 0],
                    [0, 3, 3, 3, 3, 0],
                    [0, 0, 0, 0, 0, 0],
                ],
                "output": [
                    [0, 0, 0, 0, 0, 0],
                    [0, 3, 3, 3, 3, 0],
                    [0, 3, 4, 4, 3, 0],
                    [0, 3, 3, 3, 3, 0],
                    [0, 0, 0, 0, 0, 0],
                ],
            },
        ],
        "test": [{
            "input": [
                [0, 0, 0, 0, 0, 0],
                [0, 3, 3, 3, 3, 0],
                [0, 3, 0, 0, 3, 0],
                [0, 3, 0, 0, 3, 0],
                [0, 3, 3, 3, 3, 0],
                [0, 0, 0, 0, 0, 0],
            ],
            "output": [
                [0, 0, 0, 0, 0, 0],
                [0, 3, 3, 3, 3, 0],
                [0, 3, 4, 4, 3, 0],
                [0, 3, 4, 4, 3, 0],
                [0, 3, 3, 3, 3, 0],
                [0, 0, 0, 0, 0, 0],
            ],
        }],
    }
    result = solve_task_blinded_v5(task)
    assert result["attempt_1"] == task["test"][0]["output"]
    assert result["attempt_2"] == task["test"][0]["output"]
    assert result["proof"]["audit"]["same_output"] is True
