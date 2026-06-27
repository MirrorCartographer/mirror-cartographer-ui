# Workshop Spec — SymbolicFlowLedger

Date: 2026-06-27

Status labels

- Source status: product specification synthesized from public research anchors and MC architecture memory at abstract-method level.
- Claim status: implementation plan and evaluation scaffold.
- Privacy status: public-safe abstraction; designed specifically to avoid storing raw private source material.
- Missingness: not implemented in application state, database, UI, tests, or GitHub CI.
- Revision reason: adds intermediate-flow accountability to prior provenance, evidence, resonance, release, and transition objects.

## Purpose

`SymbolicFlowLedger` records public-safe metadata about how a reflective state moved through MC without preserving raw sensitive content.

## Required object

Fields:

- `ledger_id`: stable generated id.
- `artifact_id`: target artifact or state id.
- `created_at`: timestamp.
- `source_status`: direct user input, saved context, file-derived, GitHub-derived, web-derived, synthesized, inferred, unknown.
- `claim_status`: metaphor, observation, design hypothesis, product requirement, research question, implementation plan, evaluation criterion, evidence claim, unknown.
- `privacy_status`: private-only, internal-method, public-safe abstraction, publishable, blocked.
- `missingness`: known gaps, unavailable sources, stale sources, unverified assumptions.
- `revision_reason`: why this ledger entry exists or changed.
- `flow_steps`: ordered transition records.
- `blocked_payload_classes`: detail classes that must not travel outward.
- `allowed_payload_classes`: detail classes allowed after abstraction.
- `evidence_boundary_id`: linked EvidenceBoundary object.
- `transition_gate_id`: linked TransitionGate object.
- `context_release_profile_id`: linked ContextReleaseProfile object.
- `public_safe_index_id`: linked PublicSafeAbstractionIndex object when release is allowed.
- `downstream_limits`: allowed and forbidden uses.
- `evaluation_hooks`: tests required before reuse.

## Flow step record

Each `flow_steps` item should include:

- `step_id`
- `from_layer`: private source, saved memory, file, GitHub, web, symbolic state, research note, bridge synthesis, product spec, public artifact.
- `to_layer`: same controlled list.
- `transformation`: quote, summarize, abstract, classify, synthesize, evaluate, publish, act.
- `allowed`: true or false.
- `reason`: short public-safe explanation.
- `sensitive_domain_flag`: none, personal, household, health, animal-care, financial, location, relationship, credential, raw-transcript, other-sensitive.
- `claim_risk`: none, inflation, unsupported factuality, diagnosis, legal, financial, identity, attribution, causation.
- `mitigation`: redact, abstract, aggregate, cite, downgrade claim, block, ask later, keep private.

## Hard rules

1. The ledger records transformations, not raw private content.
2. A safe final output does not prove the flow was safe.
3. A meaningful symbolic state does not prove factual truth.
4. A source can support architecture understanding without being publishable.
5. Blocked details should be named only as broad classes, not exposed.
6. Public release requires explicit `privacy_status: public-safe abstraction` or `publishable`.

## Evaluation criteria

Test each ledgered artifact for:

- privacy leakage across intermediate steps.
- claim inflation between symbolic and factual layers.
- correct source-boundary labeling.
- correct missingness labeling.
- correct blocked-detail classes.
- downstream-use clarity.
- ability to reconstruct method without reconstructing private source.

## First implementation plan

1. Add TypeScript type `SymbolicFlowLedger`.
2. Require it for GitHub mind-writing workflows.
3. Add UI display for source, claim, privacy, and missingness labels.
4. Add a privacy-flow test fixture with intentionally sensitive source classes.
5. Verify that public artifacts preserve method while blocking raw source reconstruction.
