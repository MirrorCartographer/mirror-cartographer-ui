from engines.arc.object_relations import extract_components
from engines.arc.relation_composition import (
    apply_learned_single_component_translation,
    blank_like,
    erase_component,
    extract_component_patch,
    learn_consistent_translation,
    learn_single_component_translation,
    paste_component_patch,
    select_largest_component,
    select_nearest_component,
    select_smallest_component,
    select_unique_color_component,
    translate_component,
)


def test_selectors_pick_largest_smallest_unique_and_nearest_components():
    grid = [
        [0, 0, 0, 0, 0, 0],
        [0, 2, 2, 0, 5, 0],
        [0, 2, 2, 0, 0, 0],
        [0, 0, 0, 0, 3, 0],
        [0, 4, 0, 0, 3, 0],
        [0, 0, 0, 0, 0, 0],
    ]
    components = extract_components(grid)

    largest = select_largest_component(components)
    smallest = select_smallest_component(components)
    unique = select_unique_color_component(components)
    nearest = select_nearest_component(smallest, components)

    assert largest is not None
    assert largest.color == 2
    assert smallest is not None
    assert smallest.color == 5
    assert unique is None  # more than one unique color component exists, so selection is ambiguous
    assert nearest is not None
    assert nearest.color == 3


def test_extract_and_paste_component_patch():
    grid = [
        [0, 0, 0, 0, 0],
        [0, 7, 7, 0, 0],
        [0, 7, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ]
    component = extract_components(grid)[0]
    patch = extract_component_patch(component)
    blank = blank_like(grid)

    pasted = paste_component_patch(blank, patch, (1, 2))

    assert pasted == [
        [0, 0, 0, 0, 0],
        [0, 0, 7, 7, 0],
        [0, 0, 7, 0, 0],
        [0, 0, 0, 0, 0],
    ]


def test_erase_and_translate_component():
    grid = [
        [0, 0, 0, 0, 0],
        [0, 6, 6, 0, 0],
        [0, 6, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ]
    component = extract_components(grid)[0]

    assert erase_component(grid, component) == [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ]

    assert translate_component(grid, component, (0, 2)) == [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 6, 6],
        [0, 0, 0, 6, 0],
        [0, 0, 0, 0, 0],
    ]


def test_learn_single_component_translation():
    input_grid = [
        [0, 0, 0, 0, 0],
        [0, 8, 8, 0, 0],
        [0, 8, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ]
    output_grid = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 8, 8],
        [0, 0, 0, 8, 0],
        [0, 0, 0, 0, 0],
    ]

    learned = learn_single_component_translation(input_grid, output_grid)

    assert learned is not None
    component, vector = learned
    assert component.color == 8
    assert vector == (0, 2)


def test_learn_consistent_translation_and_apply_to_test_grid():
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
    test_grid = [
        [0, 0, 0, 0, 0],
        [0, 2, 2, 0, 0],
        [0, 2, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ]

    assert learn_consistent_translation(train) == (0, 2)
    assert apply_learned_single_component_translation(train, test_grid) == [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 2, 2],
        [0, 0, 0, 2, 0],
        [0, 0, 0, 0, 0],
    ]
