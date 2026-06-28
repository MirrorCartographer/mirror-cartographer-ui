# Observation Handoff Evaluation Boundary

Status labels

- Source status: derived from public-safe MC care communication artifacts and current public research signals around patient-generated data, AI summarization, and clinician-reviewed communication support.
- Claim status: evaluation criteria and safety boundary, not medical advice, diagnosis, triage, or treatment guidance.
- Privacy status: public-safe abstraction using no real health, household, animal-care, or private-case details.
- Missingness: no clinician review, patient testing, regulatory review, accessibility testing, or integration with medical records.
- Revision reason: created to keep the care/social-support lane active while preserving strict boundaries.

## Core finding

The strongest care/social-support lane is an `ObservationHandoff`, not an intervention engine.

The product should help a person convert messy observations into structured communication without increasing diagnostic overreach.

## Allowed purpose

An ObservationHandoff may help organize:

- what was noticed
- when it occurred
- what changed functionally
- what context surrounded it
- what questions remain
- what uncertainty must be preserved
- what a professional should be asked

## Blocked purpose

An ObservationHandoff must not:

- diagnose
- recommend treatment
- rank urgency
- imply causation from correlation
- replace professional judgment
- convert symbolic language into clinical proof
- produce unsupported reassurance
- produce unsupported alarm

## Evaluation target

The handoff should be judged by communication quality, not medical correctness.

Useful metrics:

- clarity
- brevity
- uncertainty preservation
- chronological coherence
- separation of observation from interpretation
- professional readability
- privacy protection
- reduced overclaim

## Interface implication

The care lens should use a stricter router than other lenses.

Default claim limit:

`communication support only`.

Default blocked vocabulary:

- diagnosis
- treatment
- cure
- emergency ranking
- medical certainty
- professional replacement

Default required labels:

- source status
- claim status
- privacy status
- missingness
- revision reason

## Fictional test fixture requirement

All examples should use fictional, non-sensitive content.

Each fixture should include:

- raw messy notes
- structured observation handoff
- uncertainty list
- questions for a professional
- blocked claims list
- missing evidence list

## Current external signal

Healthcare AI activity continues to emphasize summarization, documentation support, patient-facing explanation, and clinician-reviewed workflows.

MC should align with that direction only at the communication-support layer.

## Next concrete action

Create one fictional test fixture and score it against the evaluation metrics above.
