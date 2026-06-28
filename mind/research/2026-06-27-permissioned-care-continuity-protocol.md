# Permissioned Care Continuity Protocol

Status labels

- Source status: derived from public-safe File Library materials, existing GitHub mind artifacts, current public research on personal health records, dynamic consent, AI provenance, and human-AI emergent cognition.
- Claim status: architecture proposal and research plan; not implemented software, clinical validation, diagnosis, treatment, veterinary guidance, or emergency triage.
- Privacy status: public-safe abstraction; excludes personal, household, health, animal-care, financial, location, relationship, credential, and raw transcript details.
- Missingness: no access-control implementation, clinical pilot, veterinary pilot, legal review, security audit, usability test, or professional validation completed.
- Revision reason: created because the current architecture question shifted from `dual view` to `permissioned continuity across multiple beings, audiences, and care contexts`.

## Core finding

Mirror Cartographer should not frame sensitive continuity as only `private` versus `shared`.

The stronger architecture is:

`one underlying continuity record -> multiple permissioned views -> explicit transformation trace`

Each view must be produced by purpose, audience, consent, risk, evidence level, and minimum necessary disclosure.

## Existing mind comparison

This builds directly on:

- Dual-View Consent Architecture: one state object with private and professional views.
- ContextLensRouter: route language by audience, risk, evidence level, privacy sensitivity, and allowed claim strength.
- CareCommunicationMap: observation-to-conversation support without diagnosis or treatment authority.
- BeautyCompressionCard: make boundaries visible instead of hiding them in legalistic text.

The new contribution is not another view.

It is a rule for how views are generated and audited.

## Permissioned view stack

### 1. Private meaning view

Purpose:

- preserve subjective meaning
- keep nonlinear context
- support continuity over time
- allow symbolic, emotional, sensory, and reflective material

Allowed material:

- private notes
- metaphors
- uncertainty
- meaning associations
- contextual fragments
- user-selected media or artifacts

Default sharing state: not shared.

### 2. Self-review view

Purpose:

- help the person inspect what changed
- separate observation from interpretation
- prepare a safer export

Allowed material:

- timeline
- observation list
- hypothesis list
- uncertainty list
- source labels
- excluded fields
- transformation notes

Default sharing state: private until approved.

### 3. Professional handoff view

Purpose:

- support a real conversation with a qualified professional or care team

Allowed material:

- observations
- timing
- recurrence
- functional impact
- what changed
- what was tried
- current questions
- missing information
- confidence and uncertainty boundaries

Excluded by default:

- raw transcript
- private symbolic material
- unsupported causal claims
- irrelevant identity details
- diagnosis or treatment assertions

### 4. Team-accessible continuity view

Purpose:

- allow multiple approved helpers to stay oriented without reading the entire private record

Allowed material:

- agreed goals
- known constraints
- current status
- open questions
- responsibilities
- update history
- permission scope

Required rule:

Every team member must have a declared reason for access.

### 5. Public-safe method view

Purpose:

- publish methods, schemas, product requirements, research questions, and evaluation criteria without exposing private life

Allowed material:

- abstracted architecture
- claim boundaries
- source-boundary notes
- evaluation rubrics
- implementation plans
- failure modes

### 6. Research-safe aggregate view

Purpose:

- study patterns without exposing individual identity or raw narrative

Allowed material:

- aggregated counts
- de-identified pattern categories
- method-level results
- rubric scores
- usability findings

Hard boundary:

No raw private record should enter this view.

## Biological effect boundary

This protocol should not claim direct biological effect.

It does not heal tissue, reverse disease, lower pressure, cure illness, or replace care.

The plausible biological pathway is indirect:

1. More complete observation capture.
2. Less memory loss across time.
3. Better separation of observation from interpretation.
4. Clearer communication with qualified professionals.
5. More appropriate monitoring, testing, support, or follow-up decisions.
6. Better continuity and adherence.
7. Possible downstream outcome changes through changed decision loops.

The mechanism is information flow, not direct cellular action.

## Animal and dependent-being boundary

The same architecture can support animals, children, elders, disabled people, or any dependent being only as observation and care-continuity support.

Allowed:

- observed behavior
- environment
- appetite or intake records where relevant
- movement and sleep observations
- medication timing if already prescribed
- visible changes
- photos selected by the caregiver
- uncertainty labels
- questions for a qualified professional

Not allowed:

- diagnosis
- treatment recommendation
- urgency ranking
- replacing qualified care
- converting symbolic interpretation into biological causation

## Required transformation trace

Every exported view should include:

- source status
- claim status
- privacy status
- missingness
- intended audience
- intended purpose
- included fields
- excluded fields
- revision reason
- consent timestamp or equivalent approval record
- revocation or expiration rule when technically possible

## Product requirement

MC should generate a `ViewDiff` whenever a professional, team, public, or research-safe view is created.

The ViewDiff should answer:

- What was included?
- What was excluded?
- What was compressed?
- What was translated?
- What was downgraded from interpretation to question?
- What was removed for privacy?
- What remains missing?

## Evaluation criteria

A successful permissioned handoff is:

- shorter than the private record
- professionally legible
- non-diagnostic
- uncertainty-preserving
- source-labeled
- claim-bounded
- privacy-minimizing
- usable in a real conversation
- inspectable by the person who created it
- reversible enough to show what changed during translation

## Next research questions

- What minimum fields make a care-team view useful without over-sharing?
- How should MC visually represent `not shared` versus `deleted`?
- Which transformations require explicit confirmation every time?
- How should dependent-being observation packets differ from self-authored records?
- Can a ViewDiff reduce over-trust by showing the gap between private meaning and professional evidence?
