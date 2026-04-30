# ARC Training Smoke Benchmark v3 — 2026-04-30

## Voice-readable summary

Solver v3 improved the first-20 public ARC-AGI-2 training smoke benchmark from 2/20 to 3/20 pass-at-two.

This is real improvement, but it is still not competitive ARC performance.

## Run source

- PR: #12
- Workflow: ARC Training Smoke Benchmark
- Workflow run ID: 25145694262
- Artifact name: arc-training-smoke-20-result
- Artifact ID: 6722201552
- Artifact digest: 7652edc1056dd5ad6693bd264ecf43bce56096b3f2fb47417c129eab3a796e14

## Dataset

- Source: public `arcprize/ARC-AGI-2` repository
- Split: training
- Subset: first 20 JSON tasks in sorted order
- Items total: 20

## Solver

- Solver file: `engines/arc/blinded_dual_track_solver_v3.py`
- Runner: `engines/arc/run_public_benchmark.py`

## Added capability

- marker-shape keyed recolor

## Result

- Attempt 1 correct: 3
- Attempt 2 correct: 3
- Pass-at-two correct: 3
- Pass-at-two accuracy: 0.15
- Convergence total: 3
- Convergence accuracy: 1.0
- Failure count: 17

## What this proves

- The smoke benchmark path is working.
- The solver can improve through targeted generators derived from real failure inspection.
- The marker-shape keyed recolor generator solved one additional task family in the smoke set.
- The convergence cases in this run were correct.

## What this does not prove

- It does not prove ARC competitiveness.
- It does not prove public-evaluation performance.
- It does not prove private-evaluation performance.
- It does not prove 85%, 99%, or 100% accuracy.
- It does not prove the architecture is sufficient; it proves the improvement loop continues to work.

## Next target

Move from 3/20 to 4/20 on the same smoke set.

Expected next work:

1. inspect the remaining 17 failures
2. identify the next repeated or tractable pattern family
3. add one targeted generator
4. add tests
5. rerun the smoke benchmark
6. record result in a new report

## Claim boundary

Allowed claim:

Solver v3 scored 3/20 pass-at-two on the first 20 public ARC-AGI-2 training tasks in PR #12's smoke workflow.

Forbidden claim:

Solver v3 is competitive for ARC Prize.
