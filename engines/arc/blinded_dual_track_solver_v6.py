"""
Mirror Cartographer ARC blinded dual-track solver v6.

Voice-readable behavior:
Solver v6 keeps solver v5 intact and wires the v6 relation-composition movement primitives into the candidate system.

The new generator learns whether exactly one foreground component moves by the same row/column vector across the training pairs. If that proof holds, it applies the learned translation to the test grid only when the test grid also has exactly one foreground component.

This file does not claim a score improvement by itself. The benchmark workflow must prove whether the smoke result moves from 4/20 to 5/20.
"""

from __future__ import annotations

from typing import Callable, Dict, List, Optional, Tuple

from engines.arc.blinded_dual_track_solver import (
    ConvergenceAuditor,
    Grid,
    LockedAttempt,
)
from engines.arc.blinded_dual_track_solver_v3 import _select_candidate
from engines.arc.blinded_dual_track_solver_v5 import _base_rules as _v5_base_rules
from engines.arc.object_relations import extract_components
from engines.arc.relation_composition import (
    apply_learned_single_component_translation,
    learn_consistent_translation,
)


def _has_exactly_one_foreground_component(grid: Grid) -> bool:
    return len(extract_components(grid)) == 1


def make_learned_single_component_translation_rule(train: List[Dict[str, Grid]]) -> Optional[Callable[[Grid], Grid]]:
    """Infer a reusable single-component translation rule from training pairs.

    The rule is deliberately conservative:
    - every training input and output must have exactly one foreground component;
    - that component must move by the same vector across all training pairs;
    - runtime application requires the test grid to also have exactly one foreground component.

    This guardrail prevents the rule from choosing the largest or unique-color object in cluttered grids and creating false independent convergence.
    """
    if not train:
        return None

    for pair in train:
        if not _has_exactly_one_foreground_component(pair["input"]):
            return None
        if not _has_exactly_one_foreground_component(pair["output"]):
            return None

    vector = learn_consistent_translation(train)
    if vector is None:
        return None

    def transform(grid: Grid) -> Grid:
        if not _has_exactly_one_foreground_component(grid):
            raise ValueError("learned translation requires exactly one foreground component in test grid")
        return apply_learned_single_component_translation(train, grid)

    return transform


def _base_rules(train: List[Dict[str, Grid]], native: bool) -> List[Tuple[str, str, Callable[[Grid], Grid], float]]:
    rules = _v5_base_rules(train, native)

    learned_translation = make_learned_single_component_translation_rule(train)
    if learned_translation is not None:
        rules.append((
            "learned_single_component_translation",
            "relation_conditioned_translation",
            learned_translation,
            39.0 if native else 25.0,
        ))

    return rules


class HostileCourtroomTrackV6:
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


class ModelNativeTrackV6:
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


def solve_task_blinded_v6(task: Dict) -> Dict:
    audit_events = []

    step = 1
    first = HostileCourtroomTrackV6().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "hostile_track_locked", "output_hash": first.output_hash})

    step = 2
    second = ModelNativeTrackV6().run(task, lock_step=step)
    audit_events.append({"step": step, "event": "native_track_locked", "output_hash": second.output_hash})

    step = 3
    audit = ConvergenceAuditor().audit(first, second)
    audit_events.append({"step": step, "event": "post_lock_convergence_audit", "same_output": audit["same_output"]})

    return {
        "attempt_1": first.output,
        "attempt_2": second.output,
        "proof": {
            "solver": "mc_arc_blinded_dual_track_solver_v6",
            "audit": audit,
            "audit_events": audit_events,
            "independence_rule": "Tracks lock outputs before comparison. No track receives the other's output before lock.",
        },
    }
