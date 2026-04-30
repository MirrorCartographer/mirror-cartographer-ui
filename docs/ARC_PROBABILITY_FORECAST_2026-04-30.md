# ARC Probability Forecast — 2026-04-30

## Voice-readable summary

This is a forecast, not a promise. Current evidence says the system is becoming real, but it is still far from a likely grand-prize winner.

The best near-term probability is not the grand prize. The best near-term probability is a credible ARC-AGI-2 submission plus a paper-track contribution.

## Current measured state

Current repo baseline:

- solver: v5
- dataset: first 20 public ARC-AGI-2 training tasks in sorted filename order
- pass-at-two: 4/20
- pass-at-two accuracy: 0.20
- convergence total: 4
- convergence accuracy: 1.0
- failure count: 16
- latest proof: PR #17 / workflow run 25147949154 / artifact 6722953575

This is real progress but not leaderboard evidence.

## Win definitions

### Definition A: Grand-prize win

Meaning: win the top ARC Prize / reach the required benchmark threshold under official rules.

Current probability estimate: less than 1% from current state.

Reason: current solver is still primitive, public smoke score is small, and the private evaluation distribution will punish overfit generator accumulation.

### Definition B: Top leaderboard or major cash placement

Meaning: place high enough in ARC-AGI-2 or ARC-AGI-3 to receive a significant score-based prize.

Current probability estimate: 1% to 5% if the build continues intensely and moves from generator collection into program synthesis, broad evaluation, and Kaggle-ready execution.

Reason: possible but requires major engineering beyond the current 4/20 smoke score.

### Definition C: Paper Prize relevance

Meaning: submit a serious paper-track contribution with linked code, clear experiments, theory, failure taxonomy, and reproducible artifacts.

Current probability estimate: 15% to 35% if we keep logging proof and build the public-evaluation harness, failure gallery, Kaggle notebook, and paper narrative.

Reason: paper prize rewards conceptual progress, novelty, completeness, theory, and demonstrated approach, not only top score.

### Definition D: Legitimate public ARC submission

Meaning: produce a reproducible Kaggle-shaped code submission with no internet/API dependency and documented results.

Current probability estimate: 70% to 90% if user completes required external account/submission steps.

Reason: the repo already has a solver, benchmark harness, public-eval harness, proof ledger, and submission-shaped output work.

## What would increase probability most

1. Move from first-20 smoke to broader public training/evaluation reporting.
2. Build a real DSL/program-synthesis layer instead of one generator per task.
3. Add a failure-gallery dashboard for every public task failure.
4. Add a Kaggle notebook skeleton that runs offline.
5. Add runtime budget controls.
6. Build relation-conditioned composition:
   - select source object
   - select marker object
   - select anchor object
   - infer operation
   - place output object
7. Run overfit audits on held-out public or pseudo-held-out tasks.
8. Write paper sections while experiments are being built.

## What would reduce probability

1. Treating synthetic 20/20 as evidence of official competitiveness.
2. Building only task-specific generators without abstraction.
3. Failing to run broader public evaluations.
4. Using GPT/API dependencies in the evaluation path.
5. Not submitting through Kaggle.
6. Not logging proof artifacts.

## Current strategic recommendation

Do not aim only at the grand prize.

Aim at four layers:

1. Valid Kaggle-shaped submission.
2. Public ARC evaluation report.
3. Paper Prize submission.
4. Continued solver accuracy improvement.

## Current next gates

- solver gate: 4/20 to 5/20 on first-20 smoke
- evaluation gate: Kaggle notebook skeleton
- paper gate: experiment log plus failure taxonomy section
- scale gate: run more than first 20 tasks and report true broader public result

## Claim boundary

Allowed:
We have a measured 4/20 first-20 public training smoke result and a plausible path to a legitimate submission and paper-track attempt.

Not allowed:
We are likely to win the grand prize from current state.

## Forecast phrase

Grand prize: possible, not likely.

Paper-track contribution: plausible.

Legitimate submission: highly reachable.
