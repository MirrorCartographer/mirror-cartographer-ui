"""
Mirror Cartographer ARC blinded dual-track solver v5.

Voice-readable behavior:
Solver v5 keeps the v3 solver families and adds enclosed-background fill.

The new generator detects background cells that cannot reach the outside border through background-color movement. Those trapped interior cells are filled with the color learned from the training differences, usually color 4.

This targets smoke-set task family 00d62c1b and similar enclosed-region fill tasks.
"""

from __future__ import annotations

from collections import deque
from typing import Callable, Dict, List, Optional, Set, Tuple

from engines.arc.blinded_dual_track_solver import (
    ConvergenceAuditor,
    Grid,
    LockedAttempt,
    apply_color_map,
    complete_horizontal_symmetry,
    complete_vertical_symmetry,
    consistent_color_map,
    flip_h,
    flip_v,
    rotate180,
)
from engines.arc.blinded_dual_track_solver_v2 import (
    alternating_tile_2x2_to_6x6,
    self_mask_expand,
)
from engines.arc.blinded_dual_track_solver_v3 import (
    _select_candidate,
    make_marker_shape_keyed_recolor_rule,
)


def _background_color(grid: Grid) -> int:
    if any(value == 0 for row in grid for value in row):
        return 0
    counts: Dict[int, int] = {}
    for row in grid:
        for value in row:
            counts[value] = counts.get(value, 0) + 1
    return max(counts.items(), key=lambda item: item[1])[0] if counts else 0


def fill_enclosed_background(grid: Grid, fill_color: int = 4) -> Grid:
    """Fill background regions that do not connect to the grid border."""
    height = len(grid)
    width = len(grid[0]) if grid else 0
    if height == 0 or width == 0:
        raise ValueError("fill_enclosed_background requires a non-empty grid")

    background = _background_color(grid)
    outside: Set[Tuple[int, int]] = set()
    queue: deque[Tuple[int, int]] = deque()

    def add_if_background(row: int, col: int) -> None:
        if row < 0 or col < 0 or row >= height or col >= width:
            return
        if (row, col) in outside:
            return
        if grid[row][col] != background:
            return
        outside.add((row, col))
        queue.append((row, col))

    for row in range(height):
        add_if_background(row, 0)
        add_if_background(row, width - 1)
    for col in range(width):
        add_if_background(0, col)
        add_if_background(height - 1, col)

    while queue:
        row, col = queue.popleft()
        add_if_background(row - 1, col)
        add_if_background(row + 1, col)
        add_if_background(row, col - 1)
        add_if_background(row, col + 1)

    output = [list(row) for row in grid]
    changed = False
    for row in range(height):
        for col in range(width):
            if grid[row][col] == background and (row, col) not in outside:
                output[row][col] = fill_color
                changed = True
    if not changed:
        raise ValueError("no enclosed background found")
    return output


def make_enclosed_background_fill_rule(train: List[Dict[str, Grid]]) -> Optional[Callable[[Grid], Grid]]:
    """Infer the fill color for enclosed-background fill from training pairs."""
    if not train:
        return None

    fill_colors: Set[int] = set()
    for pair in train:
        input_grid = pair["input"]
        output_grid = pair["output"]
        if len(input_grid) != len(output_grid) or any(len(a) != len(b) for a, b in zip(input_grid, output_grid)):
            return None
        background = _background_color(input_grid)
        for row_index, row in enumerate(input_grid):
            for col_index, value in enumerate(row):
                out_value = output_grid[row_index][col_index]
                if value == out_value:
                    continue
                if value != background:
                    return None
                fill_colors.add(out_value)
    if len(fill_colors) != 1:
        return None
    fill_color = next(iter(fill_colors))

    def transform(grid: Grid) -> Grid:
        return fill_enclosed_background(grid, fill_color=fill_color)

    return transform


def _base_rules(train: List[Dict[str, Grid]], native: bool) -> List[Tuple[str, str, Callable[[Grid], Grid], float]]:
    if native:
        rules: List[Tuple[str, str, Callable[[Grid], Grid], float]] = [
            ("complete_horizontal_symmetry", "symmetry_completion", complete_horizontal_symmetry, 30.0),
            ("complete_vertical_symmetry", "symmetry_completion", complete_vertical_symmetry, 30.0),
            ("alternating_tile_2x2_to_6x6", "tiling", alternating_tile_2x2_to_6x6, 34.0),
            ("self_mask_expand", "mask_expansion", self_mask_expand, 34.0),
            ("flip_h_visual", "visual_transform", flip_h, 18.0),
            ("flip_v_visual", "visual_transform", flip_v, 18.0),
            ("rotate180_visual", "visual_transform", rotate180, 16.0),
        ]
    else:
        rules = [
            ("identity", "direct", lambda grid: grid, 19.0),
            ("rotate180", "direct", rotate180, 18.0),
            ("flip_h", "direct", flip_h, 18.0),
            ("flip_v", "direct", flip_v, 18.0),
            ("alternating_tile_2x2_to_6x6", "tiling", alternating_tile_2x2_to_6x6, 16.0),
            ("self_mask_expand", "mask_expansion", self_mask_expand, 15.0),
        ]

    enclosed_fill = make_enclosed_background_fill_rule(train)
    if enclosed_fill is not None:
        rules.append(("enclosed_background_fill", "region_fill", enclosed_fill, 38.0 if native else 24.0))

    keyed_recolor = make_marker_shape_keyed_recolor_rule(train)
    if keyed_recolor is not None:
        rules.append(("marker_shape_keyed_recolor", "marker_keyed_recolor", keyed_recolor, 36.0 if native else 20.0))

    mapping = consistent_color_map(train)
    if mapping is not None:
        name = "analogical_color_transfer" if native else "consistent_color_map"
        family = "analogy" if native else "color_mapping"
        rules.append((name, family, lambda grid, m=mapping: apply_color_map(grid, m), 25.0 if native else 17.0))

    return rules


class HostileCourtroomTrackV5:
    lens = "hostile_courtroom"

    def run(self, task: Dict, lock_step: int) -> LockedAttempt:
        train = task.get("train", [])
        return _select_candidate(
            lens=self.lens,
            task=task,
            rules=_base_rules(train, native=False),
            lock_step=lock_step,
            scoring_style="proof_first",
        )


class ModelNativeTrackV5:
    lens = "model_native_bounded"

    def run(self, task: Dict, lock_step: int) -> LockedAttempt:
        train = task.get("train", [])
        return _select_candidate(
            lens=self.lens,
            task=task,
            rules=_base_rules(train, native=True),
            lock_step=lock_step,
            scoring_style="pattern_first_bounded",
        )


def solve_task_blinded_v5(task: Dict) -> Dict:
    audit_events = []

    step = 1
    first = HostileCourtroomTrackV5().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "hostile_track_locked", "output_hash": first.output_hash})

    step = 2
    second = ModelNativeTrackV5().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "native_track_locked", "output_hash": second.output_hash})

    step = 3
    audit = ConvergenceAuditor().audit(first, second)
    audit_events.append({"step": step, "event": "post_lock_convergence_audit", "same_output": audit["same_output"]})

    return {
        "attempt_1": first.output,
        "attempt_2": second.output,
        "proof": {
            "solver": "mc_arc_blinded_dual_track_solver_v5",
            "audit": audit,
            "audit_events": audit_events,
            "independence_rule": "Tracks lock outputs before comparison. No track receives the other's output before lock.",
        },
    }
