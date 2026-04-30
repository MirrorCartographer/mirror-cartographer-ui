# ARC Cartographer Submission Strategy

## Voice-readable summary

The realistic competition target is not an instant grand-prize claim. The realistic target is a serious ARC-AGI-2 solver plus a Paper Prize submission that demonstrates a novel, reproducible approach.

## Current verified competition constraints

- ARC Prize 2026 has three tracks: ARC-AGI-3, ARC-AGI-2, and Paper Prize.
- Submissions must go through the designated Kaggle competition.
- Internet access is not available during Kaggle evaluation.
- API-based systems like GPT or Claude cannot be used during evaluation.
- Prize eligibility requires reproducible, open-source submissions.
- Paper Prize submissions must link to a Kaggle code submission that demonstrates the approach.
- The paper does not need a top score to be eligible, but accuracy still contributes to the rubric.

## Strategic target

Primary target:
ARC-AGI-2 code submission plus Paper Prize submission.

Secondary target:
Improve ARC-AGI-2 leaderboard score through iterative public-training and public-eval testing.

Aspirational target:
Reach 85% private evaluation accuracy. This remains a target condition, not a current claim.

## Current repo baseline

The current verified smoke benchmark is:

- dataset: first 20 public ARC-AGI-2 training tasks
- pass-at-two: 2/20
- pass-at-two accuracy: 0.10
- convergence cases: 2
- convergence accuracy: 1.0

This is not competitive. It is a working evidence loop.

## Solver architecture: ARC Cartographer

### 1. Perception layer

Parse each grid into:

- colors
- background
- connected components
- objects
- holes
- boundaries
- symmetry
- containment
- repetition
- scale
- spatial relations

### 2. Transformation hypothesis layer

Generate possible meanings:

- copy
- crop
- recolor
- fill
- mirror
- rotate
- extend
- count
- isolate
- remove noise
- complete pattern
- connect objects
- extract object
- sort objects
- align objects
- infer missing piece

### 3. Program synthesis layer

Represent hypotheses as executable transformation programs:

- find_objects
- select_largest
- select_unique_color
- mirror
- rotate
- crop_to_object
- recolor_by_mapping
- fill_enclosed
- extend_line
- translate_object
- overlay
- difference
- repeat_pattern

### 4. Dual-path solver

Path A: strict symbolic search.

Path B: heuristic field interpretation scoring.

If both converge on the same output, confidence increases.
If they diverge, submit the top two outputs.

### 5. Failure ledger

Classify each failed task as:

- object perception failure
- transformation failure
- color-rule failure
- counting failure
- shape-generation failure
- ambiguity failure
- overfitting failure
- contextual rule failure
- compositional reasoning failure

## Paper angle

Working title:

Field-Based Program Synthesis for ARC-AGI: A Dual-Path Object Grammar for Abstract Visual Reasoning

Core thesis:

Current ARC systems fail partly because they search transformations without first forming a stable field interpretation of the puzzle. ARC Cartographer separates perception, relational mapping, transformation generation, and convergence checking, then uses a failure taxonomy to drive systematic improvement.

## Next proof gates

1. Move smoke benchmark from 2/20 to 3/20.
2. Add full object extraction and relation detection.
3. Add failure-summary reports that identify largest missing primitive families.
4. Run full public training benchmark.
5. Build Kaggle notebook scaffold.
6. Draft Paper Prize outline using real repo results.

## Claim boundary

Allowed:
We are building a serious, reproducible ARC-AGI-2 solver and paper-track submission path.

Not allowed:
We can already win ARC or achieve 100% accuracy.
