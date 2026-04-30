# Next Solver Expansion Plan

## Voice-readable summary

The first real ARC smoke benchmark scored 0 out of 20. The benchmark system worked, but the solver is too shallow. The next build should not add random tricks. It should add missing capability families and then rerun the same 20-task smoke benchmark.

## Current baseline

- Dataset: first 20 public ARC-AGI-2 training tasks
- Pass-at-two score: 0/20
- Convergence cases: 3
- Convergence correct: 0

## Goal for next solver branch

Move from baseline 0/20 to at least one correct task on the same 20-task smoke set.

This is not the final goal. It is the next proof threshold.

## Expansion families

### 1. Object segmentation
Add connected components by color and non-background regions.

Required outputs:
- object list
- object bounding boxes
- object areas
- object colors
- object masks

### 2. Output shape inference
Generate candidates where output is:
- same shape as input
- crop of all non-background cells
- crop of largest object
- crop of unique-color object
- bounding-box render of selected object
- compressed object mask

### 3. Object rendering
Generate candidates by:
- copying selected object
- recoloring selected object
- moving selected object
- deleting selected object
- overlaying selected object into a new blank grid

### 4. Region and fill logic
Generate candidates by:
- filling holes
- filling enclosed background regions
- extending lines
- closing rectangles
- completing frames

### 5. Relation logic
Detect:
- inside/outside
- touching
- aligned row or column
- nearest/farthest
- same shape different color
- same color different shape

### 6. Failure summary tooling
Benchmark reports should summarize failure labels so the next build chooses the largest failure family first.

## Required proof after implementation

1. CI passes.
2. ARC Training Smoke Benchmark reruns.
3. Score is recorded under `reports/arc`.
4. If score remains 0/20, failure report must explain what new families were tried and why they failed.

## Claim boundary

A solver improvement claim is only allowed if the same smoke benchmark improves or the failure labels become materially more informative.
