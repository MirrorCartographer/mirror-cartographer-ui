# ARC Failure Taxonomy

Purpose: turn wrong answers into build instructions.

A failed ARC task should receive one or more labels.

## Current labels

- `duplicate_wrong_attempts`: both tracks produced the same wrong output.
- `false_convergence`: tracks converged, but the converged answer was wrong.
- `divergence_both_wrong`: tracks disagreed, and neither was correct.
- `courtroom_only_correct`: hostile courtroom track was correct, model-native track was wrong.
- `native_only_correct`: model-native track was correct, hostile courtroom track was wrong.
- `missing_public_output`: local benchmark file did not include an output for scoring.
- `solver_exception`: solver crashed.
- `unclassified_wrong_output`: wrong, but not yet classified.

## Build-oriented labels to add after manual review

- `missing_object_segmentation`: solver failed to identify relevant objects.
- `missing_relation_detection`: solver failed to infer inside/outside/touching/alignment/nearest relation.
- `missing_program_composition`: solver needed multiple composed transformations.
- `missing_pattern_completion`: solver failed continuation/symmetry/fill logic.
- `missing_context_switch`: same rule did not apply uniformly; context mattered.
- `overfit_rule`: solver chose an ad hoc visible rule that did not generalize.
- `underfit_rule`: solver chose too-simple rule.
- `shape_transform_failure`: solver failed to infer output dimensions.
- `color_semantics_failure`: solver misunderstood color roles.
- `search_budget_failure`: right family existed but was not searched or ranked.

## Rule

Every real benchmark run should produce a ranked list of failure families.
The next solver build should target the largest or most valuable failure family first.
