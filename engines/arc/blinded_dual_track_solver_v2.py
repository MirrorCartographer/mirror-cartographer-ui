"""
Mirror Cartographer ARC blinded dual-track solver v2.

Voice-readable behavior:
This version keeps the two-track structure from v1 and adds two concrete generators discovered from the first smoke-set tasks.

Generator one is 2x2 alternating tile expansion. It maps a 2 by 2 input into a 6 by 6 output by repeating the original rows, then horizontally flipped rows, then original rows again.

Generator two is self-mask expansion. It treats the input grid as a mask. For every non-background cell, it places a full copy of the input grid into the corresponding output block. For every background cell, it places a blank block.

These rules are intentionally specific and proof-scored against the visible training examples. They are not claims of broad ARC intelligence.
"""

from __future__ import annotations

from typing import Callable, Dict, List, Tuple

from engines.arc.blinded_dual_track_solver import (
    Candidate,
    ConvergenceAuditor,
    Grid,
    LockedAttempt,
    apply_color_map,
    background_color,
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


def alternating_tile_2x2_to_6x6(grid: Grid) -> Grid:
    """Expand a 2x2 grid into the alternating 6x6 pattern seen in task 00576224."""
    if len(grid) != 2 or len(grid[0]) != 2:
        raise ValueError("alternating_tile_2x2_to_6x6 requires a 2x2 grid")
    top = grid[0] * 3
    bottom = grid[1] * 3
    top_flipped = grid[0][::-1] * 3
    bottom_flipped = grid[1][::-1] * 3
    return [top, bottom, top_flipped, bottom_flipped, top, bottom]


def mask_background_color(grid: Grid) -> int:
    """Choose the blank color for mask expansion.

    ARC mask tasks often use 0 as blank even when 0 is not the most common
    color. Prefer 0 when present; otherwise fall back to the generic background
    heuristic.
    """
    if any(cell == 0 for row in grid for cell in row):
        return 0
    return background_color(grid)


def self_mask_expand(grid: Grid) -> Grid:
    """Use the input grid as a mask over copies of itself.

    For an h by w grid, produce an h*h by w*w output. Each non-background input
    cell receives a full copy of the input grid in its block. Each background
    input cell receives a blank block.
    """
    height = len(grid)
    width = len(grid[0]) if grid else 0
    if height == 0 or width == 0:
        raise ValueError("self_mask_expand requires a non-empty grid")
    bg = mask_background_color(grid)
    output = [[bg for _ in range(width * width)] for _ in range(height * height)]
    for block_row in range(height):
        for block_col in range(width):
            if grid[block_row][block_col] == bg:
                continue
            for inner_row in range(height):
                for inner_col in range(width):
                    output[block_row * height + inner_row][block_col * width + inner_col] = grid[inner_row][inner_col]
    return output


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


class HostileCourtroomTrackV2:
    lens = "hostile_courtroom"

    def run(self, task: Dict, lock_step: int) -> LockedAttempt:
        train = task.get("train", [])
        rules: List[Tuple[str, str, Callable[[Grid], Grid], float]] = [
            ("identity", "direct", lambda grid: grid, 19.0),
            ("rotate180", "direct", rotate180, 18.0),
            ("flip_h", "direct", flip_h, 18.0),
            ("flip_v", "direct", flip_v, 18.0),
            ("alternating_tile_2x2_to_6x6", "tiling", alternating_tile_2x2_to_6x6, 16.0),
            ("self_mask_expand", "mask_expansion", self_mask_expand, 15.0),
        ]

        mapping = consistent_color_map(train)
        if mapping is not None:
            rules.append(("consistent_color_map", "color_mapping", lambda grid, m=mapping: apply_color_map(grid, m), 17.0))

        return _select_candidate(lens=self.lens, task=task, rules=rules, lock_step=lock_step, scoring_style="proof_first")


class ModelNativeTrackV2:
    lens = "model_native_bounded"

    def run(self, task: Dict, lock_step: int) -> LockedAttempt:
        train = task.get("train", [])
        rules: List[Tuple[str, str, Callable[[Grid], Grid], float]] = [
            ("complete_horizontal_symmetry", "symmetry_completion", complete_horizontal_symmetry, 30.0),
            ("complete_vertical_symmetry", "symmetry_completion", complete_vertical_symmetry, 30.0),
            ("alternating_tile_2x2_to_6x6", "tiling", alternating_tile_2x2_to_6x6, 34.0),
            ("self_mask_expand", "mask_expansion", self_mask_expand, 34.0),
            ("flip_h_visual", "visual_transform", flip_h, 18.0),
            ("flip_v_visual", "visual_transform", flip_v, 18.0),
            ("rotate180_visual", "visual_transform", rotate180, 16.0),
        ]

        mapping = consistent_color_map(train)
        if mapping is not None:
            rules.append(("analogical_color_transfer", "analogy", lambda grid, m=mapping: apply_color_map(grid, m), 25.0))

        return _select_candidate(lens=self.lens, task=task, rules=rules, lock_step=lock_step, scoring_style="pattern_first_bounded")


def solve_task_blinded_v2(task: Dict) -> Dict:
    audit_events = []

    step = 1
    first = HostileCourtroomTrackV2().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "hostile_track_locked", "output_hash": first.output_hash})

    step = 2
    second = ModelNativeTrackV2().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "native_track_locked", "output_hash": second.output_hash})

    step = 3
    audit = ConvergenceAuditor().audit(first, second)
    audit_events.append({"step": step, "event": "post_lock_convergence_audit", "same_output": audit["same_output"]})

    return {
        "attempt_1": first.output,
        "attempt_2": second.output,
        "proof": {
            "solver": "mc_arc_blinded_dual_track_solver_v2",
            "audit": audit,
            "audit_events": audit_events,
            "independence_rule": "Tracks lock outputs before comparison. No track receives the other's output before lock.",
        },
    }
