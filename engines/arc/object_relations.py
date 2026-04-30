"""
ARC Cartographer object-relation layer v4.

Voice-readable behavior:
This module turns a raw ARC grid into components and relations. It does not solve ARC by itself. It creates the perception layer needed for later relation-conditioned program synthesis.

It extracts connected components, bounding boxes, centroids, area, width, height, border contact, horizontal and vertical symmetry flags, and pairwise relation descriptors.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from math import sqrt
from typing import Dict, Iterable, List, Set, Tuple

Grid = List[List[int]]
Cell = Tuple[int, int]


@dataclass(frozen=True)
class BoundingBox:
    min_row: int
    min_col: int
    max_row: int
    max_col: int

    @property
    def height(self) -> int:
        return self.max_row - self.min_row + 1

    @property
    def width(self) -> int:
        return self.max_col - self.min_col + 1

    @property
    def area(self) -> int:
        return self.height * self.width


@dataclass(frozen=True)
class Component:
    id: int
    color: int
    cells: Tuple[Cell, ...]
    bbox: BoundingBox
    area: int
    height: int
    width: int
    centroid_row: float
    centroid_col: float
    touches_border: bool
    horizontal_symmetry: bool
    vertical_symmetry: bool

    def to_dict(self) -> Dict:
        data = asdict(self)
        data["bbox"] = asdict(self.bbox)
        data["cells"] = [list(cell) for cell in self.cells]
        return data


@dataclass(frozen=True)
class ComponentRelation:
    a_id: int
    b_id: int
    same_color: bool
    same_area: bool
    aligned_row: bool
    aligned_col: bool
    bbox_adjacent: bool
    contains: bool
    contained_by: bool
    centroid_distance: float

    def to_dict(self) -> Dict:
        return asdict(self)


def grid_shape(grid: Grid) -> Tuple[int, int]:
    return len(grid), len(grid[0]) if grid else 0


def neighbors4(row: int, col: int) -> Iterable[Cell]:
    yield row - 1, col
    yield row + 1, col
    yield row, col - 1
    yield row, col + 1


def infer_background(grid: Grid) -> int:
    counts: Dict[int, int] = {}
    for row in grid:
        for value in row:
            counts[value] = counts.get(value, 0) + 1
    if not counts:
        return 0
    if 0 in counts:
        return 0
    return max(counts.items(), key=lambda item: item[1])[0]


def bounding_box(cells: Iterable[Cell]) -> BoundingBox:
    cell_list = list(cells)
    return BoundingBox(
        min_row=min(row for row, _ in cell_list),
        min_col=min(col for _, col in cell_list),
        max_row=max(row for row, _ in cell_list),
        max_col=max(col for _, col in cell_list),
    )


def _normalize_cells(cells: Tuple[Cell, ...], bbox: BoundingBox) -> Set[Cell]:
    return {(row - bbox.min_row, col - bbox.min_col) for row, col in cells}


def has_horizontal_symmetry(cells: Tuple[Cell, ...], bbox: BoundingBox) -> bool:
    normalized = _normalize_cells(cells, bbox)
    return all((row, bbox.width - 1 - col) in normalized for row, col in normalized)


def has_vertical_symmetry(cells: Tuple[Cell, ...], bbox: BoundingBox) -> bool:
    normalized = _normalize_cells(cells, bbox)
    return all((bbox.height - 1 - row, col) in normalized for row, col in normalized)


def extract_components(grid: Grid, *, include_background: bool = False) -> List[Component]:
    height, width = grid_shape(grid)
    background = infer_background(grid)
    seen: Set[Cell] = set()
    components: List[Component] = []

    for row in range(height):
        for col in range(width):
            if (row, col) in seen:
                continue
            color = grid[row][col]
            if color == background and not include_background:
                seen.add((row, col))
                continue

            stack = [(row, col)]
            cells: List[Cell] = []
            seen.add((row, col))
            while stack:
                current_row, current_col = stack.pop()
                cells.append((current_row, current_col))
                for next_row, next_col in neighbors4(current_row, current_col):
                    if next_row < 0 or next_col < 0 or next_row >= height or next_col >= width:
                        continue
                    if (next_row, next_col) in seen:
                        continue
                    if grid[next_row][next_col] != color:
                        continue
                    seen.add((next_row, next_col))
                    stack.append((next_row, next_col))

            ordered = tuple(sorted(cells))
            box = bounding_box(ordered)
            area = len(ordered)
            centroid_row = sum(cell[0] for cell in ordered) / area
            centroid_col = sum(cell[1] for cell in ordered) / area
            touches_border = any(r in (0, height - 1) or c in (0, width - 1) for r, c in ordered)
            components.append(Component(
                id=len(components),
                color=color,
                cells=ordered,
                bbox=box,
                area=area,
                height=box.height,
                width=box.width,
                centroid_row=centroid_row,
                centroid_col=centroid_col,
                touches_border=touches_border,
                horizontal_symmetry=has_horizontal_symmetry(ordered, box),
                vertical_symmetry=has_vertical_symmetry(ordered, box),
            ))

    return components


def boxes_adjacent(a: BoundingBox, b: BoundingBox) -> bool:
    row_touch = a.max_row + 1 == b.min_row or b.max_row + 1 == a.min_row
    col_overlap = not (a.max_col < b.min_col or b.max_col < a.min_col)
    col_touch = a.max_col + 1 == b.min_col or b.max_col + 1 == a.min_col
    row_overlap = not (a.max_row < b.min_row or b.max_row < a.min_row)
    return (row_touch and col_overlap) or (col_touch and row_overlap)


def contains_box(outer: BoundingBox, inner: BoundingBox) -> bool:
    return (
        outer.min_row <= inner.min_row
        and outer.min_col <= inner.min_col
        and outer.max_row >= inner.max_row
        and outer.max_col >= inner.max_col
    )


def component_relation(a: Component, b: Component) -> ComponentRelation:
    return ComponentRelation(
        a_id=a.id,
        b_id=b.id,
        same_color=a.color == b.color,
        same_area=a.area == b.area,
        aligned_row=round(a.centroid_row, 6) == round(b.centroid_row, 6),
        aligned_col=round(a.centroid_col, 6) == round(b.centroid_col, 6),
        bbox_adjacent=boxes_adjacent(a.bbox, b.bbox),
        contains=contains_box(a.bbox, b.bbox) and a.bbox != b.bbox,
        contained_by=contains_box(b.bbox, a.bbox) and a.bbox != b.bbox,
        centroid_distance=sqrt((a.centroid_row - b.centroid_row) ** 2 + (a.centroid_col - b.centroid_col) ** 2),
    )


def describe_relations(components: List[Component]) -> List[ComponentRelation]:
    relations: List[ComponentRelation] = []
    for index, a in enumerate(components):
        for b in components[index + 1:]:
            relations.append(component_relation(a, b))
    return relations


def describe_grid(grid: Grid) -> Dict:
    components = extract_components(grid)
    relations = describe_relations(components)
    return {
        "shape": list(grid_shape(grid)),
        "background": infer_background(grid),
        "components": [component.to_dict() for component in components],
        "relations": [relation.to_dict() for relation in relations],
    }
