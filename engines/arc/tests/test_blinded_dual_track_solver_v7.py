from engines.arc.blinded_dual_track_solver_v7 import (
    apply_frame_size_fill,
    find_rectangular_frames,
    infer_frame_size_fill_mapping,
    make_frame_size_interior_fill_rule,
    solve_task_blinded_v7,
)


def test_find_rectangular_frames_detects_multiple_frame_sizes():
    grid = [
        [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
        [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2],
        [2, 0, 2, 0, 2, 0, 2, 0, 0, 2, 0, 0, 2],
        [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2],
        [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
    ]

    frames = find_rectangular_frames(grid)

    assert [frame.size_key for frame in frames] == [(5, 5), (5, 7)]


def test_infer_frame_size_fill_mapping_learns_size_to_color():
    train = [
        {
            "input": [
                [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
                [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2],
                [2, 0, 2, 0, 2, 0, 2, 0, 0, 2, 0, 0, 2],
                [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2],
                [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
            ],
            "output": [
                [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
                [2, 8, 8, 8, 2, 0, 2, 4, 4, 4, 4, 4, 2],
                [2, 8, 2, 8, 2, 0, 2, 4, 4, 2, 4, 4, 2],
                [2, 8, 8, 8, 2, 0, 2, 4, 4, 4, 4, 4, 2],
                [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
            ],
        }
    ]

    assert infer_frame_size_fill_mapping(train) == {(5, 5): 8, (5, 7): 4}


def test_apply_frame_size_fill_preserves_border_markers():
    grid = [
        [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
        [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2],
        [2, 0, 2, 0, 2, 0, 2, 0, 0, 2, 0, 0, 2],
        [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2],
        [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
    ]

    assert apply_frame_size_fill(grid, {(5, 5): 8, (5, 7): 4}) == [
        [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
        [2, 8, 8, 8, 2, 0, 2, 4, 4, 4, 4, 4, 2],
        [2, 8, 2, 8, 2, 0, 2, 4, 4, 2, 4, 4, 2],
        [2, 8, 8, 8, 2, 0, 2, 4, 4, 4, 4, 4, 2],
        [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
    ]


def test_solver_v7_solves_frame_size_fill_task():
    task = {
        "train": [{
            "input": [
                [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
                [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2],
                [2, 0, 2, 0, 2, 0, 2, 0, 0, 2, 0, 0, 2],
                [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2],
                [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
            ],
            "output": [
                [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
                [2, 8, 8, 8, 2, 0, 2, 4, 4, 4, 4, 4, 2],
                [2, 8, 2, 8, 2, 0, 2, 4, 4, 2, 4, 4, 2],
                [2, 8, 8, 8, 2, 0, 2, 4, 4, 4, 4, 4, 2],
                [2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2],
            ],
        }],
        "test": [{
            "input": [
                [0, 2, 2, 2, 2, 2, 0],
                [0, 2, 0, 0, 0, 2, 0],
                [0, 2, 0, 2, 0, 2, 0],
                [0, 2, 0, 0, 0, 2, 0],
                [0, 2, 2, 2, 2, 2, 0],
            ],
            "output": [
                [0, 2, 2, 2, 2, 2, 0],
                [0, 2, 8, 8, 8, 2, 0],
                [0, 2, 8, 2, 8, 2, 0],
                [0, 2, 8, 8, 8, 2, 0],
                [0, 2, 2, 2, 2, 2, 0],
            ],
        }],
    }

    result = solve_task_blinded_v7(task)

    assert result["attempt_1"] == task["test"][0]["output"]
    assert result["attempt_2"] == task["test"][0]["output"]
    assert result["proof"]["audit"]["same_output"] is True
    assert result["proof"]["audit"]["attempt_1"]["candidate"]["name"] == "frame_size_interior_fill"
    assert result["proof"]["audit"]["attempt_2"]["candidate"]["name"] == "frame_size_interior_fill"
