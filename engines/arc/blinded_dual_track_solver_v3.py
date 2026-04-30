"""
Mirror Cartographer ARC blinded dual-track solver v3.

Voice-readable behavior:
Solver v3 keeps solver v2 intact and adds one evidence-driven generator family from smoke-set inspection: marker-shape keyed recolor.

In this family, a small marker object, usually color 1, acts like a key. The marker shape selects which color should replace the large object color. The marker itself is then removed.

This is designed for task family 009d5c81 and similar tasks. It is proof-scored against visible training examples before being used on the test input.
"""

from __future__ import annotations

from collections import Counter
from typing import Callable, Dict, List, Optional, Tuple

from engines.arc.blinded_dual_track_solver import (
    Candidate,
    ConvergenceAuditor,
    Grid,
    LockedAttempt,
    apply_color_map,
    clone_task,
    complete_horizontal_symmetry,
    complete_vertical_symmetry,
    consistent_color_map,
    flip_h,
    flip_v,
    rotate180,
    score_rule,
    valid_grid,
)
from engines.arc.blinded_dual_track_solver_v2 import (
    alternating_tile_2x2_to_6x6,
    self_mask_expand,
)


def _color_cells(grid: Grid, color: int) -> List[Tuple[int, int]]:
    return [(r, c) for r, row in enumerate(grid) for c, value in enumerate(row) if value == color]


def _shape_key_for_color(grid: Grid, color: int) -> Optional[Tuple[Tuple[int, int], ...]]:
    cells = _color_cells(grid, color)
    if not cells:
        return None
    min_row = min(r for r, _ in cells)
    min_col = min(c for _, c in cells)
    return tuple(sorted((r - min_row, c - min_col) for r, c in cells))


def _dominant_output_color(output: Grid) -> Optional[int]:
    counts = Counter(value for row in output for value in row if value != 0)
    if not counts:
        return None
    return counts.most_common(1)[0][0]


def _main_input_colors(grid: Grid, marker_color: int) -> List[int]:
    counts = Counter(value for row in grid for value in row if value not in (0, marker_color))
    return [color for color, _ in counts.most_common()]


def make_marker_shape_keyed_recolor_rule(train: List[Dict[str, Grid]], marker_color: int = 1) -> Optional[Callable[[Grid], Grid]]:
    """Infer marker-shape-to-output-color mapping from training pairs.

    The rule expects each training input to contain a marker object of marker_color.
    The marker shape maps to the dominant nonzero color in the output. At runtime,
    the marker is removed and non-marker nonzero cells are recolored to the mapped target.
    """
    if not train:
        return None

    mapping: Dict[Tuple[Tuple[int, int], ...], int] = {}
    for pair in train:
        key = _shape_key_for_color(pair["input"], marker_color)
        target = _dominant_output_color(pair["output"])
        if key is None or target is None:
            return None
        if key in mapping and mapping[key] != target:
            return None
        mapping[key] = target

    def transform(grid: Grid) -> Grid:
        key = _shape_key_for_color(grid, marker_color)
        if key is None or key not in mapping:
            raise ValueError("marker shape not known from training examples")
        target = mapping[key]
        main_colors = set(_main_input_colors(grid, marker_color))
        if not main_colors:
            raise ValueError("no main object color found")
        out: Grid = []
        for row in grid:
            new_row = []
            for value in row:
                if value == marker_color:
                    new_row.append(0)
                elif value in main_colors:
                    new_row.append(target)
                else:
                    new_row.append(value)
            out.append(new_row)
        return out

    return transform


def _select_candidate(
    *,
    lens: str,
    task: Dict,
    rules: List[Tuple[str, str, Callable[[Grid], Grid], float]],
    lock_step: int,
    scoring_style: str,
) -> LockedAttempt:
    local_task = clone_task(task)
    train = local_task.get("train", [])
    test_input = local_task.get("test", [{}])[0].get("input", [[0]])
    candidates: List[Candidate] = []

    for name, family, transform, base_score in rules:
        exact, ratio = score_rule(train, transform)
        try:
            output = transform(test_input)
        except Exception:
            continue
        if not valid_grid(output):
            continue

        if scoring_style == "proof_first":
            proof_bonus = 100 if exact == len(train) and len(train) > 0 else 0
            score = proof_bonus + 50 * ratio + base_score
        else:
            score = base_score + 55 * ratio + (20 if exact == len(train) and len(train) > 0 else 0)

        candidates.append(Candidate(
            name=name,
            output=output,
            score=score,
            train_exact=exact,
            train_total=len(train),
            family=family,
            lens=lens,
            evidence={"track": lens, "rule": name, "scoring": scoring_style},
        ))

    if candidates:
        if scoring_style == "proof_first":
            perfect = [candidate for candidate in candidates if candidate.train_perfect]
            pool = perfect if perfect else candidates
            selected = max(pool, key=lambda candidate: candidate.score)
        else:
            selected = max(candidates, key=lambda candidate: candidate.score)
    else:
        selected = Candidate("fallback_zero", [[0]], 0.0, 0, len(train), "fallback", lens)

    return LockedAttempt(lens, selected.output, selected.output_hash, selected, lock_step, False)


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

    keyed_recolor = make_marker_shape_keyed_recolor_rule(train)
    if keyed_recolor is not None:
        rules.append(("marker_shape_keyed_recolor", "marker_keyed_recolor", keyed_recolor, 36.0 if native else 20.0))

    mapping = consistent_color_map(train)
    if mapping is not None:
        name = "analogical_color_transfer" if native else "consistent_color_map"
        family = "analogy" if native else "color_mapping"
        rules.append((name, family, lambda grid, m=mapping: apply_color_map(grid, m), 25.0 if native else 17.0))

    return rules


class HostileCourtroomTrackV3:
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


class ModelNativeTrackV3:
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


def solve_task_blinded_v3(task: Dict) -> Dict:
    audit_events = []

    step = 1
    first = HostileCourtroomTrackV3().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "hostile_track_locked", "output_hash": first.output_hash})

    step = 2
    second = ModelNativeTrackV3().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "native_track_locked", "output_hash": second.output_hash})

    step = 3
    audit = ConvergenceAuditor().audit(first, second)
    audit_events.append({"step": step, "event": "post_lock_convergence_audit", "same_output": audit["same_output"]})

    return {
        "attempt_1": first.output,
        "attempt_2": second.output,
        "proof": {
            "solver": "mc_arc_blinded_dual_track_solver_v3",
            "audit": audit,
            "audit_events": audit_events,
            "independence_rule": "Tracks lock outputs before comparison. No track receives the other's output before lock.",
        },
    }
