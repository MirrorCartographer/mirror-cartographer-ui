# Dual-View Consent Architecture

Status labels

- Source status: derived from public-safe File Library materials, existing GitHub mind artifacts, current public research on patient-generated health data, AI-assisted health summaries, and AI collaboration disclosure.
- Claim status: architecture proposal and product requirement, not implemented software, clinical validation, diagnosis, treatment, or veterinary guidance.
- Privacy status: public-safe abstraction; excludes personal, household, health, animal-care, financial, location, relationship, credential, and raw transcript details.
- Missingness: no data model implementation, consent UI, access-control layer, clinical workflow pilot, veterinary workflow pilot, security audit, or usability evaluation completed.
- Revision reason: created because the active architecture question shifted from `one private system and one public system` to `one underlying state object with multiple consent-bound views`.

## Core finding

Mirror Cartographer should support a dual-view architecture:

1. A private meaning view.
2. A professional handoff view.

The system should not duplicate the person into separate records.

It should preserve one underlying state object, then route different views through consent, audience, evidence, and risk boundaries.

## Existing mind comparison

The `ContextLensRouter` chooses vocabulary by audience, risk, evidence level, privacy sensitivity, and allowed claim strength.

The `CareCommunicationMap` organizes observation, timing, recurrence, uncertainty, functional impact, and questions without diagnosis or treatment authority.

This artifact combines those two patterns into a view architecture:

- private layer: lived meaning, symbols, metaphors, nonlinear reflection, personal context
- translation layer: observation extraction, uncertainty preservation, source separation, claim narrowing
- professional layer: concise evidence-bounded handoff packet
- research layer: anonymized aggregate questions only, never raw identity or narrative

## Why this matters

The strongest care-adjacent MC lane is not medical prediction.

It is reducing loss during translation:

`private lived experience -> structured observation -> professional conversation -> follow-up record`

Health and social-care systems often need concise structured information, while people often experience events as messy, symbolic, emotional, fragmented, embodied, or intermittent.

MC's contribution is to preserve meaning privately while exporting only what is appropriate for a professional task.

## External research signal

Current health-AI and personal-health-record research is moving toward patient-managed records, wearable and record integration, patient-generated health data summaries, and AI-assisted clinical documentation.

The opportunity is real, but the risk boundary is also real:

- patient-generated data can help clinicians sensemake across heterogeneous, high-volume inputs
- AI summaries can anchor professional review and bridge data-literacy gaps
- personal health record systems may help users ask better questions
- consumer health apps can weaken privacy protection when medical records leave traditional covered systems
- clinicians and researchers continue to flag transparency, privacy, and overreliance risks

MC should position itself on the safer side of that boundary: communication support, consent routing, and source-bounded handoff.

## Biological effect boundary

This architecture should not claim direct biological effect.

It does not heal tissue, regulate pressure, cure disease, reverse degeneration, or replace professional care.

The plausible biological pathway is indirect:

1. Better observation capture.
2. Less memory loss across time.
3. Clearer professional communication.
4. More appropriate testing, monitoring, support, or intervention decisions.
5. Better adherence and follow-up continuity.
6. Potential downstream impact on outcomes through improved decision loops.

The mechanism is not mystical or cellular.

The mechanism is changed information flow across a care system.

## Beings beyond humans

The same architecture can apply to animals and other dependent beings only as an observation-support system.

Allowed:

- timeline of observed behavior
- appetite, movement, sleep, medication timing, visible changes, environment, photos, uncertainty
- questions for a qualified professional
- separation of observation from interpretation

Not allowed:

- diagnosis
- treatment recommendation
- urgency ranking
- replacing veterinary care
- converting symbolic interpretation into biological causation

## Product requirement

Every sensitive MC record should be able to produce at least two exports:

### Private view

Purpose:

- self-understanding
- continuity
- symbolic and emotional processing
- nonlinear reflection

Contains:

- personal metaphors
- context
- uncertainty
- subjective meaning
- private source labels
- non-public notes

### Professional handoff view

Purpose:

- appointment preparation
- support call preparation
- team communication
- follow-up continuity

Contains:

- observations
- timing
- recurrence
- functional impact
- what changed
- what was tried
- current uncertainty
- questions
- source status
- claim status
- privacy status
- missingness

Excludes:

- raw transcript
- private symbolic material unless explicitly selected
- identity details not needed for the handoff
- unsupported causal claims
- diagnosis/treatment assertions

## Required access rules

A view should never be created merely because data exists.

It should require:

- chosen audience
- chosen purpose
- chosen time range
- chosen detail level
- chosen exclusions
- generated summary preview
- explicit consent before sharing
- revocation path when technically possible

## Evaluation criteria

A successful dual-view export is:

- shorter than the private record
- professionally legible
- uncertainty-preserving
- non-diagnostic
- source-labeled
- claim-bounded
- privacy-minimizing
- useful for a real conversation
- reversible enough for the user to inspect what was removed or transformed

## Next research questions

- What minimum fields make a handoff useful without becoming clinical advice?
- Which visual disclosure format best shows how private material was transformed into professional material?
- How should MC represent `not shared` without implying deletion from the private record?
- How should animal-care observation packets differ from human-care packets?
- What evaluation rubric can measure whether professional users find the handoff usable?
