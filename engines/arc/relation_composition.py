"""
ARC Cartographer relation-conditioned composition primitives v6.

Voice-readable behavior:
This module is the bridge from seeing objects to acting on objects. It provides reusable selectors, extraction, paste, and learned-translation helpers. It does not claim a score improvement by itself; it gives the next solver layer a cleaner way to compose programs.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence, Tuple

from engines.arc.object_relations import Component, Grid, extract_components, infer_background

Cell = Tuple[int, int]
Vector = Tuple[int, int]


@dataclass(frozen=True)
class ComponentPatch:
    """A component represented as cells relative to its own bounding box."""

    color: int
    cells: Tuple[Cell, ...]
    height: int
    width: int


def select_largest_component(components: Sequence[Component]) -> Optional[Component]:
    if not components:
        return None
    return max(components, key=lambda component: (component.area, -component.id))


def select_smallest_component(components: Sequence[Component]) -> Optional[Component]:
    if not components:
        return None
    return min(components, key=lambda component: (component.area, component.id))


def select_unique_color_component(components: Sequence[Component]) -> Optional[Component]:
    color_counts = {}
    for component in components:
        color_counts[component.color] = color_counts.get(component.color, 0) + 1
    unique = [component for component in components if color_counts[component.color] == 1]
    if len(unique) != 1:
        return None
    return unique[0]


def select_nearest_component(anchor: Component, candidates: Sequence[Component]) -> Optional[Component]:
    filtered = [candidate for candidate in candidates if candidate.id != anchor.id]
    if not filtered:
        return None
    return min(
        filtered,
        key=lambda candidate: (
            (candidate.centroid_row - anchor.centroid_row) ** 2 + (candidate.centroid_col - anchor.centroid_col) ** 2,
            candidate.id,
        ),
    )


def component_shape_key(component: Component) -> Tuple[Cell, ...]:
    min_row = component.bbox.min_row
    min_col = component.bbox.min_col
    return tuple(sorted((row - min_row, col - min_col) for row, col in component.cells))


def select_same_shape_as_marker(marker: Component, candidates: Sequence[Component]) -> Optional[Component]:
    marker_key = component_shape_key(marker)
    matches = [
        candidate
        for candidate in candidates
        if candidate.id != marker.id and component_shape_key(candidate) == marker_key
    ]
    if len(matches) != 1:
        return None
    return matches[0]


def extract_component_patch(component: Component) -> ComponentPatch:
    return ComponentPatch(
        color=component.color,
        cells=component_shape_key(component),
        height=component.height,
        width=component.width,
    )


def blank_like(grid: Grid, fill: Optional[int] = None) -> Grid:
    background = infer_background(grid) if fill is None else fill
    return [[background for _ in row] for row in grid]


def erase_component(grid: Grid, component: Component, fill: Optional[int] = None) -> Grid:
    background = infer_background(grid) if fill is None else fill
    output = [list(row) for row in grid]
    for row, col in component.cells:
        output[row][col] = background
    return output


def paste_component_patch(grid: Grid, patch: ComponentPatch, top_left: Cell, *, overwrite_background_only: bool = False) -> Grid:
    output = [list(row) for row in grid]
    background = infer_background(grid)
    start_row, start_col = top_left
    height = len(output)
    width = len(output[0]) if output else 0
    for rel_row, rel_col in patch.cells:
        row = start_row + rel_row
        col = start_col + rel_col
        if row < 0 or col < 0 or row >= height or col >= width:
            raise ValueError("component paste would leave grid bounds")
        if overwrite_background_only and output[row][col] != background:
            raise ValueError("component paste would overwrite non-background cell")
        output[row][col] = patch.color
    return output


def translate_component(grid: Grid, component: Component, vector: Vector) -> Grid:
    row_delta, col_delta = vector
    erased = erase_component(grid, component)
    patch = extract_component_patch(component)
    return paste_component_patch(
        erased,
        patch,
        (component.bbox.min_row + row_delta, component.bbox.min_col + col_delta),
    )


def _same_patch(a: Component, b: Component) -> bool:
    return a.color == b.color and component_shape_key(a) == component_shape_key(b)


def _component_translation(a: Component, b: Component) -> Optional[Vector]:
    if not _same_patch(a, b):
        return None
    return (b.bbox.min_row - a.bbox.min_row, b.bbox.min_col - a.bbox.min_col)


def learn_single_component_translation(input_grid: Grid, output_grid: Grid) -> Optional[Tuple[Component, Vector]]:
    """Infer a single moved component between one input/output pair.

    This handles tasks where exactly one component appears to move while keeping color and shape unchanged.
    """
    input_components = extract_components(input_grid)
    output_components = extract_components(output_grid)
    if not input_components or not output_components:
        return None

    candidate_moves: List[Tuple[Component, Vector]] = []
    for source in input_components:
        matching_outputs = [target for target in output_components if _same_patch(source, target)]
        if len(matching_outputs) != 1:
            continue
        vector = _component_translation(source, matching_outputs[0])
        if vector is None or vector == (0, 0):
            continue
        candidate_moves.append((source, vector))

    if len(candidate_moves) != 1:
        return None
    return candidate_moves[0]


def learn_consistent_translation(train_pairs: Iterable[dict]) -> Optional[Vector]:
    vectors = []
    for pair in train_pairs:
        learned = learn_single_component_translation(pair["input"], pair["output"])
        if learned is None:
            return None
        _, vector = learned
        vectors.append(vector)
    if not vectors:
        return None
    first = vectors[0]
    if any(vector != first for vector in vectors):
        return None
    return first


def apply_learned_single_component_translation(train_pairs: Iterable[dict], test_grid: Grid) -> Grid:
    """Apply a consistent learned translation to the most plausible movable component in test grid."""
    vector = learn_consistent_translation(train_pairs)
    if vector is None:
        raise ValueError("no consistent translation learned")

    components = extract_components(test_grid)
    if len(components) == 1:
        return translate_component(test_grid, components[0], vector)

    candidate = select_unique_color_component(components) or select_largest_component(components)
    if candidate is None:
        raise ValueError("no component available for translation")
    return translate_component(test_grid, candidate, vector)
