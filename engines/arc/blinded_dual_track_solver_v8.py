"""
Mirror Cartographer ARC blinded dual-track solver v8.

Voice-readable behavior:
Solver v8 keeps v7 intact and adds vertical periodic extension with recolor.

The new generator learns this pattern:
- output keeps the same width as input;
- output height is input height plus half the input height;
- rows continue by repeating the shortest vertical period found in the input;
- a consistent color mapping, usually 1 -> 2, is applied.

This targets task family 017c7c7b and similar vertical continuation tasks without hard-coding the task ID.
"""

from __future__ import annotations

from fractions import Fraction
from typing import Callable, Dict, List, Optional, Tuple

from engines.arc.blinded_dual_track_solver import ConvergenceAuditor, Grid, LockedAttempt
from engines.arc.blinded_dual_track_solver_v3 import _select_candidate
from engines.arc.blinded_dual_track_solver_v7 import _base_rules as _v7_base_rules


def _grid_shape(grid: Grid) -> Tuple[int, int]:
    return len(grid), len(grid[0]) if grid else 0


def _apply_mapping(grid: Grid, mapping: Dict[int, int]) -> Grid:
    return [[mapping.get(value, value) for value in row] for row in grid]


def _shortest_vertical_period(grid: Grid) -> Optional[int]:
    height, _ = _grid_shape(grid)
    if height == 0:
        return None
    for period in range(1, height + 1):
        if all(grid[row] == grid[row % period] for row in range(height)):
            return period
    return height


def vertical_period_extend(grid: Grid, target_height: int, mapping: Dict[int, int]) -> Grid:
    period = _shortest_vertical_period(grid)
    if period is None or target_height <= len(grid):
        raise ValueError("vertical period extension requires a larger target height")
    extended = [list(grid[row % period]) for row in range(target_height)]
    return _apply_mapping(extended, mapping)


def _infer_cellwise_color_mapping(input_grid: Grid, output_grid: Grid) -> Optional[Dict[int, int]]:
    in_height, in_width = _grid_shape(input_grid)
    out_height, out_width = _grid_shape(output_grid)
    if in_width != out_width or out_height < in_height:
        return None

    mapping: Dict[int, int] = {}
    for row in range(in_height):
        for col in range(in_width):
            in_value = input_grid[row][col]
            out_value = output_grid[row][col]
            if in_value in mapping and mapping[in_value] != out_value:
                return None
            mapping[in_value] = out_value
    return mapping


def infer_vertical_period_extend_rule(train: List[Dict[str, Grid]]) -> Optional[Tuple[Fraction, Dict[int, int]]]:
    if not train:
        return None

    height_ratio: Optional[Fraction] = None
    learned_mapping: Optional[Dict[int, int]] = None

    for pair in train:
        input_grid = pair["input"]
        output_grid = pair["output"]
        in_height, in_width = _grid_shape(input_grid)
        out_height, out_width = _grid_shape(output_grid)
        if in_height == 0 or in_width == 0 or out_width != in_width or out_height <= in_height:
            return None

        ratio = Fraction(out_height, in_height)
        if height_ratio is None:
            height_ratio = ratio
        elif ratio != height_ratio:
            return None

        mapping = _infer_cellwise_color_mapping(input_grid, output_grid)
        if mapping is None:
            return None
        if learned_mapping is None:
            learned_mapping = mapping
        elif learned_mapping != mapping:
            return None

        predicted = vertical_period_extend(input_grid, out_height, mapping)
        if predicted != output_grid:
            return None

    if height_ratio is None or learned_mapping is None:
        return None
    if height_ratio <= 1:
        return None
    return height_ratio, learned_mapping


def make_vertical_period_extend_rule(train: List[Dict[str, Grid]]) -> Optional[Callable[[Grid], Grid]]:
    learned = infer_vertical_period_extend_rule(train)
    if learned is None:
        return None
    height_ratio, mapping = learned

    def transform(grid: Grid) -> Grid:
        height, _ = _grid_shape(grid)
        target_fraction = height * height_ratio
        if target_fraction.denominator != 1:
            raise ValueError("learned vertical extension ratio does not produce integer test height")
        return vertical_period_extend(grid, int(target_fraction), mapping)

    return transform


def _base_rules(train: List[Dict[str, Grid]], native: bool) -> List[Tuple[str, str, Callable[[Grid], Grid], float]]:
    rules = _v7_base_rules(train, native)
    vertical_extend = make_vertical_period_extend_rule(train)
    if vertical_extend is not None:
        rules.append((
            "vertical_period_extend_recolor",
            "periodic_extension",
            vertical_extend,
            44.0 if native else 30.0,
        ))
    return rules


class HostileCourtroomTrackV8:
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


class ModelNativeTrackV8:
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


def solve_task_blinded_v8(task: Dict) -> Dict:
    audit_events = []

    step = 1
    first = HostileCourtroomTrackV8().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "hostile_track_locked", "output_hash": first.output_hash})

    step = 2
    second = ModelNativeTrackV8().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "native_track_locked", "output_hash": second.output_hash})

    step = 3
    audit = ConvergenceAuditor().audit(first, second)
    audit_events.append({"step": step, "event": "post_lock_convergence_audit", "same_output": audit["same_output"]})

    return {
        "attempt_1": first.output,
        "attempt_2": second.output,
        "proof": {
            "solver": "mc_arc_blinded_dual_track_solver_v8",
            "audit": audit,
            "audit_events": audit_events,
            "independence_rule": "Tracks lock outputs before comparison. No track receives the other's output before lock.",
        },
    }
