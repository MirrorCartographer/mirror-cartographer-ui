# Dream Then Test Evaluation Protocol v0

Status labels

- Source status: derived from current MC GitHub mind, public research on human-AI co-creativity and creativity evaluation, and the Discovery Provenance Prism note.
- Claim status: proposed evaluation design, not completed empirical evidence.
- Privacy status: public-safe; uses only abstract task structures and fictional examples.
- Missingness: no participants, baseline runs, scoring calibration, or statistical analysis completed.
- Revision reason: created because the operating goals require comparing Dream Then Test against ordinary brainstorming and research-first synthesis.

## Purpose

Test whether MC's Dream Then Test workflow produces better bounded discovery than two common workflows.

The evaluation does not ask whether MC is magical or objectively superior.

It asks whether MC preserves useful transformations that ordinary workflows tend to hide.

## Compared workflows

### A. Ordinary AI brainstorming

Prompt asks for ideas directly.

Expected strength:

- fast generation
- high fluency
- many options

Expected weakness:

- generic convergence
- weak source boundaries
- little transformation trace

### B. Research-first synthesis

Prompt asks for current research first, then ideas.

Expected strength:

- stronger factual grounding
- better external alignment

Expected weakness:

- may overfit to existing categories
- may suppress strange early hypotheses
- may confuse citation density with discovery

### C. MC Dream Then Test with Provenance Prism

Prompt first dreams possible structures, then tests them against source boundaries, domain translations, contradictions, and public-safe constraints.

Expected strength:

- preserves imagination without presenting it as fact
- records transformation path
- separates originality from proof
- supports later auditing

Expected weakness:

- slower
- higher cognitive load
- needs disciplined labeling

## Test task template

Use one public-safe seed question.

Example:

`How could a human-AI system help people produce more original ideas without losing source boundaries or user ownership?`

Run the same seed through all three workflows.

## Required outputs from each workflow

Each workflow must produce:

- 5 candidate ideas
- strongest idea
- weakest assumption
- source boundary statement
- practical next step
- user-facing explanation

## Scoring dimensions

Score each workflow from 1 to 5 on each dimension.

### Novelty

Does the output avoid obvious generic repetition?

### Usefulness

Could someone build, test, sell, teach, or apply it?

### Boundary clarity

Does it clearly separate evidence, inference, imagination, and missingness?

### Transformation trace

Can the evaluator see how the idea changed?

### Ownership clarity

Does it preserve human contribution and AI contribution without pretending one erased the other?

### Contradiction handling

Does it preserve unresolved tensions rather than smoothing them away?

### Beauty as legibility

Does the form make the structure easier to understand, remember, and navigate?

## Minimum viable experiment

One evaluator can run a small version manually:

1. choose one seed question.
2. run all three workflows.
3. score each dimension.
4. identify the highest-value transformation lost by each method.
5. decide which output deserves implementation.

## Stronger experiment

Use 5 seed questions across domains:

- creative product concept
- public-safe care communication support
- education or AI literacy
- research synthesis
- interface design

Blind-rank outputs for:

- originality
- trust
- clarity
- buildability
- desire to continue

## Failure criteria

Dream Then Test fails if it produces:

- more words but no better decision
- symbolism without source boundaries
- novelty without usefulness
- safety labels that do not change behavior
- beautiful structure that hides weak reasoning

## Passing threshold

Dream Then Test passes the first gate if it beats both baselines on:

- boundary clarity
- transformation trace
- contradiction handling

and matches at least one baseline on:

- usefulness
- novelty

## Link to income lane

If the protocol shows an advantage, the result becomes the basis for a paid offer:

`AI Ideation Provenance Audit`

Deliverable:

- baseline comparison
- transformation map
- source-boundary ledger
- implementation recommendation

## Link to care/social-support lane

The same protocol can evaluate whether a care communication summary is clearer, safer, and more uncertainty-preserving than a normal narrative note.

No medical claims are evaluated.

Only communication quality is evaluated.

## Next action

Run the minimum viable experiment on one public-safe seed and preserve the result as a Field Log.
