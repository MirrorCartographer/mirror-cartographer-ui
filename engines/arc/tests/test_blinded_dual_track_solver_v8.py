from fractions import Fraction

from engines.arc.blinded_dual_track_solver_v8 import (
    infer_vertical_period_extend_rule,
    make_vertical_period_extend_rule,
    solve_task_blinded_v8,
    vertical_period_extend,
)


def test_vertical_period_extend_repeats_shortest_period_and_recolors():
    grid = [
        [0, 1, 0],
        [1, 0, 1],
        [0, 1, 0],
        [1, 0, 1],
        [0, 1, 0],
        [1, 0, 1],
    ]

    assert vertical_period_extend(grid, 9, {0: 0, 1: 2}) == [
        [0, 2, 0],
        [2, 0, 2],
        [0, 2, 0],
        [2, 0, 2],
        [0, 2, 0],
        [2, 0, 2],
        [0, 2, 0],
        [2, 0, 2],
        [0, 2, 0],
    ]


def test_infer_vertical_period_extend_rule_learns_ratio_and_mapping():
    train = [
        {
            "input": [
                [0, 1, 0],
                [1, 0, 1],
                [0, 1, 0],
                [1, 0, 1],
                [0, 1, 0],
                [1, 0, 1],
            ],
            "output": [
                [0, 2, 0],
                [2, 0, 2],
                [0, 2, 0],
                [2, 0, 2],
                [0, 2, 0],
                [2, 0, 2],
                [0, 2, 0],
                [2, 0, 2],
                [0, 2, 0],
            ],
        },
        {
            "input": [
                [0, 1, 0],
                [1, 1, 0],
                [0, 1, 0],
                [0, 1, 1],
                [0, 1, 0],
                [1, 1, 0],
            ],
            "output": [
                [0, 2, 0],
                [2, 2, 0],
                [0, 2, 0],
                [0, 2, 2],
                [0, 2, 0],
                [2, 2, 0],
                [0, 2, 0],
                [0, 2, 2],
                [0, 2, 0],
            ],
        },
    ]

    assert infer_vertical_period_extend_rule(train) == (Fraction(3, 2), {0: 0, 1: 2})


def test_make_vertical_period_extend_rule_applies_to_new_pattern():
    train = [
        {
            "input": [
                [0, 1, 0],
                [1, 0, 1],
                [0, 1, 0],
                [1, 0, 1],
                [0, 1, 0],
                [1, 0, 1],
            ],
            "output": [
                [0, 2, 0],
                [2, 0, 2],
                [0, 2, 0],
                [2, 0, 2],
                [0, 2, 0],
                [2, 0, 2],
                [0, 2, 0],
                [2, 0, 2],
                [0, 2, 0],
            ],
        }
    ]

    rule = make_vertical_period_extend_rule(train)

    assert rule is not None
    assert rule([
        [1, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
    ]) == [
        [2, 2, 2],
        [0, 2, 0],
        [0, 2, 0],
        [2, 2, 2],
        [0, 2, 0],
        [0, 2, 0],
        [2, 2, 2],
        [0, 2, 0],
        [0, 2, 0],
    ]


def test_solver_v8_solves_017c7c7b_style_task():
    task = {
        "train": [
            {
                "input": [
                    [0, 1, 0],
                    [1, 0, 1],
                    [0, 1, 0],
                    [1, 0, 1],
                    [0, 1, 0],
                    [1, 0, 1],
                ],
                "output": [
                    [0, 2, 0],
                    [2, 0, 2],
                    [0, 2, 0],
                    [2, 0, 2],
                    [0, 2, 0],
                    [2, 0, 2],
                    [0, 2, 0],
                    [2, 0, 2],
                    [0, 2, 0],
                ],
            },
            {
                "input": [
                    [0, 1, 0],
                    [1, 1, 0],
                    [0, 1, 0],
                    [0, 1, 1],
                    [0, 1, 0],
                    [1, 1, 0],
                ],
                "output": [
                    [0, 2, 0],
                    [2, 2, 0],
                    [0, 2, 0],
                    [0, 2, 2],
                    [0, 2, 0],
                    [2, 2, 0],
                    [0, 2, 0],
                    [0, 2, 2],
                    [0, 2, 0],
                ],
            },
        ],
        "test": [{
            "input": [
                [1, 1, 1],
                [0, 1, 0],
                [0, 1, 0],
                [1, 1, 1],
                [0, 1, 0],
                [0, 1, 0],
            ],
            "output": [
                [2, 2, 2],
                [0, 2, 0],
                [0, 2, 0],
                [2, 2, 2],
                [0, 2, 0],
                [0, 2, 0],
                [2, 2, 2],
                [0, 2, 0],
                [0, 2, 0],
            ],
        }],
    }

    result = solve_task_blinded_v8(task)

    assert result["attempt_1"] == task["test"][0]["output"]
    assert result["attempt_2"] == task["test"][0]["output"]
    assert result["proof"]["audit"]["same_output"] is True
    assert result["proof"]["audit"]["attempt_1"]["candidate"]["name"] == "vertical_period_extend_recolor"
    assert result["proof"]["audit"]["attempt_2"]["candidate"]["name"] == "vertical_period_extend_recolor"
