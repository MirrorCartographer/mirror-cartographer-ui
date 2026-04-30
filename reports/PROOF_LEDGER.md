# Mirror Cartographer Proof Ledger

## Voice-readable summary

This ledger records the current proof trail for Mirror Cartographer work. It is not a hype document. It separates verified, measured, implemented, planned, and speculative claims.

## Current verified / measured milestones

### 1. Working machine infrastructure merged

Status: implemented.

Claim:
The repo has a working-machine infrastructure with system map, workstreams, proof protocol, delegated-action protocol, accessibility protocol, ARC harness, opportunity engine root, reports area, and CI checks.

Proof:
- PR #1 merged.
- CI passed before merge.
- Files added under `docs/`, `protocols/`, `engines/arc/`, `engines/opportunity/`, and `reports/arc/`.

Limitation:
This proves infrastructure exists. It does not prove ARC performance.

### 2. Blinded dual-track ARC solver v1 merged

Status: implemented.

Claim:
The repo contains an offline blinded dual-track ARC solver scaffold with hostile-courtroom and model-native tracks, locked-before-comparison audit, tests, and benchmark runner.

Proof:
- PR #2 merged.
- CI passed before merge.
- Files added under `engines/arc/`.

Limitation:
This proved solver mechanics, not competitive ARC accuracy.

### 3. Real ARC benchmark workflow merged

Status: implemented.

Claim:
The repo contains a manual workflow and automatic smoke workflow capable of cloning public ARC-AGI-2 data and running the solver against a public training subset.

Proof:
- PR #3 merged.
- PR #4 merged.
- Workflows added under `.github/workflows/`.

Limitation:
Workflow existence does not equal solver performance.

### 4. First real ARC smoke baseline recorded

Status: measured.

Claim:
The first real smoke benchmark on the first 20 public ARC-AGI-2 training tasks scored 0/20 pass-at-two.

Proof:
- PR #5 recorded the working smoke path and import fix.
- PR #7 recorded the baseline report.
- Report path: `reports/arc/training_smoke_20_2026-04-30.md`.

Measured result:
- items total: 20
- attempt 1 correct: 0
- attempt 2 correct: 0
- pass-at-two correct: 0
- pass-at-two accuracy: 0.0
- convergence total: 3
- convergence accuracy: 0.0
- failure count: 20

Limitation:
This proved benchmark contact and poor baseline performance, not competitiveness.

### 5. Dualpath convergence doctrine merged

Status: implemented.

Claim:
The repo contains a general dualpath convergence doctrine linking ARC, music taste, safe bounty reporting, and art generation.

Proof:
- PR #9 merged.
- Files:
  - `protocols/convergence/DUALPATH_CONVERGENCE_ENGINE.md`
  - `engines/music/TASTE_CONVERGENCE_ENGINE.md`
  - `engines/safety/SAFE_BOUNTY_REPORTING_ENGINE.md`

Limitation:
Doctrine exists. Domain performance still requires tests or artifacts.

### 6. ARC solver v2 improved smoke benchmark

Status: measured.

Claim:
Solver v2 improved the first-20 public ARC training smoke benchmark from 0/20 to 2/20 pass-at-two.

Proof:
- PR #10 merged.
- Workflows passed:
  - Working Machine Checks: success
  - ARC Training Smoke Benchmark: success
- Workflow run ID: 25145031409
- Artifact ID: 6721956767
- Artifact digest: d655c99402e451f74115a0510189181b39440cadd8b8ea9435ed1fd666facb6f

Measured result:
- items total: 20
- attempt 1 correct: 2
- attempt 2 correct: 2
- pass-at-two correct: 2
- pass-at-two accuracy: 0.10
- convergence total: 2
- convergence accuracy: 1.0
- failure count: 18

Limitation:
This is a small smoke-set improvement. It does not prove ARC competitiveness, public-evaluation performance, private-evaluation performance, or 100% accuracy.

### 7. Codex Desktop bridge started

Status: implemented in branch.

Claim:
A Codex bridge protocol and `AGENTS.md` were added to guide local/Codex work through the same proof gates.

Proof:
- Branch: `mc-codex-desktop-bridge-v1`.
- Files:
  - `AGENTS.md`
  - `protocols/delegation/CODEX_DESKTOP_BRIDGE.md`
  - `docs/ARC_CARTOGRAPHER_SUBMISSION_STRATEGY.md`
  - `protocols/proof/PROOF_LOGGING_STANDARD.md`

Limitation:
This branch still needs PR, CI, and merge before becoming mainline repo state.

## Current ARC baseline

Current verified smoke benchmark:

- first 20 public ARC-AGI-2 training tasks
- pass-at-two: 2/20
- accuracy: 0.10

Current next target:

- 3/20 on the same smoke set
- then full training benchmark
- then Kaggle notebook scaffold
- then paper-track draft

## Universal claim boundary

Allowed:
We are building a proof-logged, reproducible solver/toolchain and have measured improvement from 0/20 to 2/20 on a small public training smoke set.

Not allowed:
We can already win ARC, guarantee 100%, or claim private leaderboard performance.

## Core phrase

Proof turns momentum into memory.
