# Blocked-to-Public-Safe Contrast Index

Status labels

- Source status: derived from user instruction and prior blocked GitHub write behavior.
- Claim status: governance/index rule, not a completed archive of blocked material.
- Privacy status: public-safe abstraction. Contains no blocked original wording, no private details, and no raw transcript material.
- Missingness: no private vault exists here; no previous blocked originals have been recovered or copied into this index.
- Revision reason: created because blocked or inappropriate wording should become structured contrast, not silent deletion or forced publication.

## Rule

Blocked material is not automatically worthless.

It may contain a useful:

- method
- tension
- product requirement
- boundary condition
- evaluation question
- implementation clue
- research direction

But blocked material must not be forced into public GitHub.

## Storage model

### Location A — private original record

Purpose:

- preserve original intent only when safe and available.
- keep exact wording out of public repository when it contains sensitive, inappropriate, or unsafe material.
- label the record as private-only, blocked, unverified, or inappropriate.

Public GitHub must not contain this content.

### Location B — public-safe contrast record

Purpose:

- publish only what can safely survive abstraction.
- explain the boundary.
- preserve the useful architecture.

Public GitHub may contain this record.

## Contrast fields

Each contrast record should include:

1. blocked_event_id
2. artifact_attempted
3. public_safe_artifact_created
4. trigger_class
5. transformation_class
6. claim_narrowing
7. content_removed_summary
8. architecture_preserved
9. risk_avoided
10. next_safe_action

## Trigger classes

Allowed values:

- privacy_risk
- medical_or_care_overreach
- financial_or_account_risk
- identity_or_credential_exposure
- raw_transcript_exposure
- unsafe_claim_strength
- public_context_mismatch
- unclear_consent_boundary
- tool_policy_block
- unknown

## Transformation classes

Allowed values:

- direct_publication_blocked
- sensitive_detail_removed
- claim_weakened
- domain_reframed
- method_extracted
- product_requirement_extracted
- research_question_extracted
- evaluation_criterion_extracted
- implementation_plan_extracted

## Current known contrast event

blocked_event_id: contrast-0001

artifact_attempted: income wedge map with care-adjacent language

public_safe_artifact_created: mind/income/0001-paid-wedges.md and mind/care/0001-care-communication-map.md

trigger_class: medical_or_care_overreach / public_context_mismatch

transformation_class:

- domain_reframed
- method_extracted
- product_requirement_extracted
- claim_weakened

claim_narrowing:

Care-adjacent language was separated from income positioning and reframed as communication support with explicit no-diagnosis/no-treatment boundaries.

content_removed_summary:

Removed or narrowed wording that could blur care support, wellness, diagnosis, or monetization boundaries.

architecture_preserved:

The useful core survived: MC can structure observations, uncertainty, questions, and source labels without claiming clinical authority.

risk_avoided:

Avoided publishing a document that mixed income strategy with sensitive care-domain implications.

next_safe_action:

Develop fictional examples and evaluation rubrics before using real cases.

## Design principle discovered

A block can be a signal that an artifact is trying to hold two incompatible release classes at once.

The fix is not always deletion.

Often the fix is separation:

- public-safe product requirement
- private-only source context
- explicit contrast note
- narrower claim

## Next build target

Create a simple contrast record template and require it whenever a public GitHub write is blocked, revised for safety, or judged inappropriate.
