# Consumer-to-Professional Translation Boundary

Status labels

- Source status: derived from current public research on ambient clinical documentation, patient-provider summarization, clinician review workflows, and existing MC care communication map architecture.
- Claim status: care-support architecture note, not medical advice, diagnosis, treatment guidance, or clinical validation.
- Privacy status: public-safe abstraction; no personal health, animal-care, household, or private case details.
- Missingness: no clinician review, user testing, regulatory review, medical device analysis, or implementation completed.
- Revision reason: created to keep the medical/social-care lane active while preserving strict safety boundaries.

## Core finding

The care lane is also a translation problem.

A person may describe lived observations in ordinary language.

A professional system may need structured, section-aware, standardized language.

The risky failure mode is pretending that translation equals diagnosis.

## External signal

Ambient clinical documentation and AI-assisted healthcare tools are increasingly focused on summaries, draft notes, clinician review, documentation burden, and patient-facing instructions.

Recent research on AI draft notes shows measurable shifts from consumer-oriented language toward clinician-standardized terminology during professional review.

This supports a bounded MC lane:

MC can help organize observations for conversation, but should keep clinical authority outside the system.

## Product boundary

`CareCommunicationMap` should not produce clinical conclusions.

It should produce an observation packet.

The packet can include:

- what was observed
- when it happened
- recurrence or change over time
- functional impact
- uncertainty
- source status
- questions for a professional
- what the packet cannot prove

## Translation rule

Every care-support translation must preserve three columns:

1. user-facing observation language
2. structured communication language
3. prohibited conclusion

Example pattern:

Observation:

`This keeps happening after a certain situation.`

Structured communication:

`User reports repeated temporal association with a specific context.`

Prohibited conclusion:

`This proves the context caused the issue.`

## Evaluation criteria

A care communication translation is successful only if it:

- makes the note clearer
- reduces rambling
- preserves uncertainty
- avoids diagnostic authority
- distinguishes observation from interpretation
- helps someone prepare for a professional conversation
- does not increase false confidence

## MC integration

Use the `InvariantTranslationRecord` for care-support language.

The invariant may be:

- recurrence
- change over time
- association without proof
- functional impact
- uncertainty
- escalation question

Domain translations must avoid words that imply diagnosis or treatment unless supplied by a qualified professional source.

## Next build target

Create one fictional care communication example with three columns:

- raw observation
- public-safe structured summary
- blocked conclusion

Do not use any real personal or animal-care details.
