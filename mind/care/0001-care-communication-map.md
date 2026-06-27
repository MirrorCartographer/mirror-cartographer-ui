# Care Communication Map 0001

Status labels

- Source status: derived from current external scan and MC source-boundary architecture.
- Claim status: product requirement for communication support, not medical advice, diagnosis, or treatment guidance.
- Privacy status: public-safe abstraction; no personal health details or private cases.
- Missingness: not clinically validated; no implementation, user testing, or clinician review completed.
- Revision reason: created to maintain a responsible medical/social-care lane while preserving strict boundaries.

## Core finding

The responsible care lane for MC is not diagnosis.

The viable lane is structured communication support.

## Product concept

`CareCommunicationMap` helps turn messy observations into a bounded summary that can support a conversation with a qualified care professional or support organization.

It should organize:

- observation type
- timing and recurrence
- functional impact
- uncertainty
- questions to ask
- what is not known
- what should not be concluded
- source and privacy status

## Safety boundary

The map must not:

- diagnose
- recommend treatment
- rank medical urgency
- replace professional care
- convert metaphor into causation
- treat recurrence as proof
- make claims beyond the user's observations

## Allowed use

The map may help a person:

- prepare notes
- clarify questions
- preserve uncertainty
- communicate patterns
- separate observation from interpretation
- reduce rambling or omission during appointments or support calls

## Research signal

Current healthcare AI movement includes patient-facing explanations, clinician-reviewed summaries, ambient documentation, and care-communication support.

The consistent boundary is that safe systems support comprehension, organization, and communication while preserving clinical authority outside the tool.

## First build requirement

Create a one-page template with these sections:

1. What I observed
2. When it happened
3. What changed functionally
4. What I have tried or noticed
5. What I am unsure about
6. Questions for a professional
7. What this summary cannot prove
8. Privacy/source label

## Evaluation criteria

A successful map is:

- shorter than the raw notes
- clearer than the raw notes
- uncertainty-preserving
- non-diagnostic
- useful for a real conversation
- privacy-aware

## Next concrete action

Create `CareCommunicationMap` as a reusable schema and example using fictional, non-sensitive content.
