# ARC Training Smoke Benchmark — 2026-04-30

## Voice-readable summary

The first real ARC smoke benchmark successfully reached public ARC data, copied the first 20 public training tasks, ran the blinded dual-track solver, printed a summary, and uploaded a result artifact.

The result was 0 out of 20 pass-at-two correct.

This is not competitive performance. It is the first honest measurement proving the benchmark path works and the current solver scaffold is too shallow for real ARC tasks.

## Run source

- GitHub Actions workflow: ARC Training Smoke Benchmark
- Workflow run ID: 25142693222
- Artifact name: arc-training-smoke-20-result
- Artifact ID: 6721166561
- Artifact digest reported by GitHub Actions: b3f1739aa781f1023ec450f5d5886f225932e1c5e15b78c15634e0cc43ba3588

## Dataset

- Source: public `arcprize/ARC-AGI-2` repository
- Split: training
- Subset: first 20 JSON tasks in sorted order
- Items total: 20

## Result

- Attempt 1 correct: 0
- Attempt 2 correct: 0
- Pass-at-two correct: 0
- Pass-at-two accuracy: 0.0
- Convergence total: 3
- Convergence accuracy: 0.0
- Failure count: 20

## What this proves

- The GitHub Actions benchmark path can clone ARC-AGI-2 public data.
- The workflow can prepare a real training subset.
- The benchmark runner can execute the solver on real ARC task files.
- The artifact upload path works.
- The current solver scaffold is not yet materially capable on real ARC tasks.

## What this does not prove

- It does not prove ARC competitiveness.
- It does not prove public-evaluation performance.
- It does not prove private leaderboard performance.
- It does not prove the dual-track architecture is sufficient.
- It does not prove the architecture is wrong; it proves the current generator set is far too shallow.

## Immediate diagnosis

The current solver mostly tries simple transforms, color mapping, symmetry completion, and visual transforms. The first 20 real ARC training tasks require richer capabilities than this.

Most likely missing capability families:

1. object segmentation beyond simple whole-grid transforms
2. output shape inference
3. relational reasoning between objects
4. program composition
5. contextual rule switching
6. object movement/copying/deletion
7. color-role semantics
8. line/region/fill logic
9. sequence or pattern continuation
10. task-specific abstraction beyond direct transforms

## Next build target

Build `mc-arc-generator-expansion-v1` with:

1. failure summary tooling
2. richer object extraction
3. output-shape candidate families
4. object crop/render candidates
5. copy/move/recolor primitives
6. failure-label fields in benchmark reports
7. smoke benchmark rerun after expansion

## Claim boundary

Allowed claim:

On the first 20 public ARC-AGI-2 training tasks, the current blinded dual-track scaffold scored 0/20 pass-at-two in the GitHub Actions smoke benchmark.

Forbidden claim:

The system can win ARC.
