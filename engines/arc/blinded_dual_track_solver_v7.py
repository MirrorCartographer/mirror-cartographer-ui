"""
Mirror Cartographer ARC blinded dual-track solver v7.

Voice-readable behavior:
Solver v7 keeps v6 intact and adds a frame-size interior fill generator.

The new generator learns this pattern:
- rectangular frames of border color 2 exist in the grid;
- their interior background cells are filled;
- the fill color is determined by the frame size learned from training examples;
- the frame border and any internal border-colored marker cells remain unchanged.

This targets task family 00dbd492 and similar tasks without hard-coding the task ID.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Set, Tuple

from engines.arc.blinded_dual_track_solver import ConvergenceAuditor, Grid, LockedAttempt
from engines.arc.blinded_dual_track_solver_v3 import _select_candidate
from engines.arc.blinded_dual_track_solver_v6 import _base_rules as _v6_base_rules


@dataclass(frozen=True)
class Frame:
    min_row: int
    min_col: int
    max_row: int
    max_col: int
    border_color: int

    @property
    def height(self) -> int:
        return self.max_row - self.min_row + 1

    @property
    def width(self) -> int:
        return self.max_col - self.min_col + 1

    @property
    def size_key(self) -> Tuple[int, int]:
        return (self.height, self.width)


def _background_color(grid: Grid) -> int:
    return 0 if any(value == 0 for row in grid for value in row) else grid[0][0]


def _is_rectangular_frame(grid: Grid, top: int, left: int, bottom: int, right: int, border_color: int, background: int) -> bool:
    if bottom - top + 1 < 3 or right - left + 1 < 3:
        return False

    for col in range(left, right + 1):
        if grid[top][col] != border_color or grid[bottom][col] != border_color:
            return False
    for row in range(top, bottom + 1):
        if grid[row][left] != border_color or grid[row][right] != border_color:
            return False

    interior_values = [
        grid[row][col]
        for row in range(top + 1, bottom)
        for col in range(left + 1, right)
    ]
    if not interior_values:
        return False
    return all(value in (background, border_color) for value in interior_values) and any(value == background for value in interior_values)


def find_rectangular_frames(grid: Grid, border_color: int = 2) -> List[Frame]:
    height = len(grid)
    width = len(grid[0]) if grid else 0
    background = _background_color(grid)
    frames: List[Frame] = []
    seen: Set[Tuple[int, int, int, int]] = set()

    for top in range(height):
        for left in range(width):
            if grid[top][left] != border_color:
                continue
            for bottom in range(top + 2, height):
                if grid[bottom][left] != border_color:
                    continue
                for right in range(left + 2, width):
                    if grid[top][right] != border_color or grid[bottom][right] != border_color:
                        continue
                    key = (top, left, bottom, right)
                    if key in seen:
                        continue
                    if _is_rectangular_frame(grid, top, left, bottom, right, border_color, background):
                        frames.append(Frame(top, left, bottom, right, border_color))
                        seen.add(key)

    # Prefer maximal frames; remove frames fully contained inside another frame.
    maximal: List[Frame] = []
    for frame in frames:
        contained = False
        for other in frames:
            if frame == other:
                continue
            if (
                other.min_row <= frame.min_row
                and other.min_col <= frame.min_col
                and other.max_row >= frame.max_row
                and other.max_col >= frame.max_col
                and (other.height * other.width) > (frame.height * frame.width)
            ):
                contained = True
                break
        if not contained:
            maximal.append(frame)
    return sorted(maximal, key=lambda f: (f.min_row, f.min_col, f.height, f.width))


def apply_frame_size_fill(grid: Grid, size_to_color: Dict[Tuple[int, int], int], border_color: int = 2) -> Grid:
    background = _background_color(grid)
    output = [list(row) for row in grid]
    changed = False
    for frame in find_rectangular_frames(grid, border_color=border_color):
        fill_color = size_to_color.get(frame.size_key)
        if fill_color is None:
            continue
        for row in range(frame.min_row + 1, frame.max_row):
            for col in range(frame.min_col + 1, frame.max_col):
                if output[row][col] == background:
                    output[row][col] = fill_color
                    changed = True
    if not changed:
        raise ValueError("no known rectangular frame interior was filled")
    return output


def infer_frame_size_fill_mapping(train: List[Dict[str, Grid]], border_color: int = 2) -> Optional[Dict[Tuple[int, int], int]]:
    mapping: Dict[Tuple[int, int], int] = {}
    observed = 0
    for pair in train:
        input_grid = pair["input"]
        output_grid = pair["output"]
        if len(input_grid) != len(output_grid) or any(len(a) != len(b) for a, b in zip(input_grid, output_grid)):
            return None
        background = _background_color(input_grid)
        for frame in find_rectangular_frames(input_grid, border_color=border_color):
            fill_colors: Set[int] = set()
            for row in range(frame.min_row + 1, frame.max_row):
                for col in range(frame.min_col + 1, frame.max_col):
                    in_value = input_grid[row][col]
                    out_value = output_grid[row][col]
                    if in_value == background and out_value != background:
                        fill_colors.add(out_value)
                    elif in_value == border_color and out_value != border_color:
                        return None
                    elif in_value not in (background, border_color) and out_value != in_value:
                        return None
            if len(fill_colors) != 1:
                continue
            observed += 1
            fill_color = next(iter(fill_colors))
            key = frame.size_key
            if key in mapping and mapping[key] != fill_color:
                return None
            mapping[key] = fill_color
    if observed == 0 or not mapping:
        return None
    return mapping


def make_frame_size_interior_fill_rule(train: List[Dict[str, Grid]]) -> Optional[Callable[[Grid], Grid]]:
    mapping = infer_frame_size_fill_mapping(train)
    if not mapping:
        return None

    def transform(grid: Grid) -> Grid:
        return apply_frame_size_fill(grid, mapping)

    return transform


def _base_rules(train: List[Dict[str, Grid]], native: bool) -> List[Tuple[str, str, Callable[[Grid], Grid], float]]:
    rules = _v6_base_rules(train, native)
    frame_fill = make_frame_size_interior_fill_rule(train)
    if frame_fill is not None:
        rules.append((
            "frame_size_interior_fill",
            "frame_relation_fill",
            frame_fill,
            43.0 if native else 29.0,
        ))
    return rules


class HostileCourtroomTrackV7:
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


class ModelNativeTrackV7:
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


def solve_task_blinded_v7(task: Dict) -> Dict:
    audit_events = []

    step = 1
    first = HostileCourtroomTrackV7().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "hostile_track_locked", "output_hash": first.output_hash})

    step = 2
    second = ModelNativeTrackV7().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "native_track_locked", "output_hash": second.output_hash})

    step = 3
    audit = ConvergenceAuditor().audit(first, second)
    audit_events.append({"step": step, "event": "post_lock_convergence_audit", "same_output": audit["same_output"]})

    return {
        "attempt_1": first.output,
        "attempt_2": second.output,
        "proof": {
            "solver": "mc_arc_blinded_dual_track_solver_v7",
            "audit": audit,
            "audit_events": audit_events,
            "independence_rule": "Tracks lock outputs before comparison. No track receives the other's output before lock.",
        },
    }
