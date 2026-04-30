# Real ARC Benchmark Protocol

This protocol controls score claims.

## Voice-readable summary

A score claim is only valid if it comes from a stored benchmark result file or uploaded workflow artifact. The result must say which dataset was used, how many tasks ran, which solver commit ran, and what the exact pass-at-two score was.

## Default run order

1. Run a small training subset, usually 20 tasks.
2. Fix crashes only.
3. Run full training.
4. Review failures and add taxonomy labels.
5. Improve solver based on training failures.
6. Run public evaluation sparingly as a checkpoint.

## Do not overuse public evaluation

Public evaluation is not the training loop. Repeatedly tuning to public evaluation leaks information into the algorithm.

## Required result fields

- dataset split
- task count
- items total
- attempt one correct
- attempt two correct
- pass-at-two correct
- pass-at-two accuracy
- convergence count
- convergence correctness
- failure count
- failure list
- solver commit or workflow commit
- timestamp
- claim scope

## Allowed claim template

On commit X, solver Y scored Z pass-at-two accuracy on dataset split S, using command C, with result file R. This does not prove private ARC performance.

## Forbidden claim template

We can win ARC.

That claim is forbidden until supported by benchmark and Kaggle evidence.
