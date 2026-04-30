from engines.arc.blinded_dual_track_solver_v6 import (
    make_learned_single_component_translation_rule,
    solve_task_blinded_v6,
)


def test_make_learned_single_component_translation_rule_solves_training_style_case():
    train = [
        {
            "input": [
                [0, 0, 0, 0, 0],
                [0, 8, 8, 0, 0],
                [0, 8, 0, 0, 0],
                [0, 0, 0, 0, 0],
            ],
            "output": [
                [0, 0, 0, 0, 0],
                [0, 0, 0, 8, 8],
                [0, 0, 0, 8, 0],
                [0, 0, 0, 0, 0],
            ],
        },
        {
            "input": [
                [0, 0, 0, 0, 0],
                [0, 4, 4, 0, 0],
                [0, 4, 0, 0, 0],
                [0, 0, 0, 0, 0],
            ],
            "output": [
                [0, 0, 0, 0, 0],
                [0, 0, 0, 4, 4],
                [0, 0, 0, 4, 0],
                [0, 0, 0, 0, 0],
            ],
        },
    ]
    rule = make_learned_single_component_translation_rule(train)

    assert rule is not None
    assert rule([
        [0, 0, 0, 0, 0],
        [0, 2, 2, 0, 0],
        [0, 2, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ]) == [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 2, 2],
        [0, 0, 0, 2, 0],
        [0, 0, 0, 0, 0],
    ]


def test_learned_translation_rule_rejects_cluttered_training_examples():
    train = [
        {
            "input": [
                [0, 0, 0, 0, 0],
                [0, 8, 8, 0, 1],
                [0, 8, 0, 0, 0],
                [0, 0, 0, 0, 0],
            ],
            "output": [
                [0, 0, 0, 0, 0],
                [0, 0, 0, 8, 8],
                [0, 0, 0, 8, 0],
                [0, 0, 0, 0, 1],
            ],
        }
    ]

    assert make_learned_single_component_translation_rule(train) is None


def test_solver_v6_solves_single_component_translation_task():
    task = {
        "train": [
            {
                "input": [
                    [0, 0, 0, 0, 0],
                    [0, 8, 8, 0, 0],
                    [0, 8, 0, 0, 0],
                    [0, 0, 0, 0, 0],
                ],
                "output": [
                    [0, 0, 0, 0, 0],
                    [0, 0, 0, 8, 8],
                    [0, 0, 0, 8, 0],
                    [0, 0, 0, 0, 0],
                ],
            },
            {
                "input": [
                    [0, 0, 0, 0, 0],
                    [0, 4, 4, 0, 0],
                    [0, 4, 0, 0, 0],
                    [0, 0, 0, 0, 0],
                ],
                "output": [
                    [0, 0, 0, 0, 0],
                    [0, 0, 0, 4, 4],
                    [0, 0, 0, 4, 0],
                    [0, 0, 0, 0, 0],
                ],
            },
        ],
        "test": [{
            "input": [
                [0, 0, 0, 0, 0],
                [0, 2, 2, 0, 0],
                [0, 2, 0, 0, 0],
                [0, 0, 0, 0, 0],
            ],
            "output": [
                [0, 0, 0, 0, 0],
                [0, 0, 0, 2, 2],
                [0, 0, 0, 2, 0],
                [0, 0, 0, 0, 0],
            ],
        }],
    }

    result = solve_task_blinded_v6(task)

    assert result["attempt_1"] == task["test"][0]["output"]
    assert result["attempt_2"] == task["test"][0]["output"]
    assert result["proof"]["audit"]["same_output"] is True
    assert result["proof"]["audit"]["attempt_1"]["candidate"]["name"] == "learned_single_component_translation"
    assert result["proof"]["audit"]["attempt_2"]["candidate"]["name"] == "learned_single_component_translation"
