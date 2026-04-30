# ARC Training Smoke Benchmark v2 — 2026-04-30

## Voice-readable summary

Solver v2 improved the first-20 public ARC-AGI-2 training smoke benchmark from 0/20 to 2/20 pass-at-two.

This is real improvement, but it is still not competitive ARC performance.

## Run source

- PR: #10
- Workflow: ARC Training Smoke Benchmark
- Workflow run ID: 25145031409
- Artifact name: arc-training-smoke-20-result
- Artifact ID: 6721956767
- Artifact digest: d655c99402e451f74115a0510189181b39440cadd8b8ea9435ed1fd666facb6f

## Dataset

- Source: public `arcprize/ARC-AGI-2` repository
- Split: training
- Subset: first 20 JSON tasks in sorted order
- Items total: 20

## Solver

- Solver file: `engines/arc/blinded_dual_track_solver_v2.py`
- Runner: `engines/arc/run_public_benchmark.py`

## Added capabilities

- alternating 2x2 to 6x6 tiling
- self-mask expansion
- mask background selection prefers `0` when present

## Result

- Attempt 1 correct: 2
- Attempt 2 correct: 2
- Pass-at-two correct: 2
- Pass-at-two accuracy: 0.10
- Convergence total: 2
- Convergence accuracy: 1.0
- Failure count: 18

## What this proves

- The smoke benchmark path is working.
- The solver can improve when real failure patterns are converted into generators.
- The two added generators solved two tasks in the smoke set.
- The convergence cases in this run were correct.

## What this does not prove

- It does not prove ARC competitiveness.
- It does not prove public-evaluation performance.
- It does not prove private-evaluation performance.
- It does not prove 85%, 99%, or 100% accuracy.
- It does not prove the architecture is sufficient; it proves the improvement loop works.

## Next target

Move from 2/20 to 3/20 on the same smoke set.

Expected next work:

1. inspect the remaining 18 failures
2. identify the next repeated pattern family
3. add one or two targeted generators
4. add tests
5. rerun the smoke benchmark
6. record result here or in a new report

## Claim boundary

Allowed claim:

Solver v2 scored 2/20 pass-at-two on the first 20 public ARC-AGI-2 training tasks in PR #10's smoke workflow.

Forbidden claim:

Solver v2 is competitive for ARC Prize.
