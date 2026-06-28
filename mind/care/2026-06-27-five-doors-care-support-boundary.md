# Five Doors Care Support Boundary

Status labels

- Source status: derived from existing MC care architecture and current public health-AI research scan.
- Claim status: care-communication support concept; not medical, veterinary, therapeutic, legal, or emergency guidance.
- Privacy status: public-safe abstraction.
- Missingness: no clinician review, veterinary review, safety validation, consent UI, emergency escalation design, or regulated-device analysis.
- Revision reason: added as the persistent evidence-based care/social-support lane for the discovery pass.

## Core boundary

MC can support care communication by improving observation structure and handoff clarity.

MC must not claim authority to diagnose, treat, triage, or replace qualified professionals.

## Evidence-aligned direction

Public research and reporting currently support a bounded care lane:

- patient-generated data can be useful when summarized and made easier for professionals to inspect
- ambient AI documentation is expanding, but clinician review remains central
- clinical AI systems need stronger source provenance and evidence traceability
- privacy, consent, hallucination, and overreliance remain major risks

## Care translation model

The useful transformation is:

`private observation -> structured uncertainty-preserving summary -> professional question -> reviewable next step`

Not:

`private observation -> AI diagnosis`

## Five care doors

### 1. Private observation

Allowed:

- lived observations
- sensory description
- emotional context
- uncertainty
- symbolic language

Not allowed:

- automatic sharing
- assumed clinical meaning

### 2. Structured summary

Allowed:

- what was observed
- timing
- pattern
- functional impact
- relevant context
- what is unknown

Not allowed:

- invented certainty
- diagnostic conclusion

### 3. Professional handoff

Allowed:

- concise timeline
- questions for a professional
- medication/exposure/change fields when user-supplied and relevant
- request for review

Not allowed:

- telling the professional what the diagnosis is
- replacing professional assessment

### 4. Care-team accessible

Allowed:

- tasks
- watch items
- non-sensitive status updates
- permission boundaries

Not allowed:

- unrestricted private notes
- rare-context details not needed for support

### 5. Research-safe aggregate

Allowed:

- de-identified pattern class
- non-identifying schema lessons
- communication design findings

Not allowed:

- raw cases
- rare combinations that can re-identify a person or household

## Evaluation criteria

A care-support artifact is useful only if it:

1. preserves uncertainty
2. separates observation from interpretation
3. names missing evidence
4. makes professional review easier
5. reduces privacy exposure
6. avoids diagnosis/treatment authority
7. shows what changed between private and shared versions

## Next test

Create one fictional care-support card and ask whether the professional handoff version is clearer, shorter, safer, and less misleading than the raw private version.