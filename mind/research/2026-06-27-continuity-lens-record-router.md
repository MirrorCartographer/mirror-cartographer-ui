# Continuity Lens Record Router

Status labels

- Source status: derived from current GitHub mind state, public-safe architectural synthesis, and current public research scan on personal health records, AI provenance, ambient documentation, and patient-clinician summaries.
- Claim status: product architecture proposal and research hypothesis; not a medical, veterinary, legal, or clinical recommendation.
- Privacy status: public-safe abstraction; no personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript details.
- Missingness: no implemented access-control layer, no user testing, no clinical review, no veterinary review, no security audit, and no validated outcome evidence.
- Revision reason: created to connect ContextLensRouter, BeautyCompressionCard, EmergentProvenanceCard, CareCommunicationMap, and the private/professional/research split into one continuity architecture.

## Core finding

The strongest current attractor is Continuity.

MC is no longer only asking how one meaning changes across words.

It is asking how one record can remain continuous while becoming appropriate for different audiences.

The key object is not a diary, not an EHR, and not an AI medical assistant.

The key object is a routed meaning record.

## Continuity problem

A person or caregiver may hold rich private context, but professionals need concise, bounded, decision-useful information.

A researcher may need pattern-level data, but must not receive identity or private narrative.

A public artifact may need method-level explanation, but must not expose private content.

Therefore, MC needs a router that preserves relationship between layers while changing what is visible.

## Proposed object

`ContinuityLensRecordRouter`

It routes one underlying record into multiple views:

1. Private view
2. Professional handoff view
3. Care-team accessible view
4. Public-safe method view
5. Research-safe aggregate view

Each view has different permissions, vocabulary, claim strength, and evidence burden.

## Why this fits current research signals

Public health technology signals are moving toward:

- patient-managed personal health records
- AI-supported summaries over complex records
- clinician-reviewed ambient documentation
- data provenance and traceability frameworks
- concern about privacy, consent, liability, and information overload

This matches MC's existing source-boundary architecture: the important part is not only what a record says, but what it is allowed to become.

## Relationship to existing GitHub mind

### ContextLensRouter

Selects vocabulary, audience, and claim strength.

### BeautyCompressionCard

Makes the routed view understandable at a glance.

### EmergentProvenanceCard

Stores how the view was derived.

### Semantic Invariant Translation

Preserves underlying structure across words and domains.

### CareCommunicationMap

Provides the bounded care lane: observation-to-conversation support, not diagnosis or treatment.

## Routing rule

Never ask, `what is the true version?`

Ask:

`Which view is appropriate for this audience, purpose, risk level, and evidence state?`

## View definitions

### Private view

Purpose: self-understanding and continuity.

Allowed content:

- symbolic language
- private reflection
- uncertainty
- emotional and sensory meaning
- broad context
- unresolved interpretations

Not automatically shareable.

### Professional handoff view

Purpose: support a conversation with a qualified professional.

Allowed content:

- observations
- timing
- recurrence
- functional impact
- concrete questions
- known unknowns
- source labels

Not allowed:

- diagnosis by MC
- treatment recommendation by MC
- urgency ranking by MC
- metaphor presented as clinical fact

### Care-team accessible view

Purpose: coordinate authorized helpers around practical observation and follow-up.

Allowed content:

- task-relevant summaries
- checklists
- recent changes
- what has already been communicated
- what needs clarification

Requires explicit consent, revocation, and audit trail.

### Public-safe method view

Purpose: show the architecture without exposing private content.

Allowed content:

- schemas
- methods
- product requirements
- evaluation criteria
- source-boundary notes
- implementation plans

### Research-safe aggregate view

Purpose: pattern discovery without identity disclosure.

Allowed content:

- de-identified, aggregated structure
- frequency patterns
- communication bottlenecks
- missingness patterns
- evaluation metrics

Requires governance, consent, minimization, and re-identification risk review.

## Biological effect boundary

This system should not claim direct biological effect.

It may indirectly affect biological outcomes by improving:

- observation quality
- memory continuity
- communication precision
- follow-up consistency
- professional interpretation efficiency
- treatment adherence when directed by professionals
- earlier recognition of meaningful change

The causal chain is behavioral and organizational first, biological second.

## Research questions

1. Does a routed handoff reduce appointment rambling or omission?
2. Does it improve professional comprehension of longitudinal patterns?
3. Does it reduce caregiver cognitive load?
4. Does it preserve uncertainty better than ordinary notes?
5. Does it reduce unsafe overclaiming by separating observation, interpretation, and question?
6. Does the private view improve continuity without contaminating professional claims?
7. Does a research-safe aggregate view reveal communication failure patterns without exposing identity?

## Evaluation criteria

A successful router should be:

- permission-aware
- source-boundaried
- claim-bounded
- reversible enough to audit transformations
- readable by non-technical users
- useful to professionals
- protective of private context
- honest about missingness
- resistant to diagnosis drift

## References for current scan

- Personal health records and LLM-supported health queries: https://arxiv.org/abs/2605.18937
- AI model passport and traceability in health: https://arxiv.org/abs/2506.22358
- EHR/RPM information overload and generative AI: https://arxiv.org/abs/2509.00073
- Ambient clinical documentation legal and compliance risks: https://www.reuters.com/legal/litigation/health-care-ambient-scribes-offer-promise-create-new-legal-frontiers--pracin-2026-01-23/
- NHS single patient record reporting: https://www.theguardian.com/society/2026/may/10/gps-and-hospitals-in-england-to-be-required-to-share-data-to-create-single-patient-records
