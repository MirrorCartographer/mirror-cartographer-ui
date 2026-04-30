from engines.arc.blinded_dual_track_solver_v3 import (
    make_marker_shape_keyed_recolor_rule,
    solve_task_blinded_v3,
)


def test_marker_shape_keyed_recolor_rule_maps_marker_to_output_color():
    train = [
        {
            "input": [
                [0, 8, 8, 0],
                [0, 8, 0, 0],
                [0, 0, 0, 0],
                [0, 1, 1, 1],
                [0, 1, 0, 1],
                [0, 0, 1, 0],
            ],
            "output": [
                [0, 7, 7, 0],
                [0, 7, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ],
        },
        {
            "input": [
                [0, 8, 0, 8],
                [0, 8, 8, 8],
                [0, 0, 0, 0],
                [0, 1, 0, 1],
                [0, 0, 1, 0],
                [0, 1, 1, 1],
            ],
            "output": [
                [0, 3, 0, 3],
                [0, 3, 3, 3],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ],
        },
    ]
    rule = make_marker_shape_keyed_recolor_rule(train)
    assert rule is not None
    assert rule([
        [0, 8, 8, 8],
        [0, 8, 0, 8],
        [0, 0, 0, 0],
        [0, 1, 1, 1],
        [0, 1, 0, 1],
        [0, 0, 1, 0],
    ]) == [
        [0, 7, 7, 7],
        [0, 7, 0, 7],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ]


def test_solver_v3_solves_009d5c81_style_task():
    task = {
        "train": [
            {
                "input": [
                    [0, 8, 8, 0],
                    [0, 8, 0, 0],
                    [0, 0, 0, 0],
                    [0, 1, 1, 1],
                    [0, 1, 0, 1],
                    [0, 0, 1, 0],
                ],
                "output": [
                    [0, 7, 7, 0],
                    [0, 7, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                ],
            },
            {
                "input": [
                    [0, 8, 0, 8],
                    [0, 8, 8, 8],
                    [0, 0, 0, 0],
                    [0, 1, 0, 1],
                    [0, 0, 1, 0],
                    [0, 1, 1, 1],
                ],
                "output": [
                    [0, 3, 0, 3],
                    [0, 3, 3, 3],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0],
                ],
            },
        ],
        "test": [{
            "input": [
                [0, 8, 8, 8],
                [0, 8, 0, 8],
                [0, 0, 0, 0],
                [0, 1, 1, 1],
                [0, 1, 0, 1],
                [0, 0, 1, 0],
            ],
            "output": [
                [0, 7, 7, 7],
                [0, 7, 0, 7],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ],
        }],
    }
    result = solve_task_blinded_v3(task)
    assert result["attempt_1"] == task["test"][0]["output"]
    assert result["attempt_2"] == task["test"][0]["output"]
    assert result["proof"]["audit"]["same_output"] is True
