# ARC v6 Relation-Conditioned Composition Spec

## Voice-readable summary

Current ARC score is 4/20 on the first-20 public training smoke set. The next accuracy layer should not be another random generator. It should use object and relation information to choose what object to act on, what anchor or marker controls the action, and where the result should go.

The target is 4/20 to 5/20, but the deeper purpose is to stop solving by isolated tricks and start composing small programs.

## Current proof baseline

- solver: v5
- smoke dataset: first 20 public ARC-AGI-2 training tasks in sorted filename order
- pass-at-two: 4/20
- pass-at-two accuracy: 0.20
- convergence total: 4
- convergence accuracy: 1.0
- failure count: 16
- latest proof: PR #17 / workflow run 25147949154 / artifact 6722953575

## Existing solved smoke families

The current solver has direct proof for these families in the first-20 smoke set:

1. alternating 2x2 to 6x6 tiling
2. self-mask expansion
3. marker-shape keyed recolor
4. enclosed-background fill

## Remaining smoke task manifest

The first-20 task IDs are:

1. 00576224 — solved
2. 007bbfb7 — solved
3. 009d5c81 — solved
4. 00d62c1b — solved
5. 00dbd492 — unsolved
6. 017c7c7b — unsolved
7. 025d127b — unsolved
8. 03560426 — unsolved
9. 045e512c — unsolved
10. 0520fde7 — unsolved
11. 05269061 — unsolved
12. 05a7bcf2 — unsolved
13. 05f2a901 — unsolved
14. 0607ce86 — unsolved
15. 0692e18c — unsolved
16. 06df4c85 — unsolved
17. 070dd51e — unsolved
18. 08ed6ac7 — unsolved
19. 09629e4f — unsolved
20. 0962bcdd — unsolved

## Ranked next capability families

### 1. Relation-conditioned copy / placement

Question pattern:

- Which object is the source?
- Which object is the marker?
- Which object is the anchor?
- What relation chooses the source?
- Where should a copy be placed?

Candidate primitives:

- select_nearest_object(marker)
- select_same_color(marker)
- select_same_shape(marker)
- select_object_aligned_with(anchor)
- copy_to_adjacent_position(source, anchor, direction)
- copy_into_gap(source, relation)

Why high priority:

This is the most direct next layer after object relations. It supports many ARC tasks where the answer is not just transforming the whole grid but choosing and placing objects.

### 2. Object translation by learned vector

Question pattern:

- Did one object move from A to B between input and output?
- Is the translation vector consistent across training pairs?
- Does the vector depend on anchor relation?

Candidate primitives:

- learn_component_translation_vector
- move_single_component
- preserve_background
- erase_old_position
- place_at_new_position

### 3. Crop / extract selected object

Question pattern:

- Does the output equal a crop of one object or region?
- Which object is selected by size, color, uniqueness, border contact, or marker relation?

Candidate primitives:

- crop_largest_component
- crop_unique_color_component
- crop_component_nearest_marker
- crop_bounding_box_union

### 4. Line extension / connection

Question pattern:

- Do colored pixels define endpoints?
- Does the output connect them with a line?
- Does the line extend until blocked?

Candidate primitives:

- find_aligned_endpoints
- draw_horizontal_line
- draw_vertical_line
- draw_diagonal_line
- extend_until_boundary
- extend_until_object

### 5. Count-to-construction

Question pattern:

- Does the number of objects or cells determine output size, row count, color count, or constructed symbol?

Candidate primitives:

- count_components_by_color
- count_cells_by_color
- construct_bar
- construct_square
- construct_repeated_shape

### 6. Two-step composition

Question pattern:

- Is the task extract → transform → place?
- Is it select → recolor → copy?
- Is it count → construct → align?

Candidate primitives:

- compose(select, transform, place)
- compose(count, construct)
- compose(extract, normalize, output)

## v6 architecture proposal

### Layer 1: Component perception

Use `engines/arc/object_relations.py`:

- components
- bounding boxes
- centroids
- same-area relations
- same-color relations
- row/column alignment
- adjacency
- containment
- distance

### Layer 2: Selectors

Add selectors that return component IDs:

- largest_component
- smallest_component
- unique_color_component
- border_touching_component
- non_border_component
- nearest_to_marker
- same_shape_as_marker
- same_color_as_marker
- aligned_with_anchor

### Layer 3: Operators

Add operators that transform selected components:

- copy_component
- move_component
- recolor_component
- crop_component
- fill_component_bbox
- mirror_component
- rotate_component

### Layer 4: Placers

Add placement logic:

- place_beside_anchor
- place_in_gap
- place_at_learned_vector
- place_centered_on_anchor
- place_to_complete_symmetry

### Layer 5: Program candidates

Represent generated hypotheses as small programs:

- select(source_rule) -> operate(operator_rule) -> place(placement_rule)
- select(marker_rule) -> select(source_rule conditioned on marker) -> operate -> place
- detect(training_delta) -> infer_program -> apply_to_test

## Required proof gates for v6

A v6 PR should include:

1. A new module for relation composition or a new solver file.
2. Tests for selectors.
3. Tests for operators.
4. Tests for at least one composed program.
5. The smoke benchmark must not regress.
6. To claim score improvement, smoke must move from 4/20 to at least 5/20.
7. PR body must include workflow run ID, artifact ID, pass-at-two score, convergence count, and limitation statement.

## What not to do

Do not add a single overfit rule unless it is written as a reusable selector/operator/placer pattern.

Do not claim broad ARC intelligence from one new task.

Do not bypass the two-attempt structure.

Do not use GPT/API dependencies in solver execution.

## Next implementation target

Start with a small, testable relation-composition module:

- `select_largest_component`
- `select_nearest_component`
- `extract_component_grid`
- `paste_component`
- `learn_translation_vector`
- `move_component_by_learned_vector`

Then inspect the remaining smoke failures and choose the first task family that can be solved by these primitives.

## Claim boundary

Allowed:
We are building a relation-conditioned composition layer needed for future ARC improvement.

Not allowed:
V6 is already known to improve accuracy before the smoke benchmark proves it.
