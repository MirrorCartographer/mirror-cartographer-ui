# CareCommunicationMap Schema v0

Status labels

- Source status: derived from public healthcare AI communication trends, ambient documentation reporting, patient-generated data concepts, and MC's existing CareCommunicationMap product requirement.
- Claim status: schema proposal for communication support only; not medical advice, diagnosis, triage, or treatment guidance.
- Privacy status: public-safe; contains no personal cases, health details, animal-care details, household details, or raw transcripts.
- Missingness: not clinically validated, not reviewed by clinicians, not implemented, and not tested with users.
- Revision reason: created to turn the care/social-support lane into a reusable structure without crossing clinical-authority boundaries.

## Purpose

Turn messy observations into a structured, uncertainty-preserving conversation aid.

The schema supports preparation, not medical decision-making.

## Required safety boundary

The output must never claim:

- a diagnosis
- a treatment recommendation
- a level of urgency
- a cause
- a prognosis
- a professional conclusion

The output may only organize what was observed and what questions should be brought to an appropriate professional or support organization.

## Schema

### 1. Observation summary

Plain-language description of what was noticed.

Rules:

- keep it concrete
- avoid causal claims
- avoid diagnostic labels unless provided by a qualified source and marked as such

### 2. Timeline

When observations occurred.

Fields:

- first noticed
- recent recurrence
- duration
- pattern uncertainty

### 3. Functional impact

What changed in ordinary functioning or communication.

Fields:

- task affected
- degree of disruption
- frequency
- recovery or return to baseline, if known

### 4. Context notes

Non-causal context around the observation.

Fields:

- environment
- activity
- stressors or supports
- relevant changes

Rules:

Context is not cause.

### 5. Uncertainty ledger

What is not known.

Fields:

- missing observations
- unclear timing
- competing explanations
- what would need professional assessment

### 6. Questions for professional or support contact

Question list.

Rules:

- ask for evaluation, not confirmation of a preferred theory
- separate safety concerns from curiosity
- preserve uncertainty

### 7. Source boundary

Where each statement came from.

Allowed labels:

- direct observation
- user memory
- external document
- professional statement
- AI-generated organization
- inference
- unknown

### 8. Privacy boundary

Release status.

Allowed labels:

- private-only
- shareable with care professional
- shareable with support organization
- public-safe fictional example
- public-safe abstract method

### 9. Non-claim statement

Required footer:

`This map organizes observations and questions. It does not diagnose, treat, triage, or replace professional judgment.`

## Fictional example shell

Observation summary:

`A person noticed a recurring difficulty completing a routine task after long periods of activity.`

Timeline:

`Noticed several times over two weeks. Exact start unknown.`

Functional impact:

`The task took longer and required more conscious effort.`

Context notes:

`Often occurred after busy days. Cause unknown.`

Uncertainty ledger:

`It is unclear whether the pattern is consistent, temporary, environmental, or unrelated.`

Questions:

`What information would be useful to track before discussing this with a professional?`

Source boundary:

`Direct observation plus AI-generated organization.`

Privacy boundary:

`Public-safe fictional example.`

Footer:

`This map organizes observations and questions. It does not diagnose, treat, triage, or replace professional judgment.`

## Evaluation criteria

A good CareCommunicationMap is:

- shorter than the raw notes
- clearer than the raw notes
- uncertainty-preserving
- non-diagnostic
- source-labeled
- practical for a conversation
- easy to revise after professional feedback

## Link to current external signal

The relevant healthcare AI pattern is not autonomous medical authority.

The relevant pattern is reviewed summarization, documentation support, patient-facing explanation, and communication preparation.

MC should remain on the preparation and boundary-labeling side of that line.
