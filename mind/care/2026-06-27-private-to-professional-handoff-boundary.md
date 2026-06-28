# Private-to-Professional Handoff Boundary

Status labels

- Source status: derived from existing MC care communication artifacts, public-safe File Library architecture, and current external research on patient-generated health data and personal health records.
- Claim status: care-communication product requirement, not medical advice, diagnosis, treatment, veterinary guidance, or legal compliance advice.
- Privacy status: public-safe abstraction; no personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript details.
- Missingness: no professional review, no clinical or veterinary pilot, no privacy/security audit, no integration with health records.
- Revision reason: created to define the care lane after identifying the dual-view architecture as the next safest product shape.

## Core boundary

The professional handoff view is not the private record.

It is a constrained derivative.

It should contain only what helps a qualified professional understand observations, chronology, functional change, uncertainty, and questions.

## Allowed content

- what was observed
- when it happened
- how often it happened
- what changed functionally
- relevant context selected by the user
- what has already been tried or noticed
- what remains uncertain
- questions for a qualified professional
- source status
- claim status
- privacy status
- missingness

## Blocked content

- diagnosis
- treatment recommendation
- medication instruction
- urgency ranking
- raw private transcript
- unsupported biological causation
- symbolic interpretation presented as medical fact
- identity or household details not needed for the handoff

## Biological pathway statement

The handoff may affect biological outcomes only indirectly by improving communication, recall, pattern visibility, adherence, escalation decisions by qualified professionals, and follow-up continuity.

It must not claim direct biological effect.

## Animal-care adaptation

For dependent beings and animals, the handoff should emphasize:

- observed behavior
- appetite
- movement
- sleep/rest
- visible changes
- medication timing if user-entered
- environmental changes
- photos or videos if available
- uncertainty and questions

It should not infer diagnosis or suggest treatment.

## Professional-view design requirement

The user should see a before/after contrast before sharing:

- private meaning retained privately
- professional observations included
- sensitive details excluded
- uncertain claims softened
- unsupported claims removed
- questions preserved

## Evaluation test

Give the same fictional private entry to three reviewers:

1. a general reader
2. a professional-domain reviewer
3. a privacy reviewer

The handoff passes only if:

- the professional-domain reviewer can understand the issue enough to ask better follow-up questions
- the privacy reviewer confirms unnecessary private context was removed
- the general reader does not interpret the output as a diagnosis or treatment plan
