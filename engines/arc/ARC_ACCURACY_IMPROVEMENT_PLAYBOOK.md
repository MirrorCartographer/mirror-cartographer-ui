# ARC Accuracy Improvement Playbook

## Voice-readable summary

Accuracy improves when the solver stops guessing broadly and starts learning from failure precisely.

There are two kinds of accuracy:

1. Smoke-set accuracy: performance on the current first-20 public training smoke set.
2. Generalization accuracy: performance on broader unseen or held-out ARC tasks.

Smoke-set accuracy is useful for fast proof gates, but it can become overfit. Generalization accuracy is the real goal.

## Current measured state

Current verified ARC baseline:

- solver: v5 plus v6 primitive foundation
- smoke dataset: first 20 public ARC-AGI-2 training tasks in sorted filename order
- pass-at-two: 4/20
- pass-at-two accuracy: 0.20
- convergence total: 4
- convergence accuracy: 1.0
- failure count: 16

## Core principle

Do not add cleverness. Add discriminating capability.

A good new capability should:

1. explain at least one current failure
2. be reusable beyond that one task
3. have tests independent of the public task
4. avoid damaging solved tasks
5. improve or preserve smoke score
6. make the failure taxonomy more informative

## The accuracy loop

### Step 1: Measure

Run the benchmark and record:

- task IDs
- attempt one correct
- attempt two correct
- pass-at-two correct
- convergence count
- convergence accuracy
- failure count
- artifact ID

### Step 2: Inspect failures

For each failed task, ask:

- Is the output the wrong shape?
- Is the right object selected?
- Is the object transformed incorrectly?
- Is the object placed incorrectly?
- Is color mapping wrong?
- Is the output constructed from a count?
- Is the solver overfitting the training examples?

### Step 3: Cluster failures

Group failures by missing capability, not by task ID.

Useful clusters:

- object selection failure
- relation selection failure
- movement / translation failure
- copy / placement failure
- crop / extraction failure
- line extension failure
- symmetry / completion failure
- count-to-construction failure
- recolor-by-relation failure
- multi-step composition failure

### Step 4: Choose the next smallest reusable capability

Prefer a primitive that can solve one visible failure and plausibly help many later tasks.

Bad next move:

- hard-code a task ID
- add a rule that only recognizes one exact grid
- reward a generator because it feels plausible without benchmark proof

Good next move:

- add a selector, operator, or placer
- add a composed program that passes training examples
- add tests using synthetic examples independent of the benchmark task
- benchmark before claiming improvement

### Step 5: Protect solved tasks

Every new generator can hurt old solved tasks if scoring changes.

A generator should earn priority by:

- training exactness
- output shape plausibility
- low ambiguity
- limited scope
- confidence label

### Step 6: Run benchmark

If score improves, log it.

If score does not improve but no regression occurs, keep only if it is infrastructure with clear future value.

If score regresses, do not merge unless the regression exposes a known bug and the PR fixes the underlying measurement issue.

## How to raise smoke accuracy from 4/20 to 5/20

The current best route is relation-conditioned composition.

The solver now has:

- component extraction
- object descriptors
- relation descriptors
- selectors
- patch extraction
- erase / paste
- translation helpers

The next solver integration should:

1. detect when training pairs show a single moved component
2. learn the movement vector
3. apply the movement to the test component
4. submit that as one candidate if training examples are exact

This should target movement / translation families without hard-coding a specific task.

## Accuracy versus confidence

A solver can be confident and wrong.

Confidence should only rise when:

- a candidate is exact on all training examples
- the same output emerges from independent paths
- the operation is low ambiguity
- the output shape is plausible
- no solved-task regression occurs

Confidence should fall when:

- many candidate rules fit training examples
- output shape changes without explanation
- the generator relies on one color or one position too specifically
- the rule only works by matching a known task ID

## Two-answer policy

ARC scoring allows two attempts.

Use the two attempts intelligently:

- If both tracks converge, submit the same output twice or equivalent high-confidence outputs.
- If tracks diverge, submit two meaningfully different candidates.
- Do not waste attempt two on a near-duplicate unless convergence is the evidence.
- Attempt two should represent a different plausible hypothesis, not random variation.

## What increases real generalization

1. DSL primitives that combine cleanly.
2. Broad failure taxonomy.
3. Held-out validation beyond the smoke set.
4. Runtime and candidate-budget control.
5. Simplicity penalty for overfit programs.
6. More robust object perception.
7. Program synthesis over selector/operator/placer primitives.
8. Better ambiguity handling.
9. Public-eval and Kaggle-shaped submission tests.
10. Honest non-regression logging.

## What produces fake accuracy

1. Exhausting a toy suite.
2. Hard-coding task IDs.
3. Matching exact grid sizes from public tasks.
4. Adding dozens of brittle generators without scoring discipline.
5. Reporting only successes.
6. Ignoring failed solved tasks after a new rule.
7. Treating smoke-set gains as private leaderboard evidence.

## Accuracy ladder

### Level 1: Toy proof

The primitive works on synthetic examples.

### Level 2: Smoke proof

The primitive improves or preserves first-20 public training smoke score.

### Level 3: Public training breadth

The primitive improves a larger public training/evaluation subset.

### Level 4: Held-out discipline

The primitive holds up on unseen or pseudo-held-out tasks.

### Level 5: Kaggle readiness

The solver runs offline, deterministically, within runtime budget, and produces valid submission JSON.

### Level 6: Prize relevance

The system demonstrates broad generalization, not just accumulated local wins.

## Immediate next implementation target

Build solver integration for v6 relation primitives:

- add a candidate generator for learned single-component translation
- give it high score only when exact on all training pairs
- ensure it does not override stronger solved generators incorrectly
- run smoke benchmark
- claim improvement only if pass-at-two moves from 4/20 to 5/20 or better

## Claim boundary

Allowed:

We know how to improve accuracy structurally: failure clustering, reusable primitives, solver integration, benchmark proof, and non-regression gates.

Not allowed:

We know the solver will reach 100% from the current architecture.

## Core phrase

Accuracy is not confidence. Accuracy is survived prediction.
