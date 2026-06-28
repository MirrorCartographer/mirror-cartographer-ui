# One Record, Five Doors Discovery Demo

Status labels

- Source status: derived from existing GitHub mind artifacts plus current public research scan.
- Claim status: product/research synthesis; not validated software, medical advice, veterinary advice, legal guidance, or privacy compliance certification.
- Privacy status: public-safe abstraction only; no private transcript, household, health, animal-care, financial, location, relationship, credential, or identity-specific details included.
- Missingness: no implemented permissions engine, encryption model, revocation workflow, clinician review workflow, user testing, or formal privacy threat model yet.
- Revision reason: the prior continuity pass identified `One Record, Five Doors` as the next demo object; this pass converts it into a discovery-facing research note.

## Strongest attractor

Discovery.

The repository has enough pieces to stop only describing Mirror Cartographer and begin demonstrating one central behavior:

`one underlying record -> multiple permissioned views -> explicit transformation trace`

## Core finding

The next public-safe MC proof should be a fictional, non-clinical demo showing how the same invariant structure changes across five views without pretending the views are interchangeable.

The five doors are:

1. Private view
2. Professional handoff view
3. Care-team accessible view
4. Public-safe method view
5. Research-safe aggregate view

The discovery is not the content of the record.

The discovery is the trace of how meaning changes, narrows, survives, or becomes unsafe across contexts.

## Relationship to existing GitHub mind

This demo compresses and tests multiple existing organs:

- ContinuityLensRecordRouter: one record, multiple permissioned views.
- ContextLensRouter: audience-aware language and claim routing.
- BeautyCompressionCard: visible truth-boundary compression.
- EmergentProvenanceCard: compact source/claim/privacy/missingness state.
- CareCommunicationMap: observation-to-conversation support without diagnosis or treatment authority.
- Artifact Lifecycle Ecology: demo moves artifacts from seed toward tested.

## Public research alignment

Current public signals support this direction:

- Clinical AI work is identifying a provenance gap where models can generate plausible clinical reasoning but fail source-verifiable citation and traceability requirements.
- Ambient documentation systems are being adopted in clinical settings but still require human review, consent governance, and safeguards around errors.
- Patient-generated health data research suggests summaries and conversational exploration can help professional sensemaking, but transparency, privacy, and overreliance remain unresolved issues.
- AI literacy and workforce training demand is rising; organizations need concrete demonstrations of how to inspect, bound, and govern AI output.
- Transparency research increasingly argues that disclosure cannot be only a label; it must be architectural.

## Public-safe design implication

MC should not position this as a medical assistant.

Better framing:

`a provenance-native translation interface for moving meaning between private reflection, professional communication, public-safe explanation, and research-safe abstraction.`

## Research question

Can a user understand what changed between views faster and more accurately when the transformation trace is visible on the artifact itself?

## Evaluation criteria

A successful demo should let a reader answer:

1. What is the invariant structure?
2. Which view am I seeing?
3. What source boundary applies?
4. What claim boundary applies?
5. What privacy boundary applies?
6. What was removed?
7. What was preserved?
8. What is missing or unverified?
9. What action is allowed next?

## Non-goals

- No diagnosis.
- No treatment recommendation.
- No triage or urgency authority.
- No real private data.
- No implied professional endorsement.
- No claim that symbolic material is clinically validated.

## Next build target

Create a fictional `OneRecordFiveDoorsDemo` with five rendered cards and one side-by-side transformation ledger.