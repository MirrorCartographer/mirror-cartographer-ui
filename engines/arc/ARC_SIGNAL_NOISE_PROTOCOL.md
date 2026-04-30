# ARC Signal / Noise Protocol

## Voice-readable summary

The goal is not to add more rules. The goal is to learn which patterns survive contact with new tasks.

Signal is structure that keeps working after the surface changes.

Noise is coincidence that looks meaningful only because we already know the answer.

## Core distinction

Signal answers:

- What relationship explains the transformation?
- Does the rule survive color changes?
- Does the rule survive size changes?
- Does the rule survive object position changes?
- Does the rule appear across more than one task family?
- Can it be expressed as reusable selector, operator, or placer logic?

Noise answers:

- Did this exact color appear?
- Did this exact coordinate appear?
- Did this exact grid size appear?
- Did this exact public task ID appear?
- Did the rule only work after seeing the expected output?
- Does it break when the object moves or changes color?

## Signal markers

A candidate rule is more likely signal when:

1. It is exact on all training examples.
2. It explains the input-output delta simply.
3. It can be described without task ID or memorized coordinates.
4. It uses relations rather than fixed positions.
5. It uses object identity rather than raw pixels when objects matter.
6. It produces a valid output shape for the test input.
7. It does not disturb already solved tasks.
8. It can be tested on synthetic variations.
9. It belongs to a known ARC family, such as fill, crop, copy, move, recolor, count, extend, complete, or compose.
10. It lowers ambiguity instead of increasing it.

## Noise markers

A candidate rule is more likely noise when:

1. It depends on one public task ID.
2. It depends on exact row or column numbers without relation evidence.
3. It depends on a specific color when color is not the rule.
4. It works only on one grid size.
5. It requires many exceptions.
6. It solves a benchmark task but cannot be described as a reusable primitive.
7. It has no independent unit test.
8. It overrides a stronger rule that was exact on training examples.
9. It increases solved-task regression risk.
10. It produces the right answer for the wrong reason.

## The separation test

Before adding a generator, ask five questions:

1. What is the smallest relation that explains the examples?
2. What would change if colors were renamed?
3. What would change if the object moved?
4. What would change if the grid were larger?
5. What independent synthetic test can prove the primitive without using the public answer?

If the generator cannot answer these, it is probably noise.

## Signal strength scale

### Level 0: Guess

The rule feels plausible but does not pass all training examples.

Action: do not submit as high confidence.

### Level 1: Training fit

The rule passes the visible training examples.

Action: candidate allowed, but low confidence if many rules also fit.

### Level 2: Independent primitive proof

The rule has separate unit tests that do not use the public task directly.

Action: candidate becomes safer.

### Level 3: Smoke survival

The rule improves or preserves the first-20 public smoke benchmark.

Action: log artifact and compare failures.

### Level 4: Broader public survival

The rule improves a larger public set or does not overfit across pseudo-held-out tasks.

Action: paper-track evidence.

### Level 5: Generalization signal

The rule works as a reusable DSL primitive across unrelated task families.

Action: keep and compose.

## Practical examples

### Enclosed-region fill

Signal:
Background cells enclosed by foreground boundary become a learned fill color.

Why signal:
It is relational. It does not depend on exact coordinates. It can be tested on different shapes and grid sizes.

Noise version:
Change cell at row 2 column 3 to color 4.

### Marker-shape keyed recolor

Signal:
A small marker shape selects the recolor target for a larger object.

Why signal:
The marker is a relational key. The rule can survive object movement and large-object shape variation if implemented correctly.

Noise version:
If color 1 appears near bottom, turn all 8s into 7s.

### Learned translation

Signal:
A component moves by a consistent vector learned from examples.

Why signal:
The component identity survives movement. The vector is inferred from input-output deltas.

Noise version:
Move pixels from columns 1-2 to columns 3-4 only for this grid size.

## Two-attempt signal policy

Attempt one should prefer courtroom signal:

- exact training fit
- simplest rule
- low ambiguity
- clear proof

Attempt two should prefer alternate plausible signal:

- different hypothesis family
- still exact or near-exact on training
- not random variation

If both attempts converge independently, confidence rises.

If they diverge, the system should log why:

- different selected object
- different operation
- different placement
- different color rule
- different output shape

## Overfit audit questions

After a score improvement, ask:

1. Did the new rule solve only one task because it encoded that task?
2. Did it improve a held-out synthetic variation?
3. Did it harm any previously solved task?
4. Does it belong in the DSL as a reusable primitive?
5. Should it be demoted behind a more general rule?

## Paper-track relevance

The paper should not only report accuracy. It should report how the system separates signal from noise.

Useful paper evidence:

- failure clusters
- rule families added over time
- overfit audits
- candidate rejection examples
- divergence cases between attempt one and attempt two
- examples where a tempting rule was rejected as noise

## Core phrase

Signal survives transformation. Noise depends on the surface staying the same.
