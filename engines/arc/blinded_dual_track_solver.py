"""
Mirror Cartographer ARC blinded dual-track solver v1.

Voice-readable behavior:
This solver makes two answers in separate tracks before comparing them.
Track A is the hostile courtroom track: it favors exact training fit, simple rules, and proof-first transforms.
Track B is the model-native track: it favors symmetry, analogy, completion, and pattern fluency, while still checking training examples.
The two tracks lock their outputs before the convergence audit compares them.

This is an offline scaffold. It does not call the internet or any external model.
It is not a winning ARC solver yet. Accuracy claims require benchmark reports.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple
import copy
import hashlib
import json

Grid = List[List[int]]


def shape(grid: Grid) -> Tuple[int, int]:
    return (len(grid), len(grid[0]) if grid else 0)


def valid_grid(grid: Any) -> bool:
    if not isinstance(grid, list) or not grid:
        return False
    width = None
    for row in grid:
        if not isinstance(row, list) or not row:
            return False
        if width is None:
            width = len(row)
        if len(row) != width:
            return False
        for cell in row:
            if not isinstance(cell, int) or cell < 0 or cell > 9:
                return False
    return True


def stable_hash(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def clone_task(task: Dict[str, Any]) -> Dict[str, Any]:
    return copy.deepcopy(task)


def rotate180(grid: Grid) -> Grid:
    return [row[::-1] for row in grid[::-1]]


def flip_h(grid: Grid) -> Grid:
    return [row[::-1] for row in grid]


def flip_v(grid: Grid) -> Grid:
    return grid[::-1]


def background_color(grid: Grid) -> int:
    counts = Counter(cell for row in grid for cell in row)
    return counts.most_common(1)[0][0]


def color_mapping(inp: Grid, out: Grid) -> Optional[Dict[int, int]]:
    if shape(inp) != shape(out):
        return None
    mapping: Dict[int, int] = {}
    for row_index in range(len(inp)):
        for col_index in range(len(inp[0])):
            source = inp[row_index][col_index]
            target = out[row_index][col_index]
            if source in mapping and mapping[source] != target:
                return None
            mapping[source] = target
    return mapping


def consistent_color_map(train: List[Dict[str, Grid]]) -> Optional[Dict[int, int]]:
    merged: Dict[int, int] = {}
    for pair in train:
        mapping = color_mapping(pair["input"], pair["output"])
        if mapping is None:
            return None
        for source, target in mapping.items():
            if source in merged and merged[source] != target:
                return None
            merged[source] = target
    return merged


def apply_color_map(grid: Grid, mapping: Dict[int, int]) -> Grid:
    return [[mapping.get(cell, cell) for cell in row] for row in grid]


def complete_horizontal_symmetry(grid: Grid) -> Grid:
    out = [row[:] for row in grid]
    bg = background_color(grid)
    height, width = shape(grid)
    for row in range(height):
        for col in range(width):
            mirror_col = width - 1 - col
            if out[row][col] == bg and out[row][mirror_col] != bg:
                out[row][col] = out[row][mirror_col]
            elif out[row][col] != bg and out[row][mirror_col] == bg:
                out[row][mirror_col] = out[row][col]
    return out


def complete_vertical_symmetry(grid: Grid) -> Grid:
    out = [row[:] for row in grid]
    bg = background_color(grid)
    height, width = shape(grid)
    for row in range(height):
        mirror_row = height - 1 - row
        for col in range(width):
            if out[row][col] == bg and out[mirror_row][col] != bg:
                out[row][col] = out[mirror_row][col]
            elif out[row][col] != bg and out[mirror_row][col] == bg:
                out[mirror_row][col] = out[row][col]
    return out


def score_rule(train: List[Dict[str, Grid]], transform: Callable[[Grid], Grid]) -> Tuple[int, float]:
    exact = 0
    for pair in train:
        try:
            predicted = transform(pair["input"])
        except Exception:
            predicted = None
        if predicted == pair["output"]:
            exact += 1
    total = len(train)
    return exact, exact / total if total else 0.0


@dataclass
class Candidate:
    name: str
    output: Grid
    score: float
    train_exact: int
    train_total: int
    family: str
    lens: str
    evidence: Dict[str, Any] = field(default_factory=dict)

    @property
    def train_perfect(self) -> bool:
        return self.train_total > 0 and self.train_exact == self.train_total

    @property
    def output_hash(self) -> str:
        return stable_hash(self.output)

    def summary(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "family": self.family,
            "lens": self.lens,
            "score": round(self.score, 4),
            "train_exact": self.train_exact,
            "train_total": self.train_total,
            "train_perfect": self.train_perfect,
            "output_hash": self.output_hash,
            "evidence": self.evidence,
        }


@dataclass
class LockedAttempt:
    lens: str
    output: Grid
    output_hash: str
    candidate: Candidate
    locked_at_step: int
    saw_other_track_before_lock: bool = False

    def summary(self) -> Dict[str, Any]:
        return {
            "lens": self.lens,
            "output_hash": self.output_hash,
            "locked_at_step": self.locked_at_step,
            "saw_other_track_before_lock": self.saw_other_track_before_lock,
            "candidate": self.candidate.summary(),
        }


class HostileCourtroomTrack:
    lens = "hostile_courtroom"

    def run(self, task: Dict[str, Any], lock_step: int) -> LockedAttempt:
        local_task = clone_task(task)
        train = local_task.get("train", [])
        test_input = local_task.get("test", [{}])[0].get("input", [[0]])
        candidates: List[Candidate] = []

        rules: List[Tuple[str, str, Callable[[Grid], Grid], int]] = [
            ("identity", "direct", lambda grid: grid, 1),
            ("rotate180", "direct", rotate180, 2),
            ("flip_h", "direct", flip_h, 2),
            ("flip_v", "direct", flip_v, 2),
        ]

        mapping = consistent_color_map(train)
        if mapping is not None:
            rules.append(("consistent_color_map", "color_mapping", lambda grid, m=mapping: apply_color_map(grid, m), 3))

        for name, family, transform, complexity in rules:
            exact, ratio = score_rule(train, transform)
            try:
                output = transform(test_input)
            except Exception:
                continue
            if not valid_grid(output):
                continue
            proof_bonus = 100 if exact == len(train) and len(train) > 0 else 0
            simplicity_bonus = max(0, 20 - complexity)
            score = proof_bonus + 50 * ratio + simplicity_bonus
            candidates.append(Candidate(
                name=name,
                output=output,
                score=score,
                train_exact=exact,
                train_total=len(train),
                family=family,
                lens=self.lens,
                evidence={"track": self.lens, "rule": name, "scoring": "proof_first"},
            ))

        if candidates:
            perfect = [candidate for candidate in candidates if candidate.train_perfect]
            pool = perfect if perfect else candidates
            selected = max(pool, key=lambda candidate: candidate.score)
        else:
            selected = Candidate("fallback_zero", [[0]], 0.0, 0, len(train), "fallback", self.lens)

        return LockedAttempt(self.lens, selected.output, selected.output_hash, selected, lock_step, False)


class ModelNativeTrack:
    lens = "model_native_bounded"

    def run(self, task: Dict[str, Any], lock_step: int) -> LockedAttempt:
        local_task = clone_task(task)
        train = local_task.get("train", [])
        test_input = local_task.get("test", [{}])[0].get("input", [[0]])
        candidates: List[Candidate] = []

        rules: List[Tuple[str, str, Callable[[Grid], Grid], float]] = [
            ("complete_horizontal_symmetry", "symmetry_completion", complete_horizontal_symmetry, 30.0),
            ("complete_vertical_symmetry", "symmetry_completion", complete_vertical_symmetry, 30.0),
            ("flip_h_visual", "visual_transform", flip_h, 18.0),
            ("flip_v_visual", "visual_transform", flip_v, 18.0),
            ("rotate180_visual", "visual_transform", rotate180, 16.0),
        ]

        mapping = consistent_color_map(train)
        if mapping is not None:
            rules.append(("analogical_color_transfer", "analogy", lambda grid, m=mapping: apply_color_map(grid, m), 25.0))

        for name, family, transform, native_prior in rules:
            exact, ratio = score_rule(train, transform)
            try:
                output = transform(test_input)
            except Exception:
                continue
            if not valid_grid(output):
                continue
            score = native_prior + 55 * ratio + (20 if exact == len(train) and len(train) > 0 else 0)
            candidates.append(Candidate(
                name=name,
                output=output,
                score=score,
                train_exact=exact,
                train_total=len(train),
                family=family,
                lens=self.lens,
                evidence={"track": self.lens, "rule": name, "scoring": "pattern_first_bounded"},
            ))

        if candidates:
            selected = max(candidates, key=lambda candidate: candidate.score)
        else:
            selected = Candidate("fallback_zero", [[0]], 0.0, 0, len(train), "fallback", self.lens)

        return LockedAttempt(self.lens, selected.output, selected.output_hash, selected, lock_step, False)


class ConvergenceAuditor:
    def audit(self, first: LockedAttempt, second: LockedAttempt) -> Dict[str, Any]:
        same = first.output_hash == second.output_hash
        both_blind = not first.saw_other_track_before_lock and not second.saw_other_track_before_lock

        if same and both_blind and first.candidate.train_perfect and second.candidate.train_perfect:
            quality = "independent_convergence_strong"
        elif same and both_blind:
            quality = "independent_convergence_weak"
        elif not same and first.candidate.train_perfect and second.candidate.train_perfect:
            quality = "principled_divergence_both_strong"
        elif first.candidate.train_perfect and not second.candidate.train_perfect:
            quality = "courtroom_strong_native_weak"
        elif second.candidate.train_perfect and not first.candidate.train_perfect:
            quality = "native_strong_courtroom_weak"
        else:
            quality = "unresolved_both_weak"

        return {
            "same_output": same,
            "both_tracks_blinded_before_lock": both_blind,
            "convergence_quality": quality,
            "attempt_1": first.summary(),
            "attempt_2": second.summary(),
            "claim_scope": "Internal independent-convergence audit only; does not prove hidden ARC correctness.",
        }


def solve_task_blinded(task: Dict[str, Any]) -> Dict[str, Any]:
    audit_events = []
    step = 1
    first = HostileCourtroomTrack().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "hostile_track_locked", "output_hash": first.output_hash})

    step = 2
    second = ModelNativeTrack().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "native_track_locked", "output_hash": second.output_hash})

    step = 3
    audit = ConvergenceAuditor().audit(first, second)
    audit_events.append({"step": step, "event": "post_lock_convergence_audit", "same_output": audit["same_output"]})

    return {
        "attempt_1": first.output,
        "attempt_2": second.output,
        "proof": {
            "solver": "mc_arc_blinded_dual_track_solver_v1",
            "audit": audit,
            "audit_events": audit_events,
            "independence_rule": "Tracks lock outputs before comparison. No track receives the other's output before lock.",
        },
    }
